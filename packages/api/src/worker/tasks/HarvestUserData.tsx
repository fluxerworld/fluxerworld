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

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {AdminArchive} from '@fluxer/api/src/admin/models/AdminArchiveModel';
import {type ChannelID, createUserID, type GuildID, type MessageID, type UserID} from '@fluxer/api/src/BrandedTypes';
import {Config} from '@fluxer/api/src/Config';
import {makeAttachmentCdnUrl} from '@fluxer/api/src/channel/services/message/MessageHelpers';
import type {IStorageService} from '@fluxer/api/src/infrastructure/IStorageService';
import {Logger} from '@fluxer/api/src/Logger';
import type {Application} from '@fluxer/api/src/models/Application';
import type {AuthSession} from '@fluxer/api/src/models/AuthSession';
import type {Channel} from '@fluxer/api/src/models/Channel';
import type {FavoriteMeme} from '@fluxer/api/src/models/FavoriteMeme';
import type {GiftCode} from '@fluxer/api/src/models/GiftCode';
import type {Guild} from '@fluxer/api/src/models/Guild';
import type {GuildMember} from '@fluxer/api/src/models/GuildMember';
import type {MfaBackupCode} from '@fluxer/api/src/models/MfaBackupCode';
import type {Payment} from '@fluxer/api/src/models/Payment';
import type {PushSubscription} from '@fluxer/api/src/models/PushSubscription';
import type {Relationship} from '@fluxer/api/src/models/Relationship';
import type {SavedMessage} from '@fluxer/api/src/models/SavedMessage';
import type {User} from '@fluxer/api/src/models/User';
import type {UserGuildSettings} from '@fluxer/api/src/models/UserGuildSettings';
import type {UserSettings} from '@fluxer/api/src/models/UserSettings';
import type {WebAuthnCredential} from '@fluxer/api/src/models/WebAuthnCredential';
import {resolveSessionClientInfo} from '@fluxer/api/src/utils/UserAgentUtils';
import {
	appendAssetToArchive,
	buildHashedAssetKey,
	getAnimatedAssetExtension,
} from '@fluxer/api/src/worker/utils/AssetArchiveHelpers';
import {getWorkerDependencies} from '@fluxer/api/src/worker/WorkerContext';
import {snowflakeToDate} from '@fluxer/snowflake/src/Snowflake';
import type {WorkerTaskHandler} from '@fluxer/worker/src/contracts/WorkerTask';
import archiver from 'archiver';
import {ms} from 'itty-time';
import {z} from 'zod';

const PayloadSchema = z.object({
	userId: z.string(),
	harvestId: z.string(),
	adminRequestedBy: z.string().optional(),
});

interface HarvestedMessage {
	id: string;
	timestamp: string;
	content: string;
	attachments: Array<string>;
}

interface ChannelHarvestResult {
	channelId: string;
	messageData: HarvestedMessage;
}

interface GuildMembershipEntry {
	member: GuildMember | null;
	guild: Guild | null;
	guildId: GuildID;
}

interface HarvestMessageResult {
	channelMessagesMap: Map<string, Array<HarvestedMessage>>;
	totalMessages: number;
}

interface UserDataJsonParams {
	user: User;
	userId: UserID;
	authSessions: Array<AuthSession>;
	relationships: Array<Relationship>;
	userNotes: Map<UserID, string>;
	userSettings: UserSettings | null;
	guildMemberships: Array<GuildMembershipEntry>;
	guildSettings: Array<UserGuildSettings | null>;
	savedMessages: Array<SavedMessage>;
	privateChannels: Array<Channel>;
	favoriteMemes: Array<FavoriteMeme>;
	pushSubscriptions: Array<PushSubscription>;
	webAuthnCredentials: Array<WebAuthnCredential>;
	mfaBackupCodes: Array<MfaBackupCode>;
	createdGiftCodes: Array<GiftCode>;
	payments: Array<Payment>;
	oauthClients: Array<Application>;
	pinnedDms: Array<{channel_id: bigint; sort_order: number}>;
	authorizedIps: Array<{ip: string}>;
	activityData: {last_active_at: Date | null; last_active_ip: string | null};
}

interface ArchiveParams {
	userId: UserID;
	harvestId: bigint;
	isAdminArchive: boolean;
	userDataJsonBuffer: Buffer;
	user: User;
	channelMessagesMap: Map<string, Array<HarvestedMessage>>;
	payments: Array<Payment>;
	oauthClients: Array<Application>;
	authorizedIps: Array<{ip: string}>;
	activityData: {last_active_at: Date | null; last_active_ip: string | null};
	storageService: IStorageService;
}

interface ArchiveResult {
	zipBuffer: Buffer;
	storageKey: string;
	expiresAt: Date;
	downloadUrl: string;
}

const CONCURRENT_MESSAGE_LIMIT = 10;
const INITIAL_PROGRESS = 5;
const MESSAGES_PROGRESS_MAX = 55;
const METADATA_PROGRESS = 60;
const ZIP_PROGRESS = 70;
const COMPLETE_PROGRESS = 100;

const ZIP_EXPIRY_MS = ms('7 days');

function mapPayment(payment: Payment) {
	return {
		checkout_session_id: payment.checkoutSessionId,
		amount_cents: payment.amountCents,
		currency: payment.currency,
		status: payment.status,
		subscription_id: payment.subscriptionId,
		payment_intent_id: payment.paymentIntentId,
		product_type: payment.productType,
		is_gift: payment.isGift,
		gift_code: payment.giftCode,
		created_at: payment.createdAt.toISOString(),
		completed_at: payment.completedAt?.toISOString() ?? null,
	};
}

function mapOAuthApplication(app: Application) {
	return {
		application_id: app.applicationId.toString(),
		name: app.name,
		redirect_uris: Array.from(app.oauth2RedirectUris),
	};
}

function mapSecurityData(params: {
	authorizedIps: Array<{ip: string}>;
	activityData: {last_active_at: Date | null; last_active_ip: string | null};
}) {
	return {
		authorized_ips: params.authorizedIps,
		activity_tracking: {
			last_active_at: params.activityData.last_active_at?.toISOString() ?? null,
			last_active_ip: params.activityData.last_active_ip,
		},
	};
}

async function harvestMessages(
	channelRepository: {
		listMessagesByAuthor: (
			userId: UserID,
			limit: number,
		) => Promise<Array<{channelId: ChannelID; messageId: MessageID}>>;
		getMessage: (
			channelId: ChannelID,
			messageId: MessageID,
		) => Promise<{content: string | null; attachments?: Array<{id: bigint; filename: string}>} | null>;
	},
	userId: UserID,
	startTime: number,
): Promise<HarvestMessageResult> {
	const channelMessagesMap = new Map<string, Array<HarvestedMessage>>();

	Logger.debug('Fetching all user messages');
	const startFetchTime = Date.now();

	const messageRefs = await channelRepository.listMessagesByAuthor(userId, 100000);

	Logger.debug(
		{
			totalMessages: messageRefs.length,
			fetchElapsed: Date.now() - startFetchTime,
			totalElapsed: Date.now() - startTime,
		},
		'All messages retrieved',
	);

	if (messageRefs.length === 0) {
		return {channelMessagesMap, totalMessages: 0};
	}

	const messages: Array<ChannelHarvestResult> = [];

	for (let i = 0; i < messageRefs.length; i += CONCURRENT_MESSAGE_LIMIT) {
		const batch = messageRefs.slice(i, i + CONCURRENT_MESSAGE_LIMIT);

		const batchPromises = batch.map(async ({channelId, messageId}): Promise<ChannelHarvestResult | null> => {
			try {
				const message = await channelRepository.getMessage(channelId, messageId);
				if (!message) {
					Logger.warn(
						{channelId: channelId.toString(), messageId: messageId.toString()},
						'Message not found during harvest',
					);
					return null;
				}

				const timestamp = snowflakeToDate(messageId);
				const attachments: Array<string> = [];

				if (message.attachments) {
					for (const attachment of message.attachments) {
						const attachmentUrl = makeAttachmentCdnUrl(channelId, attachment.id, attachment.filename);
						attachments.push(attachmentUrl);
					}
				}

				return {
					channelId: channelId.toString(),
					messageData: {
						id: messageId.toString(),
						timestamp: timestamp.toISOString(),
						content: message.content ?? '',
						attachments,
					},
				};
			} catch (error) {
				Logger.error(
					{error, channelId: channelId.toString(), messageId: messageId.toString()},
					'Failed to process message during harvest',
				);
				return null;
			}
		});

		const batchResults = await Promise.all(batchPromises);

		for (const result of batchResults) {
			if (result !== null) {
				messages.push(result);
			}
		}
	}

	for (const {channelId, messageData} of messages) {
		if (!channelMessagesMap.has(channelId)) {
			channelMessagesMap.set(channelId, []);
		}
		channelMessagesMap.get(channelId)!.push(messageData);
	}

	return {channelMessagesMap, totalMessages: messages.length};
}

function buildUserDataJson(params: UserDataJsonParams) {
	const {
		user,
		userId,
		authSessions,
		relationships,
		userNotes,
		userSettings,
		guildMemberships,
		guildSettings,
		savedMessages,
		privateChannels,
		favoriteMemes,
		pushSubscriptions,
		webAuthnCredentials,
		mfaBackupCodes,
		createdGiftCodes,
		payments,
		oauthClients,
		pinnedDms,
		authorizedIps,
		activityData,
	} = params;

	return {
		user: {
			id: user.id.toString(),
			username: user.username,
			discriminator: user.discriminator,
			bot: user.isBot,
			system: user.isSystem,
			email: user.email,
			email_verified: user.emailVerified,
			email_bounced: user.emailBounced,
			phone: user.phone,
			avatar_hash: user.avatarHash,
			avatar_url: user.avatarHash
				? `${Config.endpoints.media}/avatars/${userId}/${user.avatarHash}.${user.avatarHash.startsWith('a_') ? 'gif' : 'png'}`
				: null,
			banner_hash: user.bannerHash,
			banner_url: user.bannerHash
				? `${Config.endpoints.media}/banners/${userId}/${user.bannerHash}.${user.bannerHash.startsWith('a_') ? 'gif' : 'png'}`
				: null,
			bio: user.bio,
			pronouns: user.pronouns,
			accent_color: user.accentColor,
			date_of_birth: user.dateOfBirth,
			locale: user.locale,
			flags: user.flags.toString(),
			premium_type: user.premiumType,
			premium_since: user.premiumSince?.toISOString() ?? null,
			premium_until: user.premiumUntil?.toISOString() ?? null,
			premium_lifetime_sequence: user.premiumLifetimeSequence,
			stripe_customer_id: user.stripeCustomerId,
			stripe_subscription_id: user.stripeSubscriptionId,
			terms_agreed_at: user.termsAgreedAt?.toISOString() ?? null,
			privacy_agreed_at: user.privacyAgreedAt?.toISOString() ?? null,
			last_active_at: user.lastActiveAt?.toISOString() ?? null,
			created_at: snowflakeToDate(user.id).toISOString(),
			mfa_enabled: user.authenticatorTypes.size > 0,
			authenticator_types: Array.from(user.authenticatorTypes),
		},
		auth_sessions: authSessions.map((session) => {
			const {clientOs, clientPlatform} = resolveSessionClientInfo({
				userAgent: session.clientUserAgent,
				isDesktopClient: session.clientIsDesktop,
			});
			return {
				created_at: session.createdAt.toISOString(),
				approx_last_used_at: session.approximateLastUsedAt?.toISOString() ?? null,
				client_ip: session.clientIp,
				client_os: clientOs,
				client_user_agent: session.clientUserAgent,
				client_platform: clientPlatform,
			};
		}),
		relationships: relationships.map((rel) => ({
			target_user_id: rel.targetUserId.toString(),
			type: rel.type,
			nickname: rel.nickname,
			since: rel.since?.toISOString() ?? null,
		})),
		notes: Array.from(userNotes.entries()).map(([targetUserId, note]) => ({
			target_user_id: targetUserId.toString(),
			note,
		})),
		user_settings: userSettings
			? {
					locale: userSettings.locale,
					theme: userSettings.theme,
					status: userSettings.status,
					custom_status: userSettings.customStatus
						? {
								text: userSettings.customStatus.text,
								emoji_id: userSettings.customStatus.emojiId?.toString() ?? null,
								emoji_name: userSettings.customStatus.emojiName,
								emoji_animated: userSettings.customStatus.emojiAnimated,
								expires_at: userSettings.customStatus.expiresAt?.toISOString() ?? null,
							}
						: null,
					developer_mode: userSettings.developerMode,
					message_display_compact: userSettings.compactMessageDisplay,
					animate_emoji: userSettings.animateEmoji,
					animate_stickers: userSettings.animateStickers,
					gif_auto_play: userSettings.gifAutoPlay,
					render_embeds: userSettings.renderEmbeds,
					render_reactions: userSettings.renderReactions,
					render_spoilers: userSettings.renderSpoilers,
					inline_attachment_media: userSettings.inlineAttachmentMedia,
					inline_embed_media: userSettings.inlineEmbedMedia,
					explicit_content_filter: userSettings.explicitContentFilter,
					friend_source_flags: userSettings.friendSourceFlags,
					default_guilds_restricted: userSettings.defaultGuildsRestricted,
					bot_default_guilds_restricted: userSettings.botDefaultGuildsRestricted,
					restricted_guilds: Array.from(userSettings.restrictedGuilds).map((id) => id.toString()),
					bot_restricted_guilds: Array.from(userSettings.botRestrictedGuilds).map((id) => id.toString()),
					guild_positions: userSettings.guildPositions.map((id) => id.toString()),
					guild_folders: userSettings.guildFolders,
					afk_timeout: userSettings.afkTimeout,
					time_format: userSettings.timeFormat,
				}
			: null,
		guild_memberships: guildMemberships
			.filter((gm) => gm.member !== null)
			.map(({member, guild, guildId}) => ({
				guild_id: guildId.toString(),
				guild_name: guild?.name ?? null,
				joined_at: member!.joinedAt.toISOString(),
				nick: member!.nickname,
				avatar_hash: member!.avatarHash,
				avatar_url: member!.avatarHash
					? `${Config.endpoints.media}/guilds/${guildId}/users/${userId}/avatars/${member!.avatarHash}`
					: null,
				banner_hash: member!.bannerHash,
				banner_url: member!.bannerHash
					? `${Config.endpoints.media}/guilds/${guildId}/users/${userId}/banners/${member!.bannerHash}`
					: null,
				role_ids: Array.from(member!.roleIds).map((id) => id.toString()),
			})),
		user_guild_settings: guildSettings
			.filter((settings) => settings !== null)
			.map((settings) => ({
				guild_id: settings!.guildId.toString(),
				message_notifications: settings!.messageNotifications,
				muted: settings!.muted,
				mobile_push: settings!.mobilePush,
				suppress_everyone: settings!.suppressEveryone,
				suppress_roles: settings!.suppressRoles,
				hide_muted_channels: settings!.hideMutedChannels,
			})),
		saved_messages: savedMessages.map((msg) => ({
			channel_id: msg.channelId.toString(),
			message_id: msg.messageId.toString(),
			saved_at: msg.savedAt.toISOString(),
		})),
		private_channels: privateChannels.map((channel) => ({
			channel_id: channel.id.toString(),
			type: channel.type,
			name: channel.name,
			icon_hash: channel.iconHash,
			owner_id: channel.ownerId?.toString() ?? null,
			recipient_ids: Array.from(channel.recipientIds).map((id) => id.toString()),
			last_message_id: channel.lastMessageId?.toString() ?? null,
		})),
		favorite_memes: favoriteMemes.map((meme) => ({
			meme_id: meme.id.toString(),
			name: meme.name,
			alt_text: meme.altText,
			tags: meme.tags,
			filename: meme.filename,
			content_type: meme.contentType,
			size: meme.size.toString(),
			width: meme.width,
			height: meme.height,
			duration: meme.duration,
		})),
		push_subscriptions: pushSubscriptions.map((sub) => ({
			subscription_id: sub.subscriptionId,
			endpoint: sub.endpoint,
			user_agent: sub.userAgent,
		})),
		webauthn_credentials: webAuthnCredentials.map((cred) => ({
			credential_id: cred.credentialId,
			name: cred.name,
			transports: cred.transports ? Array.from(cred.transports) : [],
			created_at: cred.createdAt.toISOString(),
			last_used_at: cred.lastUsedAt?.toISOString() ?? null,
		})),
		mfa_backup_codes: {
			total_count: mfaBackupCodes.length,
			consumed_count: mfaBackupCodes.filter((code) => code.consumed).length,
			remaining_count: mfaBackupCodes.filter((code) => !code.consumed).length,
		},
		gift_codes_created: createdGiftCodes.map((gift) => ({
			code: gift.code,
			duration_months: gift.durationMonths,
			created_at: gift.createdAt.toISOString(),
			redeemed_by_user_id: gift.redeemedByUserId?.toString() ?? null,
			redeemed_at: gift.redeemedAt?.toISOString() ?? null,
			stripe_payment_intent_id: gift.stripePaymentIntentId,
		})),
		payments: payments.map(mapPayment),
		oauth_applications: oauthClients.map(mapOAuthApplication),
		pinned_dms: pinnedDms.map((pin) => ({
			channel_id: pin.channel_id.toString(),
			sort_order: pin.sort_order,
		})),
		...mapSecurityData({authorizedIps, activityData}),
	};
}

async function createAndUploadArchive(params: ArchiveParams): Promise<ArchiveResult> {
	const {
		userId,
		harvestId,
		isAdminArchive,
		userDataJsonBuffer,
		user,
		channelMessagesMap,
		payments,
		oauthClients,
		authorizedIps,
		activityData,
		storageService,
	} = params;

	const userIdString = userId.toString();
	const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fluxer-harvest-'));
	const zipPath = path.join(tempDir, `user-data-${userId}.zip`);

	let output: fs.WriteStream | null = null;
	try {
		output = fs.createWriteStream(zipPath);
		const archive = archiver('zip', {zlib: {level: 9}});
		archive.pipe(output);

		archive.append(userDataJsonBuffer, {name: 'user.json'});

		if (user.avatarHash) {
			const avatarArchiveName = `assets/user/avatar.${getAnimatedAssetExtension(user.avatarHash)}`;
			const avatarStorageKey = buildHashedAssetKey('avatars', userIdString, user.avatarHash);
			await appendAssetToArchive({
				archive,
				storageService,
				storageKey: avatarStorageKey,
				archiveName: avatarArchiveName,
				label: 'user avatar',
				subjectId: userIdString,
			});
		}

		if (user.bannerHash) {
			const bannerArchiveName = `assets/user/banner.${getAnimatedAssetExtension(user.bannerHash)}`;
			const bannerStorageKey = buildHashedAssetKey('banners', userIdString, user.bannerHash);
			await appendAssetToArchive({
				archive,
				storageService,
				storageKey: bannerStorageKey,
				archiveName: bannerArchiveName,
				label: 'user banner',
				subjectId: userIdString,
			});
		}

		for (const [channelId, messages] of channelMessagesMap.entries()) {
			messages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
			const messagesJson = JSON.stringify(messages, null, 2);
			archive.append(messagesJson, {name: `channels/${channelId}/messages.json`});
		}

		archive.append(JSON.stringify(payments.map(mapPayment), null, 2), {
			name: 'payments/payment_history.json',
		});

		archive.append(JSON.stringify({applications: oauthClients.map(mapOAuthApplication)}, null, 2), {
			name: 'integrations/oauth.json',
		});

		archive.append(JSON.stringify(mapSecurityData({authorizedIps, activityData}), null, 2), {
			name: 'account/security.json',
		});

		await archive.finalize();

		await new Promise<void>((resolve, reject) => {
			if (!output) {
				reject(new Error('Output stream is null'));
				return;
			}
			output.on('close', resolve);
			output.on('error', reject);
		});

		const zipBuffer = await fs.promises.readFile(zipPath);
		const storageKey = `exports/${userId}/${harvestId}/user-data.zip`;
		const expiresAt = new Date(Date.now() + (isAdminArchive ? ms('1 year') : ZIP_EXPIRY_MS));

		await storageService.uploadObject({
			bucket: Config.s3.buckets.harvests,
			key: storageKey,
			body: zipBuffer,
			contentType: 'application/zip',
			expiresAt: expiresAt,
		});

		const downloadUrl = await storageService.getPresignedDownloadURL({
			bucket: Config.s3.buckets.harvests,
			key: storageKey,
			expiresIn: ZIP_EXPIRY_MS / 1000,
		});

		return {zipBuffer, storageKey, expiresAt, downloadUrl};
	} finally {
		if (output && !output.destroyed) {
			output.destroy();
		}
		await fs.promises.rm(tempDir, {recursive: true, force: true});
	}
}

const harvestUserData: WorkerTaskHandler = async (payload, helpers) => {
	const validated = PayloadSchema.parse(payload);
	helpers.logger.debug({payload}, 'Processing harvestUserData task');

	const startTime = Date.now();
	const userId = createUserID(BigInt(validated.userId));
	const harvestId = BigInt(validated.harvestId);

	Logger.info({userId, harvestId, startTime: new Date(startTime).toISOString()}, 'Task started');

	const {
		channelRepository,
		guildRepository,
		userRepository,
		userHarvestRepository,
		adminArchiveRepository,
		favoriteMemeRepository,
		paymentRepository,
		applicationRepository,
		storageService,
		emailService,
	} = getWorkerDependencies();

	const adminRequestedBy = validated.adminRequestedBy ? BigInt(validated.adminRequestedBy) : null;
	const isAdminArchive = adminRequestedBy !== null;

	const existingHarvest = isAdminArchive
		? await adminArchiveRepository.findBySubjectAndArchiveId('user', userId, harvestId)
		: await userHarvestRepository.findByUserAndHarvestId(userId, harvestId);

	if (isAdminArchive && !existingHarvest) {
		throw new Error(`Admin archive ${harvestId.toString()} for user ${userId.toString()} not found`);
	}

	if (existingHarvest?.completedAt) {
		Logger.info(
			{userId, harvestId, completedAt: existingHarvest.completedAt},
			'Harvest already completed, skipping (idempotent early bailout)',
		);
		return;
	}

	const adminArchive = isAdminArchive ? (existingHarvest as AdminArchive) : null;

	const progressReporter = {
		markAsStarted: () =>
			isAdminArchive && adminArchive
				? adminArchiveRepository.markAsStarted(adminArchive)
				: userHarvestRepository.markAsStarted(userId, harvestId),
		updateProgress: (progressPercent: number, progressStep: string) =>
			isAdminArchive && adminArchive
				? adminArchiveRepository.updateProgress(adminArchive, progressPercent, progressStep)
				: userHarvestRepository.updateProgress(userId, harvestId, progressPercent, progressStep),
		markAsCompleted: (storageKey: string, fileSize: bigint, expiresAt: Date) =>
			isAdminArchive && adminArchive
				? adminArchiveRepository.markAsCompleted(adminArchive, storageKey, fileSize, expiresAt)
				: userHarvestRepository.markAsCompleted(userId, harvestId, storageKey, fileSize, expiresAt),
		markAsFailed: (message: string) =>
			isAdminArchive && adminArchive
				? adminArchiveRepository.markAsFailed(adminArchive, message)
				: userHarvestRepository.markAsFailed(userId, harvestId, message),
		shouldSendEmail: !isAdminArchive,
	};

	try {
		await progressReporter.markAsStarted();
		Logger.debug({userId, harvestId, elapsed: Date.now() - startTime}, 'Starting user data harvest');

		await progressReporter.updateProgress(INITIAL_PROGRESS, 'Harvesting messages');
		Logger.debug({elapsed: Date.now() - startTime}, 'Set progress to INITIAL_PROGRESS');

		const {channelMessagesMap, totalMessages} = await harvestMessages(channelRepository, userId, startTime);

		if (totalMessages > 0) {
			const progress = Math.min(INITIAL_PROGRESS + Math.floor((totalMessages / 10000) * 50), MESSAGES_PROGRESS_MAX);
			await progressReporter.updateProgress(progress, `Harvested ${totalMessages} messages`);
		}

		Logger.debug(
			{
				userId,
				harvestId,
				channelCount: channelMessagesMap.size,
				totalMessages,
				elapsed: Date.now() - startTime,
			},
			'Harvested all messages',
		);

		await progressReporter.updateProgress(METADATA_PROGRESS, 'Collecting user metadata');
		Logger.debug({elapsed: Date.now() - startTime}, 'Starting metadata collection');

		const user = await userRepository.findUnique(userId);
		if (!user) {
			throw new Error(`User ${userId} not found`);
		}

		const [
			authSessions,
			relationships,
			userNotes,
			userSettings,
			guildIds,
			savedMessages,
			privateChannels,
			favoriteMemes,
			pushSubscriptions,
			webAuthnCredentials,
			mfaBackupCodes,
			createdGiftCodes,
			payments,
			oauthClients,
			pinnedDms,
			authorizedIps,
			activityData,
		] = await Promise.all([
			userRepository.listAuthSessions(userId) as Promise<Array<AuthSession>>,
			userRepository.listRelationships(userId) as Promise<Array<Relationship>>,
			userRepository.getUserNotes(userId) as Promise<Map<UserID, string>>,
			userRepository.findSettings(userId) as Promise<UserSettings | null>,
			userRepository.getUserGuildIds(userId) as Promise<Array<GuildID>>,
			userRepository.listSavedMessages(userId, 1000) as Promise<Array<SavedMessage>>,
			userRepository.listPrivateChannels(userId) as Promise<Array<Channel>>,
			favoriteMemeRepository.findByUserId(userId) as Promise<Array<FavoriteMeme>>,
			userRepository.listPushSubscriptions(userId) as Promise<Array<PushSubscription>>,
			userRepository.listWebAuthnCredentials(userId) as Promise<Array<WebAuthnCredential>>,
			userRepository.listMfaBackupCodes(userId) as Promise<Array<MfaBackupCode>>,
			userRepository.findGiftCodesByCreator(userId) as Promise<Array<GiftCode>>,
			paymentRepository.findPaymentsByUserId(userId) as Promise<Array<Payment>>,
			applicationRepository.listApplicationsByOwner(userId) as Promise<Array<Application>>,
			userRepository.getPinnedDmsWithDetails(userId) as Promise<Array<{channel_id: bigint; sort_order: number}>>,
			userRepository.getAuthorizedIps(userId) as Promise<Array<{ip: string}>>,
			userRepository.getActivityTracking(userId) as Promise<{
				last_active_at: Date | null;
				last_active_ip: string | null;
			}>,
		]);

		const guilds = await guildRepository.listGuilds(guildIds);
		const guildsMap = new Map(guilds.map((guild) => [guild.id.toString(), guild]));

		const guildMemberships = await Promise.all(
			guildIds.map(async (guildId: GuildID) => {
				const member = await guildRepository.getMember(guildId, userId);
				const guild = guildsMap.get(guildId.toString()) ?? null;
				return {member, guild, guildId};
			}),
		);

		const guildSettings = await Promise.all(
			guildIds.map((guildId: GuildID) => userRepository.findGuildSettings(userId, guildId)),
		);

		const userData = buildUserDataJson({
			user,
			userId,
			authSessions,
			relationships,
			userNotes,
			userSettings,
			guildMemberships,
			guildSettings,
			savedMessages,
			privateChannels,
			favoriteMemes,
			pushSubscriptions,
			webAuthnCredentials,
			mfaBackupCodes,
			createdGiftCodes,
			payments,
			oauthClients,
			pinnedDms,
			authorizedIps,
			activityData,
		});

		const userDataJsonBuffer = Buffer.from(JSON.stringify(userData, null, 2), 'utf-8');

		Logger.debug({userId, harvestId, elapsed: Date.now() - startTime}, 'Collected user metadata');

		await progressReporter.updateProgress(METADATA_PROGRESS + 5, 'Downloading media assets');
		await progressReporter.updateProgress(ZIP_PROGRESS, 'Creating ZIP archive');
		Logger.debug({elapsed: Date.now() - startTime}, 'Starting ZIP creation');

		const {zipBuffer, storageKey, expiresAt, downloadUrl} = await createAndUploadArchive({
			userId,
			harvestId,
			isAdminArchive,
			userDataJsonBuffer,
			user,
			channelMessagesMap,
			payments,
			oauthClients,
			authorizedIps,
			activityData,
			storageService,
		});

		Logger.debug(
			{userId, harvestId, zipSize: zipBuffer.length, elapsed: Date.now() - startTime},
			'Uploaded final ZIP to S3 with TTL',
		);

		await progressReporter.markAsCompleted(storageKey, BigInt(zipBuffer.length), expiresAt);
		Logger.debug({userId, harvestId}, 'Marked harvest as completed');

		if (progressReporter.shouldSendEmail && user.email && Config.email.enabled) {
			await emailService.sendHarvestCompletedEmail(
				user.email,
				user.username,
				downloadUrl,
				totalMessages,
				zipBuffer.length,
				expiresAt,
				user.locale,
			);

			Logger.debug({userId, harvestId, email: user.email, totalMessages}, 'Sent harvest completion email');
		}

		await progressReporter.updateProgress(COMPLETE_PROGRESS, 'Completed');

		Logger.info(
			{
				userId,
				harvestId,
				totalElapsed: Date.now() - startTime,
				totalElapsedSeconds: Math.round((Date.now() - startTime) / 1000),
			},
			'User data harvest completed successfully',
		);
	} catch (error) {
		Logger.error(
			{
				error,
				userId,
				harvestId,
				elapsed: Date.now() - startTime,
			},
			'Failed to harvest user data',
		);
		await progressReporter.markAsFailed(String(error));
		throw error;
	}
};

export default harvestUserData;
