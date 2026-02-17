/*
 * Copyright (C) 2026 Fluxer Contributors
 *
 * This file is part of Fluxer.
 *
 * Fluxer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Fluxer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Fluxer. If not, see <https://www.gnu.org/licenses/>.
 */

import fs from 'node:fs/promises';
import type {ChannelID, GuildID, UserID, WebhookID, WebhookToken} from '@fluxer/api/src/BrandedTypes';
import {createChannelID, createGuildID, createWebhookID, createWebhookToken} from '@fluxer/api/src/BrandedTypes';
import type {IChannelRepository} from '@fluxer/api/src/channel/IChannelRepository';
import type {MessageRequest} from '@fluxer/api/src/channel/MessageTypes';
import type {ChannelService} from '@fluxer/api/src/channel/services/ChannelService';
import type {GuildAuditLogService} from '@fluxer/api/src/guild/GuildAuditLogService';
import type {GuildService} from '@fluxer/api/src/guild/services/GuildService';
import type {AvatarService} from '@fluxer/api/src/infrastructure/AvatarService';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import {getMetricsService} from '@fluxer/api/src/infrastructure/MetricsService';
import type {SnowflakeService} from '@fluxer/api/src/infrastructure/SnowflakeService';
import {Logger} from '@fluxer/api/src/Logger';
import type {LimitConfigService} from '@fluxer/api/src/limits/LimitConfigService';
import {resolveLimitSafe} from '@fluxer/api/src/limits/LimitConfigUtils';
import {createLimitMatchContext} from '@fluxer/api/src/limits/LimitMatchContextBuilder';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {Message} from '@fluxer/api/src/models/Message';
import type {Webhook} from '@fluxer/api/src/models/Webhook';
import * as RandomUtils from '@fluxer/api/src/utils/RandomUtils';
import type {IWebhookRepository} from '@fluxer/api/src/webhook/IWebhookRepository';
import {transform as GitHubTransform} from '@fluxer/api/src/webhook/transformers/GitHubTransformer';
import {transform as SentryTransform} from '@fluxer/api/src/webhook/transformers/SentryTransformer';
import type {ICacheService} from '@fluxer/cache/src/ICacheService';
import {AuditLogActionType} from '@fluxer/constants/src/AuditLogActionType';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import type {LimitKey} from '@fluxer/constants/src/LimitConfigMetadata';
import {MAX_WEBHOOKS_PER_CHANNEL, MAX_WEBHOOKS_PER_GUILD} from '@fluxer/constants/src/LimitConstants';
import {MaxWebhooksPerChannelError} from '@fluxer/errors/src/domains/channel/MaxWebhooksPerChannelError';
import {UnknownChannelError} from '@fluxer/errors/src/domains/channel/UnknownChannelError';
import {MaxWebhooksPerGuildError} from '@fluxer/errors/src/domains/guild/MaxWebhooksPerGuildError';
import {UnknownWebhookError} from '@fluxer/errors/src/domains/webhook/UnknownWebhookError';
import type {AllowedMentionsRequest} from '@fluxer/schema/src/domains/message/SharedMessageSchemas';
import type {GitHubWebhook} from '@fluxer/schema/src/domains/webhook/GitHubWebhookSchemas';
import type {SentryWebhook} from '@fluxer/schema/src/domains/webhook/SentryWebhookSchemas';
import type {
	WebhookCreateRequest,
	WebhookMessageRequest,
	WebhookTokenUpdateRequest,
	WebhookUpdateRequest,
} from '@fluxer/schema/src/domains/webhook/WebhookRequestSchemas';
import {seconds} from 'itty-time';

export interface WebhookExecuteMessageData extends Omit<WebhookMessageRequest, 'attachments'> {
	attachments?: WebhookMessageRequest['attachments'] | MessageRequest['attachments'];
	username?: string | null;
	avatar_url?: string | null;
}

export class WebhookService {
	private static readonly NO_ALLOWED_MENTIONS: AllowedMentionsRequest = {parse: []};

	private isUploadedAttachmentData(
		attachment: NonNullable<WebhookExecuteMessageData['attachments']>[number],
	): attachment is Extract<NonNullable<MessageRequest['attachments']>[number], {upload_filename: string}> {
		return (
			typeof attachment === 'object' &&
			attachment !== null &&
			'upload_filename' in attachment &&
			typeof attachment.upload_filename === 'string'
		);
	}

	constructor(
		private repository: IWebhookRepository,
		private guildService: GuildService,
		private channelService: ChannelService,
		private channelRepository: IChannelRepository,
		private cacheService: ICacheService,
		private gatewayService: IGatewayService,
		private avatarService: AvatarService,
		private mediaService: IMediaService,
		private snowflakeService: SnowflakeService,
		private readonly guildAuditLogService: GuildAuditLogService,
		private readonly limitConfigService: LimitConfigService,
	) {}

	async getWebhook({userId, webhookId}: {userId: UserID; webhookId: WebhookID}): Promise<Webhook> {
		return await this.getAuthenticatedWebhook({userId, webhookId});
	}

	async getWebhookByToken({webhookId, token}: {webhookId: WebhookID; token: WebhookToken}): Promise<Webhook> {
		const webhook = await this.repository.findByToken(webhookId, token);
		if (!webhook) throw new UnknownWebhookError();
		return webhook;
	}

	async getGuildWebhooks({userId, guildId}: {userId: UserID; guildId: GuildID}): Promise<Array<Webhook>> {
		const {checkPermission} = await this.guildService.getGuildAuthenticated({userId, guildId});
		await checkPermission(Permissions.MANAGE_WEBHOOKS);
		return await this.repository.listByGuild(guildId);
	}

	async getChannelWebhooks({userId, channelId}: {userId: UserID; channelId: ChannelID}): Promise<Array<Webhook>> {
		const channel = await this.channelService.getChannel({userId, channelId});
		if (!channel.guildId) throw new UnknownChannelError();
		const {checkPermission} = await this.guildService.getGuildAuthenticated({
			userId,
			guildId: channel.guildId,
		});
		await checkPermission(Permissions.MANAGE_WEBHOOKS);
		return await this.repository.listByChannel(channelId);
	}

	async createWebhook(
		params: {userId: UserID; channelId: ChannelID; data: WebhookCreateRequest},
		auditLogReason?: string | null,
	): Promise<Webhook> {
		const {userId, channelId, data} = params;
		const channel = await this.channelService.getChannel({userId, channelId});
		if (!channel.guildId) throw new UnknownChannelError();
		const {checkPermission, guildData} = await this.guildService.getGuildAuthenticated({
			userId,
			guildId: channel.guildId,
		});
		await checkPermission(Permissions.MANAGE_WEBHOOKS);
		const guildLimit = this.resolveWebhookLimit(guildData.features, 'max_webhooks_per_guild', MAX_WEBHOOKS_PER_GUILD);
		const guildWebhookCount = await this.repository.countByGuild(channel.guildId);
		if (guildWebhookCount >= guildLimit) {
			throw new MaxWebhooksPerGuildError(guildLimit);
		}
		const channelLimit = this.resolveWebhookLimit(
			guildData.features,
			'max_webhooks_per_channel',
			MAX_WEBHOOKS_PER_CHANNEL,
		);
		const channelWebhookCount = await this.repository.countByChannel(channelId);
		if (channelWebhookCount >= channelLimit) {
			throw new MaxWebhooksPerChannelError(channelLimit);
		}
		const webhookId = createWebhookID(await this.snowflakeService.generate());
		const webhook = await this.repository.create({
			webhookId,
			token: createWebhookToken(RandomUtils.randomString(64)),
			type: 1,
			guildId: channel.guildId,
			channelId,
			creatorId: userId,
			name: data.name,
			avatarHash: data.avatar ? await this.updateAvatar({webhookId, avatar: data.avatar}) : null,
		});
		await this.dispatchWebhooksUpdate({guildId: channel.guildId, channelId});
		await this.recordWebhookAuditLog({
			guildId: channel.guildId,
			userId,
			action: 'create',
			webhook,
			auditLogReason,
		});
		getMetricsService().counter({name: 'fluxer.webhooks.created', value: 1});
		return webhook;
	}

	async updateWebhook(
		params: {userId: UserID; webhookId: WebhookID; data: WebhookUpdateRequest},
		auditLogReason?: string | null,
	): Promise<Webhook> {
		const {userId, webhookId, data} = params;
		const webhook = await this.getAuthenticatedWebhook({userId, webhookId});
		const {checkPermission, guildData} = await this.guildService.getGuildAuthenticated({
			userId,
			guildId: webhook.guildId ? webhook.guildId : createGuildID(0n),
		});
		await checkPermission(Permissions.MANAGE_WEBHOOKS);
		if (data.channel_id && data.channel_id !== webhook.channelId) {
			const targetChannel = await this.channelService.getChannel({userId, channelId: createChannelID(data.channel_id)});
			if (!targetChannel.guildId || targetChannel.guildId !== webhook.guildId) {
				throw new UnknownChannelError();
			}
			const channelLimit = this.resolveWebhookLimit(
				guildData.features,
				'max_webhooks_per_channel',
				MAX_WEBHOOKS_PER_CHANNEL,
			);
			const channelWebhookCount = await this.repository.countByChannel(createChannelID(data.channel_id));
			if (channelWebhookCount >= channelLimit) {
				throw new MaxWebhooksPerChannelError(channelLimit);
			}
		}
		const updatedData = await this.updateWebhookData({webhook, data});
		const updatedWebhook = await this.repository.update(webhookId, {
			name: updatedData.name,
			avatarHash: updatedData.avatarHash,
			channelId: updatedData.channelId,
		});
		if (!updatedWebhook) throw new UnknownWebhookError();
		await this.dispatchWebhooksUpdate({
			guildId: webhook.guildId,
			channelId: webhook.channelId,
		});
		if (webhook.guildId) {
			const previousSnapshot = this.serializeWebhookForAudit(webhook);
			await this.recordWebhookAuditLog({
				guildId: webhook.guildId,
				userId,
				action: 'update',
				webhook: updatedWebhook,
				previousSnapshot,
				auditLogReason,
			});
		}
		return updatedWebhook;
	}

	async updateWebhookByToken({
		webhookId,
		token,
		data,
	}: {
		webhookId: WebhookID;
		token: WebhookToken;
		data: WebhookTokenUpdateRequest;
	}): Promise<Webhook> {
		const webhook = await this.repository.findByToken(webhookId, token);
		if (!webhook) throw new UnknownWebhookError();
		const updatedData = await this.updateWebhookData({webhook, data});
		const updatedWebhook = await this.repository.update(webhookId, {
			name: updatedData.name,
			avatarHash: updatedData.avatarHash,
			channelId: updatedData.channelId,
		});
		if (!updatedWebhook) throw new UnknownWebhookError();
		await this.dispatchWebhooksUpdate({
			guildId: webhook.guildId,
			channelId: webhook.channelId,
		});
		return updatedWebhook;
	}

	async deleteWebhook(
		{userId, webhookId}: {userId: UserID; webhookId: WebhookID},
		auditLogReason?: string | null,
	): Promise<void> {
		const webhook = await this.getAuthenticatedWebhook({userId, webhookId});
		const {checkPermission} = await this.guildService.getGuildAuthenticated({userId, guildId: webhook.guildId!});
		await checkPermission(Permissions.MANAGE_WEBHOOKS);
		await this.repository.delete(webhookId);
		await this.dispatchWebhooksUpdate({
			guildId: webhook.guildId,
			channelId: webhook.channelId,
		});
		if (webhook.guildId) {
			await this.recordWebhookAuditLog({
				guildId: webhook.guildId,
				userId,
				action: 'delete',
				webhook,
				auditLogReason,
			});
		}
		getMetricsService().counter({name: 'fluxer.webhooks.deleted', value: 1});
	}

	async deleteWebhookByToken({webhookId, token}: {webhookId: WebhookID; token: WebhookToken}): Promise<void> {
		const webhook = await this.repository.findByToken(webhookId, token);
		if (!webhook) throw new UnknownWebhookError();
		await this.repository.delete(webhookId);
		await this.dispatchWebhooksUpdate({
			guildId: webhook.guildId,
			channelId: webhook.channelId,
		});
		getMetricsService().counter({name: 'fluxer.webhooks.deleted', value: 1});
	}

	async executeWebhook({
		webhookId,
		token,
		data,
		requestCache,
	}: {
		webhookId: WebhookID;
		token: WebhookToken;
		data: WebhookExecuteMessageData;
		requestCache: RequestCache;
	}): Promise<Message> {
		const start = Date.now();
		try {
			const webhook = await this.repository.findByToken(webhookId, token);
			if (!webhook) throw new UnknownWebhookError();
			const channel = await this.channelRepository.findUnique(webhook.channelId!);
			if (!channel || !channel.guildId) throw new UnknownChannelError();
			const attachments = data.attachments?.filter((attachment) => this.isUploadedAttachmentData(attachment));
			const message = await this.channelService.sendWebhookMessage({
				webhook,
				data: {
					content: data.content,
					embeds: data.embeds,
					attachments,
					message_reference: data.message_reference,
					allowed_mentions: WebhookService.NO_ALLOWED_MENTIONS,
					flags: data.flags,
					nonce: data.nonce,
					favorite_meme_id: data.favorite_meme_id,
					sticker_ids: data.sticker_ids,
					tts: data.tts,
				},
				username: data.username,
				avatar: data.avatar_url
					? await this.getWebhookAvatar({webhookId: webhook.id, avatarUrl: data.avatar_url})
					: null,
				requestCache,
			});

			getMetricsService().counter({
				name: 'fluxer.webhooks.executed',
				value: 1,
				dimensions: {webhook_id: webhookId.toString(), success: 'true'},
			});

			return message;
		} catch (error) {
			getMetricsService().counter({
				name: 'fluxer.webhooks.executed',
				value: 1,
				dimensions: {
					webhook_id: webhookId.toString(),
					success: 'false',
					error_type: error instanceof Error ? error.name : 'Unknown',
				},
			});
			throw error;
		} finally {
			getMetricsService().histogram({name: 'fluxer.webhook.execution.latency', valueMs: Date.now() - start});
		}
	}

	async executeGitHubWebhook(params: {
		webhookId: WebhookID;
		token: WebhookToken;
		event: string;
		delivery: string;
		data: GitHubWebhook;
		requestCache: RequestCache;
	}): Promise<void> {
		const start = Date.now();
		const {webhookId, token, event, delivery, data, requestCache} = params;
		try {
			const webhook = await this.repository.findByToken(webhookId, token);
			if (!webhook) throw new UnknownWebhookError();
			const channel = await this.channelRepository.findUnique(webhook.channelId!);
			if (!channel || !channel.guildId) throw new UnknownChannelError();
			if (delivery) {
				const isCached = await this.cacheService.get<number>(`github:${webhookId}:${delivery}`);
				if (isCached) return;
			}
			const embed = await GitHubTransform(event, data);
			if (!embed) return;
			await this.channelService.sendWebhookMessage({
				webhook,
				data: {embeds: [embed], allowed_mentions: WebhookService.NO_ALLOWED_MENTIONS},
				username: 'GitHub',
				avatar: await this.getGitHubWebhookAvatar(webhook.id),
				requestCache,
			});
			if (delivery) await this.cacheService.set(`github:${webhookId}:${delivery}`, 1, seconds('1 day'));

			getMetricsService().counter({
				name: 'fluxer.webhooks.executed',
				value: 1,
				dimensions: {webhook_id: webhookId.toString(), success: 'true'},
			});
		} catch (error) {
			getMetricsService().counter({
				name: 'fluxer.webhooks.executed',
				value: 1,
				dimensions: {
					webhook_id: webhookId.toString(),
					success: 'false',
					error_type: error instanceof Error ? error.name : 'Unknown',
				},
			});
			throw error;
		} finally {
			getMetricsService().histogram({name: 'fluxer.webhook.execution.latency', valueMs: Date.now() - start});
		}
	}

	async executeSentryWebhook(params: {
		webhookId: WebhookID;
		token: WebhookToken;
		event: string;
		data: SentryWebhook;
		requestCache: RequestCache;
	}): Promise<void> {
		const start = Date.now();
		const {webhookId, token, event, data, requestCache} = params;
		try {
			const webhook = await this.repository.findByToken(webhookId, token);
			if (!webhook) throw new UnknownWebhookError();
			const channel = await this.channelRepository.findUnique(webhook.channelId!);
			if (!channel || !channel.guildId) throw new UnknownChannelError();
			const embed = await SentryTransform(event, data);
			if (!embed) return;
			await this.channelService.sendWebhookMessage({
				webhook,
				data: {embeds: [embed], allowed_mentions: WebhookService.NO_ALLOWED_MENTIONS},
				username: 'Sentry',
				avatar: await this.getSentryWebhookAvatar(webhook.id),
				requestCache,
			});

			getMetricsService().counter({
				name: 'fluxer.webhooks.executed',
				value: 1,
				dimensions: {webhook_id: webhookId.toString(), success: 'true'},
			});
		} catch (error) {
			getMetricsService().counter({
				name: 'fluxer.webhooks.executed',
				value: 1,
				dimensions: {
					webhook_id: webhookId.toString(),
					success: 'false',
					error_type: error instanceof Error ? error.name : 'Unknown',
				},
			});
			throw error;
		} finally {
			getMetricsService().histogram({name: 'fluxer.webhook.execution.latency', valueMs: Date.now() - start});
		}
	}

	async dispatchWebhooksUpdate({
		guildId,
		channelId,
	}: {
		guildId: GuildID | null;
		channelId: ChannelID | null;
	}): Promise<void> {
		if (guildId && channelId) {
			await this.gatewayService.dispatchGuild({
				guildId: guildId,
				event: 'WEBHOOKS_UPDATE',
				data: {channel_id: channelId.toString()},
			});
		}
	}

	private async getAuthenticatedWebhook({userId, webhookId}: {userId: UserID; webhookId: WebhookID}): Promise<Webhook> {
		const webhook = await this.repository.findUnique(webhookId);
		if (!webhook) throw new UnknownWebhookError();
		const {checkPermission} = await this.guildService.getGuildAuthenticated({userId, guildId: webhook.guildId!});
		await checkPermission(Permissions.MANAGE_WEBHOOKS);
		return webhook;
	}

	private async updateWebhookData({
		webhook,
		data,
	}: {
		webhook: Webhook;
		data: WebhookUpdateRequest;
	}): Promise<{name: string; avatarHash: string | null; channelId: ChannelID | null}> {
		const name = data.name !== undefined ? data.name : webhook.name;
		const avatarHash =
			data.avatar !== undefined
				? await this.updateAvatar({webhookId: webhook.id, avatar: data.avatar})
				: webhook.avatarHash;
		let channelId = webhook.channelId;
		if (data.channel_id !== undefined && data.channel_id !== webhook.channelId) {
			const channel = await this.channelRepository.findUnique(createChannelID(data.channel_id));
			if (!channel || !channel.guildId || channel.guildId !== webhook.guildId) {
				throw new UnknownChannelError();
			}
			channelId = channel.id;
		}
		return {name: name!, avatarHash, channelId};
	}

	private async updateAvatar({
		webhookId,
		avatar,
	}: {
		webhookId: WebhookID;
		avatar: string | null;
	}): Promise<string | null> {
		return this.avatarService.uploadAvatar({
			prefix: 'avatars',
			entityId: webhookId,
			errorPath: 'avatar',
			base64Image: avatar,
		});
	}

	private async getWebhookAvatar({
		webhookId,
		avatarUrl,
	}: {
		webhookId: WebhookID;
		avatarUrl: string | null;
	}): Promise<string | null> {
		if (!avatarUrl) return null;
		const avatarCache = await this.cacheService.get<string | null>(`webhook:${webhookId}:avatar:${avatarUrl}`);
		if (avatarCache) return avatarCache;
		const metadata = await this.mediaService.getMetadata({
			type: 'external',
			url: avatarUrl,
			with_base64: true,
			isNSFWAllowed: false,
		});
		if (!metadata?.base64) {
			await this.cacheService.set(`webhook:${webhookId}:avatar:${avatarUrl}`, null, seconds('5 minutes'));
			return null;
		}
		const avatar = await this.avatarService.uploadAvatar({
			prefix: 'avatars',
			entityId: webhookId,
			errorPath: 'avatar',
			base64Image: metadata.base64,
		});
		await this.cacheService.set(`webhook:${webhookId}:avatar:${avatarUrl}`, avatar, seconds('1 day'));
		return avatar;
	}

	private async getGitHubWebhookAvatar(webhookId: WebhookID): Promise<string | null> {
		return this.getStaticWebhookAvatar({
			webhookId,
			provider: 'github',
			assetFileName: 'github.webp',
		});
	}

	private async getSentryWebhookAvatar(webhookId: WebhookID): Promise<string | null> {
		return this.getStaticWebhookAvatar({
			webhookId,
			provider: 'sentry',
			assetFileName: 'sentry.webp',
		});
	}

	private async getStaticWebhookAvatar({
		webhookId,
		provider,
		assetFileName,
	}: {
		webhookId: WebhookID;
		provider: 'github' | 'sentry';
		assetFileName: 'github.webp' | 'sentry.webp';
	}): Promise<string | null> {
		const cacheKey = `webhook:${webhookId}:avatar:${provider}`;
		const avatarCache = await this.cacheService.get<string | null>(cacheKey);
		if (avatarCache) return avatarCache;
		const avatarFile = await fs.readFile(new URL(`../assets/${assetFileName}`, import.meta.url));
		const avatar = await this.avatarService.uploadAvatar({
			prefix: 'avatars',
			entityId: webhookId,
			errorPath: 'avatar',
			base64Image: avatarFile.toString('base64'),
		});
		await this.cacheService.set(cacheKey, avatar, seconds('1 day'));
		return avatar;
	}

	private getWebhookMetadata(webhook: Webhook): Record<string, string> | undefined {
		if (!webhook.channelId) {
			return undefined;
		}
		return {channel_id: webhook.channelId.toString()};
	}

	private serializeWebhookForAudit(webhook: Webhook): Record<string, unknown> {
		return {
			id: webhook.id.toString(),
			guild_id: webhook.guildId?.toString() ?? null,
			channel_id: webhook.channelId?.toString() ?? null,
			name: webhook.name,
			creator_id: webhook.creatorId?.toString() ?? null,
			avatar_hash: webhook.avatarHash,
			type: webhook.type,
		};
	}

	private async recordWebhookAuditLog(params: {
		guildId: GuildID;
		userId: UserID;
		action: 'create' | 'update' | 'delete';
		webhook: Webhook;
		previousSnapshot?: Record<string, unknown> | null;
		auditLogReason?: string | null;
	}): Promise<void> {
		const actionName =
			params.action === 'create'
				? 'guild_webhook_create'
				: params.action === 'update'
					? 'guild_webhook_update'
					: 'guild_webhook_delete';

		const previousSnapshot =
			params.action === 'create' ? null : (params.previousSnapshot ?? this.serializeWebhookForAudit(params.webhook));
		const nextSnapshot = params.action === 'delete' ? null : this.serializeWebhookForAudit(params.webhook);
		const changes = this.guildAuditLogService.computeChanges(previousSnapshot, nextSnapshot);

		const actionType =
			params.action === 'create'
				? AuditLogActionType.WEBHOOK_CREATE
				: params.action === 'update'
					? AuditLogActionType.WEBHOOK_UPDATE
					: AuditLogActionType.WEBHOOK_DELETE;

		try {
			await this.guildAuditLogService
				.createBuilder(params.guildId, params.userId)
				.withAction(actionType, params.webhook.id.toString())
				.withReason(params.auditLogReason ?? null)
				.withMetadata(this.getWebhookMetadata(params.webhook))
				.withChanges(changes)
				.commit();
		} catch (error) {
			Logger.error(
				{
					error,
					guildId: params.guildId.toString(),
					userId: params.userId.toString(),
					action: actionName,
					targetId: params.webhook.id.toString(),
				},
				'Failed to record guild webhook audit log',
			);
		}
	}

	private resolveWebhookLimit(guildFeatures: Iterable<string> | null, key: LimitKey, fallback: number): number {
		const ctx = createLimitMatchContext({guildFeatures});
		return resolveLimitSafe(this.limitConfigService.getConfigSnapshot(), ctx, key, fallback);
	}
}
