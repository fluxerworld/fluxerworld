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

import type {ChannelID, GuildID, UserID} from '@fluxer/api/src/BrandedTypes';
import {createUserID} from '@fluxer/api/src/BrandedTypes';
import type {ILogger} from '@fluxer/api/src/ILogger';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {ILiveKitService} from '@fluxer/api/src/infrastructure/ILiveKitService';
import type {IMetricsService} from '@fluxer/api/src/infrastructure/IMetricsService';
import {parseParticipantIdentity, parseRoomName} from '@fluxer/api/src/infrastructure/VoiceRoomContext';
import type {VoiceRoomStore} from '@fluxer/api/src/infrastructure/VoiceRoomStore';
import type {IKVProvider} from '@fluxer/kv_client/src/IKVProvider';

interface GatewayVoiceStateEntry {
	readonly connectionId: string;
	readonly userId: string;
	readonly channelId: string;
}

interface GatewayPendingJoinEntry {
	readonly connectionId: string;
	readonly userId: string;
	readonly tokenNonce: string;
	readonly expiresAt: number;
}

interface VoiceReconciliationWorkerOptions {
	gatewayService: IGatewayService;
	liveKitService: ILiveKitService;
	voiceRoomStore: VoiceRoomStore;
	kvClient: IKVProvider;
	metricsService: IMetricsService;
	logger: ILogger;
	intervalMs?: number;
	staggerDelayMs?: number;
}

interface RoomReconciliationResult {
	readonly roomName: string;
	readonly livekitOnlyConfirmed: number;
	readonly livekitOnlyDisconnected: number;
	readonly gatewayOnlyRemoved: number;
	readonly consistent: number;
}

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_STAGGER_DELAY_MS = 100;
const ROOM_KEY_PREFIX = 'voice:room:server:';

export class VoiceReconciliationWorker {
	private readonly gatewayService: IGatewayService;
	private readonly liveKitService: ILiveKitService;
	private readonly voiceRoomStore: VoiceRoomStore;
	private readonly kvClient: IKVProvider;
	private readonly metricsService: IMetricsService;
	private readonly logger: ILogger;
	private readonly intervalMs: number;
	private readonly staggerDelayMs: number;
	private intervalHandle: ReturnType<typeof setInterval> | null = null;
	private reconciling = false;

	constructor(options: VoiceReconciliationWorkerOptions) {
		this.gatewayService = options.gatewayService;
		this.liveKitService = options.liveKitService;
		this.voiceRoomStore = options.voiceRoomStore;
		this.kvClient = options.kvClient;
		this.metricsService = options.metricsService;
		this.logger = options.logger.child({worker: 'VoiceReconciliationWorker'});
		this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
		this.staggerDelayMs = options.staggerDelayMs ?? DEFAULT_STAGGER_DELAY_MS;
	}

	start(): void {
		if (this.intervalHandle) {
			this.logger.warn('VoiceReconciliationWorker is already running');
			return;
		}

		this.logger.info({intervalMs: this.intervalMs}, 'Starting VoiceReconciliationWorker');

		this.runReconciliation();

		this.intervalHandle = setInterval(() => {
			this.runReconciliation();
		}, this.intervalMs);
	}

	stop(): void {
		if (this.intervalHandle) {
			clearInterval(this.intervalHandle);
			this.intervalHandle = null;
			this.logger.info('Stopped VoiceReconciliationWorker');
		}
	}

	async reconcile(): Promise<void> {
		const startTime = Date.now();
		const roomNames = await this.discoverActiveRooms();

		this.logger.info({roomCount: roomNames.length}, 'Starting reconciliation sweep');

		let roomsChecked = 0;
		let totalConfirmed = 0;
		let totalDisconnected = 0;
		let totalGatewayRemoved = 0;
		let totalConsistent = 0;
		let totalErrors = 0;

		for (const roomName of roomNames) {
			try {
				const result = await this.reconcileRoom(roomName);
				roomsChecked++;
				totalConfirmed += result.livekitOnlyConfirmed;
				totalDisconnected += result.livekitOnlyDisconnected;
				totalGatewayRemoved += result.gatewayOnlyRemoved;
				totalConsistent += result.consistent;
			} catch (error) {
				totalErrors++;
				this.logger.error({error, roomName}, 'Failed to reconcile room');
			}

			if (this.staggerDelayMs > 0) {
				await new Promise((resolve) => setTimeout(resolve, this.staggerDelayMs));
			}
		}

		const durationMs = Date.now() - startTime;

		this.metricsService.gauge({name: 'fluxer.voice.reconcile.rooms_checked', value: roomsChecked});
		this.metricsService.counter({name: 'fluxer.voice.reconcile.livekit_only_confirmed', value: totalConfirmed});
		this.metricsService.counter({name: 'fluxer.voice.reconcile.livekit_only_disconnected', value: totalDisconnected});
		this.metricsService.counter({name: 'fluxer.voice.reconcile.gateway_only_removed', value: totalGatewayRemoved});
		this.metricsService.gauge({name: 'fluxer.voice.reconcile.consistent', value: totalConsistent});
		this.metricsService.counter({name: 'fluxer.voice.reconcile.errors', value: totalErrors});
		this.metricsService.histogram({name: 'fluxer.voice.reconcile.sweep_duration', valueMs: durationMs});

		this.logger.info(
			{
				roomsChecked,
				totalConfirmed,
				totalDisconnected,
				totalGatewayRemoved,
				totalConsistent,
				totalErrors,
				durationMs,
			},
			'Reconciliation sweep complete',
		);
	}

	private runReconciliation(): void {
		if (this.reconciling) {
			this.logger.warn('Skipping reconciliation sweep; previous sweep still in progress');
			return;
		}

		this.reconciling = true;
		this.reconcile()
			.catch((error) => {
				this.logger.error({error}, 'Reconciliation sweep failed unexpectedly');
			})
			.finally(() => {
				this.reconciling = false;
			});
	}

	private async discoverActiveRooms(): Promise<Array<string>> {
		const keys = await this.kvClient.scan(`${ROOM_KEY_PREFIX}*`, 1000);
		const roomNames: Array<string> = [];

		for (const key of keys) {
			const suffix = key.slice(ROOM_KEY_PREFIX.length);

			if (suffix.startsWith('guild:')) {
				const parts = suffix.split(':');
				if (parts.length === 3) {
					const guildId = parts[1];
					const channelId = parts[2];
					roomNames.push(`guild_${guildId}_channel_${channelId}`);
				}
			} else if (suffix.startsWith('dm:')) {
				const channelId = suffix.slice(3);
				roomNames.push(`dm_channel_${channelId}`);
			}
		}

		return roomNames;
	}

	private async reconcileRoom(roomName: string): Promise<RoomReconciliationResult> {
		const roomContext = parseRoomName(roomName);
		if (!roomContext) {
			this.logger.warn({roomName}, 'Could not parse room name; skipping');
			return {roomName, livekitOnlyConfirmed: 0, livekitOnlyDisconnected: 0, gatewayOnlyRemoved: 0, consistent: 0};
		}
		const guildId = roomContext.type === 'guild' ? roomContext.guildId : undefined;
		const channelId = roomContext.channelId;

		const pinnedServer = await this.voiceRoomStore.getPinnedRoomServer(guildId, channelId);
		if (!pinnedServer) {
			this.logger.debug({roomName}, 'No pinned server for room; skipping');
			return {roomName, livekitOnlyConfirmed: 0, livekitOnlyDisconnected: 0, gatewayOnlyRemoved: 0, consistent: 0};
		}

		const {regionId, serverId} = pinnedServer;

		const listResult = await this.liveKitService.listParticipants({
			guildId,
			channelId,
			regionId,
			serverId,
		});

		if (listResult.status === 'error') {
			this.logger.warn({roomName, errorCode: listResult.errorCode}, 'Failed to list LiveKit participants');
			throw new Error(`LiveKit listParticipants failed for ${roomName}: ${listResult.errorCode}`);
		}

		const livekitParticipants = listResult.participants;

		const [{voiceStates}, {pendingJoins}] = await Promise.all([
			this.gatewayService.getVoiceStatesForChannel({guildId, channelId}),
			this.gatewayService.getPendingJoinsForChannel({guildId, channelId}),
		]);

		const gatewayConnectionIds = new Set<string>();
		for (const vs of voiceStates) {
			gatewayConnectionIds.add(vs.connectionId);
		}

		const pendingJoinByConnectionId = new Map<string, GatewayPendingJoinEntry>();
		for (const pj of pendingJoins) {
			pendingJoinByConnectionId.set(pj.connectionId, pj);
		}

		const livekitConnectionIds = new Set<string>();

		let livekitOnlyConfirmed = 0;
		let livekitOnlyDisconnected = 0;
		let consistent = 0;

		for (const participant of livekitParticipants) {
			const parsed = parseParticipantIdentity(participant.identity);
			if (!parsed) {
				this.logger.warn({roomName, identity: participant.identity}, 'Could not parse participant identity; skipping');
				continue;
			}

			const {userId, connectionId} = parsed;
			livekitConnectionIds.add(connectionId);

			if (gatewayConnectionIds.has(connectionId)) {
				consistent++;
				continue;
			}

			const pendingJoin = pendingJoinByConnectionId.get(connectionId);
			if (pendingJoin && pendingJoin.expiresAt > Date.now()) {
				await this.confirmPendingJoin(guildId, channelId, connectionId, pendingJoin, roomName);
				livekitOnlyConfirmed++;
			} else {
				await this.evictFromLiveKit(userId, guildId, channelId, connectionId, regionId, serverId, roomName);
				livekitOnlyDisconnected++;
			}
		}

		let gatewayOnlyRemoved = 0;
		for (const vs of voiceStates) {
			if (!livekitConnectionIds.has(vs.connectionId)) {
				await this.removeGhostState(guildId, vs, channelId, roomName);
				gatewayOnlyRemoved++;
			}
		}

		if (livekitOnlyConfirmed > 0 || livekitOnlyDisconnected > 0 || gatewayOnlyRemoved > 0) {
			this.logger.info(
				{roomName, livekitOnlyConfirmed, livekitOnlyDisconnected, gatewayOnlyRemoved, consistent},
				'Room reconciliation found divergence',
			);
		}

		return {roomName, livekitOnlyConfirmed, livekitOnlyDisconnected, gatewayOnlyRemoved, consistent};
	}

	private async confirmPendingJoin(
		guildId: GuildID | undefined,
		channelId: ChannelID,
		connectionId: string,
		pendingJoin: GatewayPendingJoinEntry,
		roomName: string,
	): Promise<void> {
		try {
			const result = await this.gatewayService.confirmVoiceConnection({
				guildId,
				channelId,
				connectionId,
				tokenNonce: pendingJoin.tokenNonce,
			});

			if (!result.success) {
				this.logger.warn(
					{roomName, connectionId, error: result.error},
					'Gateway rejected voice connection confirmation',
				);
			}
		} catch (error) {
			this.logger.error({error, roomName, connectionId}, 'Failed to confirm pending voice connection');
		}
	}

	private async evictFromLiveKit(
		userId: UserID,
		guildId: GuildID | undefined,
		channelId: ChannelID,
		connectionId: string,
		regionId: string,
		serverId: string,
		roomName: string,
	): Promise<void> {
		try {
			this.logger.info(
				{roomName, userId: userId.toString(), connectionId},
				'Evicting orphaned participant from LiveKit',
			);

			await this.liveKitService.disconnectParticipant({
				userId,
				guildId,
				channelId,
				connectionId,
				regionId,
				serverId,
			});
		} catch (error) {
			this.logger.error({error, roomName, connectionId}, 'Failed to evict participant from LiveKit');
		}
	}

	private async removeGhostState(
		guildId: GuildID | undefined,
		voiceState: GatewayVoiceStateEntry,
		channelId: ChannelID,
		roomName: string,
	): Promise<void> {
		try {
			this.logger.info(
				{roomName, userId: voiceState.userId, connectionId: voiceState.connectionId},
				'Removing ghost voice state from gateway',
			);

			const result = await this.gatewayService.disconnectVoiceUserIfInChannel({
				guildId,
				channelId,
				userId: createUserID(BigInt(voiceState.userId)),
				connectionId: voiceState.connectionId,
			});

			if (result.ignored) {
				this.logger.debug(
					{roomName, userId: voiceState.userId, connectionId: voiceState.connectionId},
					'Gateway ignored ghost state removal (user may have moved)',
				);
			}
		} catch (error) {
			this.logger.error(
				{error, roomName, userId: voiceState.userId, connectionId: voiceState.connectionId},
				'Failed to remove ghost voice state from gateway',
			);
		}
	}
}
