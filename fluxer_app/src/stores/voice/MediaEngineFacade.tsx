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

import * as NavigationActionCreators from '@app/actions/NavigationActionCreators';
import * as SoundActionCreators from '@app/actions/SoundActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {parseStreamKey} from '@app/components/voice/StreamKeys';
import type {GatewayErrorData} from '@app/lib/GatewaySocket';
import {Logger} from '@app/lib/Logger';
import {voiceStatsDB} from '@app/lib/VoiceStatsDB';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import CallMediaPrefsStore from '@app/stores/CallMediaPrefsStore';
import ChannelStore from '@app/stores/ChannelStore';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import GuildStore from '@app/stores/GuildStore';
import GatewayConnectionStore from '@app/stores/gateway/GatewayConnectionStore';
import IdleStore from '@app/stores/IdleStore';
import LocalVoiceStateStore from '@app/stores/LocalVoiceStateStore';
import MediaPermissionStore from '@app/stores/MediaPermissionStore';
import UserStore from '@app/stores/UserStore';
import VoiceCallLayoutStore from '@app/stores/VoiceCallLayoutStore';
import VoiceSettingsStore from '@app/stores/VoiceSettingsStore';
import {
	checkChannelLimit,
	checkMultipleConnections,
	sendVoiceStateConnect,
	sendVoiceStateDisconnect,
} from '@app/stores/voice/VoiceChannelConnector';
import type {VoiceServerUpdateData} from '@app/stores/voice/VoiceConnectionManager';
import VoiceConnectionManager from '@app/stores/voice/VoiceConnectionManager';
import VoiceDevicePermissionStore from '@app/stores/voice/VoiceDevicePermissionStore';
import VoiceMediaManager from '@app/stores/voice/VoiceMediaManager';
import VoiceMediaStateCoordinator from '@app/stores/voice/VoiceMediaStateCoordinator';
import type {LivekitParticipantSnapshot} from '@app/stores/voice/VoiceParticipantManager';
import VoiceParticipantManager from '@app/stores/voice/VoiceParticipantManager';
import VoicePermissionManager from '@app/stores/voice/VoicePermissionManager';
import {bindRoomEvents} from '@app/stores/voice/VoiceRoomEventBinder';
import VoiceStateManager from '@app/stores/voice/VoiceStateManager';
import {VoiceStateSyncManager, type VoiceStateSyncPayload} from '@app/stores/voice/VoiceStateSyncManager';
import type {LatencyDataPoint, VoiceStats} from '@app/stores/voice/VoiceStatsManager';
import {VoiceStatsManager} from '@app/stores/voice/VoiceStatsManager';
import VoiceSubscriptionManager from '@app/stores/voice/VoiceSubscriptionManager';
import type {GuildReadyData} from '@app/types/gateway/GatewayGuildTypes';
import type {VoiceState} from '@app/types/gateway/GatewayVoiceTypes';
import {SoundType} from '@app/utils/SoundUtils';
import {ME} from '@fluxer/constants/src/AppConstants';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import type {GatewayErrorCode} from '@fluxer/constants/src/GatewayConstants';
import {GatewayErrorCodes} from '@fluxer/constants/src/GatewayConstants';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import type {Participant, Room, ScreenShareCaptureOptions, TrackPublishOptions} from 'livekit-client';
import {computed, makeObservable} from 'mobx';

const logger = new Logger('MediaEngineFacade');
const AFK_CHECK_INTERVAL_MS = 10000;
const DEFERRED_DISCONNECT_TIMEOUT_MS = 5000;

class MediaEngineFacade {
	private statsManager: VoiceStatsManager;
	private afkIntervalId: ReturnType<typeof setInterval> | null = null;
	private voiceStateSync = new VoiceStateSyncManager();
	private i18n: I18n | null = null;
	private pendingServerDisconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	private pendingServerDisconnectConnectionId: string | null = null;
	private activeConnection: {guildId: string | null; channelId: string | null} | null = null;
	private pendingUserMove: {guildId: string | null; channelId: string} | null = null;

	constructor() {
		this.statsManager = new VoiceStatsManager();
		makeObservable(this, {
			room: computed,
			guildId: computed,
			channelId: computed,
			connectionId: computed,
			connected: computed,
			connecting: computed,
			voiceServerEndpoint: computed,
			participants: computed,
			currentLatency: computed,
			averageLatency: computed,
			latencyHistory: computed,
			voiceStats: computed,
			displayLatency: computed,
			estimatedLatency: computed,
		});

		(window as typeof window & {_mediaEngineStore?: MediaEngineFacade})._mediaEngineStore = this;
		logger.debug('MediaEngineFacade initialized');
	}

	setI18n(i18n: I18n): void {
		this.i18n = i18n;
	}

	get room(): Room | null {
		return VoiceConnectionManager.room;
	}
	get guildId(): string | null {
		return VoiceConnectionManager.guildId;
	}
	get channelId(): string | null {
		return VoiceConnectionManager.channelId;
	}
	get connectionId(): string | null {
		return VoiceConnectionManager.connectionId;
	}
	get connected(): boolean {
		return VoiceConnectionManager.connected;
	}
	get connecting(): boolean {
		return VoiceConnectionManager.connecting;
	}
	get voiceServerEndpoint(): string | null {
		return VoiceConnectionManager.voiceServerEndpoint;
	}

	get participants(): Readonly<Record<string, LivekitParticipantSnapshot>> {
		return VoiceParticipantManager.participants;
	}

	get currentLatency(): number | null {
		return this.statsManager.currentLatency;
	}
	get averageLatency(): number | null {
		return this.statsManager.averageLatency;
	}
	get latencyHistory(): Array<LatencyDataPoint> {
		return this.statsManager.latencyHistory;
	}
	get voiceStats(): VoiceStats {
		return this.statsManager.voiceStats;
	}
	get estimatedLatency(): number | null {
		return this.statsManager.estimatedLatency;
	}
	get displayLatency(): number | null {
		return this.statsManager.displayLatency;
	}

	async connectToVoiceChannel(guildId: string | null, channelId: string): Promise<void> {
		VoiceCallLayoutStore.reset();
		const currentUserId = AuthenticationStore.currentUserId;
		const isTimedOut =
			guildId && currentUserId ? (GuildMemberStore.getMember(guildId, currentUserId)?.isTimedOut() ?? false) : false;
		if (isTimedOut) {
			if (!this.i18n) {
				throw new Error('MediaEngineFacade: i18n not initialized');
			}
			ToastActionCreators.createToast({
				type: 'error',
				children: this.i18n._(msg`You can't join while you're on timeout.`),
			});
			return;
		}
		const currentUser = UserStore.getCurrentUser();
		const isUnclaimed = !(currentUser?.isClaimed() ?? false);
		if (isUnclaimed) {
			if (!this.i18n) {
				throw new Error('MediaEngineFacade: i18n not initialized');
			}
			if (guildId) {
				const guild = GuildStore.getGuild(guildId);
				const isOwner = guild?.isOwner(currentUserId) ?? false;
				if (!isOwner) {
					ToastActionCreators.createToast({
						type: 'error',
						children: this.i18n._(msg`Claim your account to join voice channels you don't own.`),
					});
					return;
				}
			} else {
				const channel = ChannelStore.getChannel(channelId);
				if (channel?.type === ChannelTypes.DM) {
					ToastActionCreators.createToast({
						type: 'error',
						children: this.i18n._(msg`Claim your account to start or join 1:1 calls.`),
					});
					return;
				}
			}
		}
		if (!GatewayConnectionStore.socket) {
			logger.warn('No socket');
			return;
		}

		if (!checkChannelLimit(guildId, channelId)) return;

		this.voiceStateSync.reset();

		const shouldProceed = checkMultipleConnections(
			guildId,
			channelId,
			async () => this.connectDirectly(guildId, channelId),
			() => this.connectDirectly(guildId, channelId),
			() => VoiceConnectionManager.clearInFlightConnect(),
		);
		if (!shouldProceed) return;

		if (VoiceConnectionManager.connected || VoiceConnectionManager.connecting) {
			if (VoiceConnectionManager.channelId === channelId && VoiceConnectionManager.guildId === guildId) {
				return;
			}
			this.pendingUserMove = {guildId, channelId};
			this.disconnectForChannelMove('user');
		}

		VoiceConnectionManager.startConnection(guildId, channelId);
		this.navigateToVoiceChannel(guildId, channelId);
		sendVoiceStateConnect(guildId, channelId);
	}

	private connectDirectly(guildId: string | null, channelId: string): void {
		VoiceCallLayoutStore.reset();
		if (VoiceConnectionManager.connected || VoiceConnectionManager.connecting) {
			if (VoiceConnectionManager.channelId === channelId && VoiceConnectionManager.guildId === guildId) {
				return;
			}
			this.pendingUserMove = {guildId, channelId};
			this.disconnectForChannelMove('user');
		}
		this.voiceStateSync.reset();
		VoiceConnectionManager.startConnection(guildId, channelId);
		this.navigateToVoiceChannel(guildId, channelId);
		sendVoiceStateConnect(guildId, channelId);
	}

	async disconnectFromVoiceChannel(reason: 'user' | 'error' | 'server' = 'user'): Promise<void> {
		const {guildId, connectionId, connected, connecting, channelId} = VoiceConnectionManager.connectionState;
		if (!connected && !connecting && !channelId) return;

		logger.debug('Voice teardown starting', {guildId, channelId, reason});

		this.cancelPendingServerDisconnect();
		this.clearViewerStreamKeys();
		this.stopTracking();
		this.statsManager.reset();
		this.activeConnection = null;
		this.pendingUserMove = null;

		if (reason !== 'server' && connectionId) {
			sendVoiceStateDisconnect(guildId, connectionId);
		}

		if (reason === 'user') {
			SoundActionCreators.playSound(SoundType.VoiceDisconnect);
		}

		VoiceCallLayoutStore.reset();
		VoiceMediaStateCoordinator.resetLocalMediaState('disconnect');
		VoiceMediaManager.resetStreamTracking();
		VoiceParticipantManager.clear();
		this.voiceStateSync.reset();
		VoiceConnectionManager.disconnectFromVoiceChannel(reason);
		if (connectionId) CallMediaPrefsStore.clearForCall(connectionId);
		logger.info('Voice teardown complete', {channelId, reason});
	}

	private disconnectForChannelMove(reason: 'user' | 'server'): void {
		const {guildId, connectionId, connected, connecting, channelId} = VoiceConnectionManager.connectionState;
		if (!connected && !connecting && !channelId) return;

		logger.debug('Voice teardown for channel move', {guildId, channelId});

		this.cancelPendingServerDisconnect();
		this.clearViewerStreamKeys();
		this.stopTracking();
		this.statsManager.reset();
		this.activeConnection = null;
		if (reason === 'server') {
			this.pendingUserMove = null;
		}
		if (reason === 'user' && connectionId) {
			sendVoiceStateDisconnect(guildId, connectionId);
		}
		VoiceCallLayoutStore.reset();
		VoiceMediaStateCoordinator.resetLocalMediaState('disconnect');
		VoiceMediaManager.resetStreamTracking();
		VoiceParticipantManager.clear();
		this.voiceStateSync.reset();
		const disconnectReason = reason === 'server' ? 'user' : reason;
		VoiceConnectionManager.disconnectFromVoiceChannel(disconnectReason);
		if (connectionId) CallMediaPrefsStore.clearForCall(connectionId);
		SoundActionCreators.playSound(SoundType.UserMove);
	}

	private scheduleDeferredServerDisconnect(connectionId: string): void {
		this.cancelPendingServerDisconnect();
		this.pendingServerDisconnectConnectionId = connectionId;
		this.pendingServerDisconnectTimeout = setTimeout(() => {
			if (
				this.pendingServerDisconnectConnectionId === connectionId &&
				VoiceConnectionManager.connectionId === connectionId &&
				VoiceConnectionManager.connected
			) {
				logger.info('Deferred disconnect executing - no VOICE_SERVER_UPDATE received', {connectionId});
				void this.disconnectFromVoiceChannel('server');
			}
			this.pendingServerDisconnectTimeout = null;
			this.pendingServerDisconnectConnectionId = null;
		}, DEFERRED_DISCONNECT_TIMEOUT_MS);
		logger.debug('Scheduled deferred disconnect', {connectionId, timeoutMs: DEFERRED_DISCONNECT_TIMEOUT_MS});
	}

	private cancelPendingServerDisconnect(): void {
		if (this.pendingServerDisconnectTimeout) {
			clearTimeout(this.pendingServerDisconnectTimeout);
			this.pendingServerDisconnectTimeout = null;
			logger.debug('Cancelled pending server disconnect', {
				connectionId: this.pendingServerDisconnectConnectionId,
			});
		}
		this.pendingServerDisconnectConnectionId = null;
	}

	handleVoiceServerUpdate(raw: VoiceServerUpdateData): void {
		if (raw.connection_id && raw.connection_id === this.pendingServerDisconnectConnectionId) {
			this.cancelPendingServerDisconnect();
		}
		const expectedChannelId = VoiceConnectionManager.channelId;
		const currentVoiceState = raw.connection_id
			? VoiceStateManager.getVoiceStateByConnectionId(raw.connection_id)
			: null;
		if (
			VoiceConnectionManager.connected &&
			raw.channel_id &&
			currentVoiceState?.channel_id &&
			currentVoiceState.channel_id !== raw.channel_id
		) {
			logger.warn('Ignoring VOICE_SERVER_UPDATE that conflicts with known voice state', {
				expectedChannelId,
				incomingChannelId: raw.channel_id,
				connectionId: raw.connection_id,
				voiceStateChannelId: currentVoiceState.channel_id,
			});
			return;
		}
		if (
			raw.channel_id &&
			expectedChannelId &&
			raw.channel_id !== expectedChannelId &&
			this.pendingUserMove?.channelId === expectedChannelId &&
			VoiceConnectionManager.connecting
		) {
			logger.warn('Ignoring VOICE_SERVER_UPDATE during user-initiated move', {
				expectedChannelId,
				incomingChannelId: raw.channel_id,
				connectionId: raw.connection_id,
			});
			return;
		}
		const resolvedGuildId = raw.guild_id ?? VoiceConnectionManager.guildId ?? null;
		const resolvedChannelId = raw.channel_id ?? VoiceConnectionManager.channelId ?? null;
		const shouldPreserveLocalMedia =
			Boolean(this.activeConnection) &&
			this.activeConnection?.guildId === resolvedGuildId &&
			this.activeConnection?.channelId === resolvedChannelId;
		VoiceConnectionManager.handleVoiceServerUpdate(
			raw,
			(room, attemptId, guildId, channelId) => {
				bindRoomEvents(room, attemptId, guildId, channelId, {
					onConnected: async () => {
						this.activeConnection = {guildId, channelId};
						this.pendingUserMove = null;
						this.navigateToVoiceChannel(guildId, channelId);
						this.startTracking(room);
						if (shouldPreserveLocalMedia) {
							await this.restoreLocalMediaState();
						}
						this.syncLocalVoiceStateWithServer();
					},
					onDisconnected: () => {
						this.stopTracking();
						this.statsManager.reset();
					},
					onReconnecting: () => {
						this.statsManager.stopLatencyTracking();
						this.statsManager.stopStatsTracking();
					},
					onReconnected: () => {
						this.statsManager.startLatencyTracking();
						this.statsManager.startStatsTracking();
						this.voiceStateSync.reset();
						this.syncLocalVoiceStateWithServer();
					},
				});
			},
			(isChannelMove) => {
				this.cancelPendingServerDisconnect();
				this.stopTracking();
				if (isChannelMove) {
					this.statsManager.reset();
				}
				VoiceParticipantManager.clear();
				this.voiceStateSync.reset();
				if (!shouldPreserveLocalMedia && this.activeConnection) {
					VoiceMediaStateCoordinator.resetLocalMediaState('disconnect');
					VoiceMediaManager.resetStreamTracking();
				}
			},
		);
	}

	handleConnectionOpen(guilds: Array<GuildReadyData>): void {
		VoiceStateManager.handleConnectionOpen(guilds);
	}
	handleGuildCreate(guild: GuildReadyData): void {
		VoiceStateManager.handleGuildCreate(guild);
	}
	handleGuildDelete(guildId: string): void {
		VoiceStateManager.handleGuildDelete(guildId);
		if (VoiceConnectionManager.connected && VoiceConnectionManager.guildId === guildId) {
			void this.disconnectFromVoiceChannel('server');
		}
	}
	handlePassiveVoiceStates(guildId: string, voiceStates: Array<VoiceState>): void {
		for (const voiceState of voiceStates) {
			const stateWithGuild = {
				...voiceState,
				guild_id: voiceState.guild_id ?? guildId,
			};
			VoiceStateManager.handleGatewayVoiceStateUpdate(guildId, stateWithGuild);
		}
	}
	handleGatewayVoiceStateUpdate(guildId: string | null, voiceState: VoiceState): void {
		const user = UserStore.getCurrentUser();
		const isLocalConnection =
			user && voiceState.user_id === user.id && voiceState.connection_id === VoiceConnectionManager.connectionId;

		const previousLocalState = isLocalConnection
			? {
					selfVideo: LocalVoiceStateStore.getSelfVideo(),
					selfStream: LocalVoiceStateStore.getSelfStream(),
				}
			: null;

		const previousViewerStreamKeys = voiceState.connection_id
			? (VoiceStateManager.getVoiceStateByConnectionId(voiceState.connection_id)?.viewer_stream_keys ?? [])
			: [];

		VoiceStateManager.handleGatewayVoiceStateUpdate(guildId, voiceState);

		if (!isLocalConnection && VoiceConnectionManager.connected && voiceState.channel_id) {
			const newViewerStreamKeys = voiceState.viewer_stream_keys ?? [];
			if (JSON.stringify(previousViewerStreamKeys) !== JSON.stringify(newViewerStreamKeys)) {
				this.playSpectatorSounds(previousViewerStreamKeys, newViewerStreamKeys);
			}
		}

		if (isLocalConnection) {
			const currentConnectionId = VoiceConnectionManager.connectionId;
			const isCurrentConnection = voiceState.connection_id === currentConnectionId;
			const serverPayload =
				voiceState.channel_id && voiceState.connection_id
					? {
							guild_id: guildId,
							channel_id: voiceState.channel_id,
							connection_id: voiceState.connection_id,
							self_mute: voiceState.self_mute,
							self_deaf: voiceState.self_deaf,
							self_video: voiceState.self_video,
							self_stream: voiceState.self_stream,
							viewer_stream_keys: voiceState.viewer_stream_keys ?? [],
						}
					: null;
			this.voiceStateSync.confirmServerState(serverPayload);

			if (voiceState.channel_id && voiceState.connection_id) {
				if (isCurrentConnection && this.pendingServerDisconnectConnectionId === voiceState.connection_id) {
					this.cancelPendingServerDisconnect();
				}

				if (
					isCurrentConnection &&
					VoiceConnectionManager.connected &&
					!VoiceConnectionManager.connecting &&
					voiceState.channel_id !== VoiceConnectionManager.channelId
				) {
					const updatedGuildId = guildId ?? voiceState.guild_id ?? null;
					this.disconnectForChannelMove('server');
					VoiceConnectionManager.recoverConnectionExpectation(updatedGuildId, voiceState.channel_id);
				}

				const shouldRecoverConnectionExpectation =
					!VoiceConnectionManager.connected &&
					!VoiceConnectionManager.connecting &&
					VoiceConnectionManager.guildId === null &&
					VoiceConnectionManager.channelId === null;

				if (shouldRecoverConnectionExpectation) {
					const recoveredGuildId = guildId ?? voiceState.guild_id ?? null;
					VoiceConnectionManager.recoverConnectionExpectation(recoveredGuildId, voiceState.channel_id);
					logger.info('Recovered connection expectation from voice state update', {
						guildId: recoveredGuildId,
						channelId: voiceState.channel_id,
						connectionId: voiceState.connection_id,
					});
				}
			}

			if (previousLocalState) {
				const videoDisabled = previousLocalState.selfVideo && voiceState.self_video === false;
				const streamDisabled = previousLocalState.selfStream && voiceState.self_stream === false;

				if (videoDisabled) {
					logger.info('Server disabled camera for local connection, unpublishing video track');
					void this.setCameraEnabled(false, {sendUpdate: false});
				}

				if (streamDisabled) {
					logger.info('Server disabled screen share for local connection, unpublishing stream track');
					void this.setScreenShareEnabled(false, {sendUpdate: false});
				}
			}

			if (
				voiceState.channel_id === null &&
				VoiceConnectionManager.connected &&
				voiceState.connection_id &&
				isCurrentConnection
			) {
				this.scheduleDeferredServerDisconnect(voiceState.connection_id);
			}
		}
	}
	handleGatewayVoiceStateDelete(guildId: string, userId: string): void {
		VoiceStateManager.handleGatewayVoiceStateDelete(guildId, userId);
	}
	getCurrentUserVoiceState(guildId?: string | null): VoiceState | null {
		return VoiceStateManager.getCurrentUserVoiceState(
			guildId,
			UserStore.getCurrentUser()?.id,
			VoiceConnectionManager.connectionId,
		);
	}
	getVoiceState(guildId: string | null, userId?: string): VoiceState | null {
		return VoiceStateManager.getVoiceState(guildId, userId, UserStore.getCurrentUser()?.id);
	}
	getVoiceStateByConnectionId(connectionId: string): VoiceState | null {
		return VoiceStateManager.getVoiceStateByConnectionId(connectionId);
	}
	getAllVoiceStatesInChannel(guildId: string, channelId: string): Readonly<Record<string, VoiceState>> {
		return VoiceStateManager.getAllVoiceStatesInChannel(guildId, channelId);
	}
	getAllVoiceStates(): Readonly<Record<string, Readonly<Record<string, Readonly<Record<string, VoiceState>>>>>> {
		return VoiceStateManager.getAllVoiceStates();
	}

	syncLocalVoiceStateWithServer(partial?: {
		self_video?: boolean;
		self_stream?: boolean;
		self_mute?: boolean;
		self_deaf?: boolean;
		viewer_stream_keys?: Array<string>;
	}): void {
		LocalVoiceStateStore.ensurePermissionMute();
		const {guildId, channelId, connectionId} = VoiceConnectionManager.connectionState;
		if (!channelId || !connectionId) return;

		const devicePermission = VoiceDevicePermissionStore.getState().permissionStatus;
		const micGranted = MediaPermissionStore.isMicrophoneGranted() || devicePermission === 'granted';

		const payload: VoiceStateSyncPayload = {
			guild_id: guildId,
			channel_id: channelId,
			connection_id: connectionId,
			self_mute:
				micGranted && partial?.self_mute !== undefined
					? partial.self_mute
					: micGranted
						? LocalVoiceStateStore.getSelfMute()
						: true,
			self_deaf: partial?.self_deaf ?? LocalVoiceStateStore.getSelfDeaf(),
			self_video: partial?.self_video ?? LocalVoiceStateStore.getSelfVideo(),
			self_stream: partial?.self_stream ?? LocalVoiceStateStore.getSelfStream(),
			viewer_stream_keys: partial?.viewer_stream_keys ?? LocalVoiceStateStore.getViewerStreamKeys(),
		};

		if (!micGranted && !LocalVoiceStateStore.getSelfMute()) {
			LocalVoiceStateStore.updateSelfMute(true);
		}

		this.voiceStateSync.requestState(payload);
	}

	getParticipantByUserIdAndConnectionId(
		userId: string,
		connectionId: string | null,
	): LivekitParticipantSnapshot | undefined {
		return VoiceParticipantManager.getParticipantByUserIdAndConnectionId(userId, connectionId);
	}
	upsertParticipant(participant: Participant): void {
		VoiceParticipantManager.upsertParticipant(participant);
	}

	async setCameraEnabled(enabled: boolean, options?: {deviceId?: string; sendUpdate?: boolean}): Promise<void> {
		await VoiceMediaManager.setCameraEnabled(enabled, options);
	}
	async setScreenShareEnabled(
		enabled: boolean,
		options?: ScreenShareCaptureOptions & {sendUpdate?: boolean; playSound?: boolean; restartIfEnabled?: boolean},
		publishOptions?: TrackPublishOptions,
	): Promise<void> {
		await VoiceMediaManager.setScreenShareEnabled(enabled, options, publishOptions);
	}
	async updateActiveScreenShareSettings(
		options?: ScreenShareCaptureOptions,
		publishOptions?: TrackPublishOptions,
	): Promise<boolean> {
		return VoiceMediaManager.updateActiveScreenShareSettings(options, publishOptions);
	}
	applyLocalAudioPreferencesForUser(userId: string): void {
		VoiceMediaManager.applyLocalAudioPreferencesForUser(userId, this.room);
	}
	applyAllLocalAudioPreferences(): void {
		VoiceMediaManager.applyAllLocalAudioPreferences(this.room);
	}
	applyLocalInputVolume(): void {
		VoiceMediaManager.applyLocalInputVolume(this.room);
	}
	setLocalVideoDisabled(identity: string, disabled: boolean): void {
		VoiceMediaManager.setLocalVideoDisabled(identity, disabled, this.room, this.connectionId);
	}
	applyPushToTalkHold(held: boolean): void {
		VoiceMediaManager.applyPushToTalkHold(held, this.room, () => this.getCurrentUserVoiceState());
	}
	handlePushToTalkModeChange(): void {
		VoiceMediaManager.handlePushToTalkModeChange(this.room, () => this.getCurrentUserVoiceState());
	}
	getMuteReason(voiceState: VoiceState | null): 'guild' | 'push_to_talk' | 'self' | null {
		return VoiceMediaManager.getMuteReason(voiceState);
	}
	async toggleCameraFromKeybind(): Promise<void> {
		await VoiceMediaManager.toggleCameraFromKeybind();
	}
	async toggleScreenShareFromKeybind(): Promise<void> {
		await VoiceMediaManager.toggleScreenShareFromKeybind();
	}

	private startTracking(roomOverride?: Room | null): void {
		const room = roomOverride ?? VoiceConnectionManager.room;
		if (!room) {
			logger.warn('No room available');
			return;
		}

		this.statsManager.setRoom(room);
		this.statsManager.startLatencyTracking();
		this.statsManager.startStatsTracking();
		VoiceSubscriptionManager.setRoom(room);
		VoicePermissionManager.initializeSubscriptions(room);
		this.startAfkTracking();
		logger.info('All tracking started');
	}

	private stopTracking(): void {
		this.statsManager.stopLatencyTracking();
		this.statsManager.stopStatsTracking();
		VoiceSubscriptionManager.cleanup();
		this.stopAfkTracking();
		logger.info('All tracking stopped');
	}

	private startAfkTracking(): void {
		this.stopAfkTracking();
		this.afkIntervalId = setInterval(() => {
			if (!VoiceConnectionManager.connected || !VoiceConnectionManager.guildId || !VoiceConnectionManager.channelId)
				return;
			if (!IdleStore.isIdle()) return;
			const idleSince = IdleStore.getIdleSince();
			if (!idleSince) return;
			const guild = GuildStore.getGuild(VoiceConnectionManager.guildId);
			if (!guild?.afkChannelId || !guild.afkTimeout) return;
			if (VoiceConnectionManager.channelId === guild.afkChannelId) return;
			if (Math.floor((Date.now() - idleSince) / 1000) >= guild.afkTimeout) {
				void this.moveToAfkChannel();
			}
		}, AFK_CHECK_INTERVAL_MS);
	}

	private stopAfkTracking(): void {
		if (this.afkIntervalId !== null) {
			clearInterval(this.afkIntervalId);
			this.afkIntervalId = null;
		}
	}

	private playSpectatorSounds(oldStreamKeys: Array<string>, newStreamKeys: Array<string>): void {
		const myConnectionId = VoiceConnectionManager.connectionId;
		if (!myConnectionId) return;

		const myViewerStreamKeys = LocalVoiceStateStore.getViewerStreamKeys();

		const isRelevantStream = (key: string): boolean => {
			const parsed = parseStreamKey(key);
			if (!parsed) return false;
			if (parsed.connectionId === myConnectionId) return true;
			if (myViewerStreamKeys.includes(key)) return true;
			return false;
		};

		const oldRelevant = new Set(oldStreamKeys.filter(isRelevantStream));
		const newRelevant = new Set(newStreamKeys.filter(isRelevantStream));

		const joined = newStreamKeys.filter((k) => isRelevantStream(k) && !oldRelevant.has(k));
		const left = oldStreamKeys.filter((k) => isRelevantStream(k) && !newRelevant.has(k));

		if (joined.length > 0) {
			SoundActionCreators.playSound(SoundType.ViewerJoin);
		} else if (left.length > 0) {
			SoundActionCreators.playSound(SoundType.ViewerLeave);
		}
	}

	disconnectRemoteDevice(guildId: string, connectionId: string): void {
		sendVoiceStateDisconnect(guildId, connectionId);
	}

	disconnectAllRemoteDevices(devices: ReadonlyArray<{guildId: string; connectionId: string}>): void {
		for (const device of devices) {
			sendVoiceStateDisconnect(device.guildId, device.connectionId);
		}
	}

	async moveToAfkChannel(): Promise<void> {
		const {guildId, channelId, connected} = VoiceConnectionManager.connectionState;
		if (!connected || !guildId || !channelId) return;
		const guild = GuildStore.getGuild(guildId);
		if (!guild?.afkChannelId || channelId === guild.afkChannelId) return;
		SoundActionCreators.playSound(SoundType.UserMove);
		await this.connectToVoiceChannel(guildId, guild.afkChannelId);
	}

	getLastConnectedChannel(): {guildId: string; channelId: string} | null {
		return VoiceConnectionManager.lastConnectedChannel;
	}
	getShouldReconnect(): boolean {
		return VoiceConnectionManager.shouldAutoReconnect;
	}
	markReconnectionAttempted(): void {
		VoiceConnectionManager.markReconnectionAttempted();
	}

	async handleLogout(): Promise<void> {
		this.cancelPendingServerDisconnect();
		this.clearViewerStreamKeys();
		this.stopTracking();
		this.activeConnection = null;
		this.pendingUserMove = null;
		VoiceConnectionManager.cleanup();
		VoiceStateManager.clearAllVoiceStates();
		VoiceParticipantManager.clear();
		VoicePermissionManager.reset();
		VoiceMediaManager.resetStreamTracking();
		VoiceMediaStateCoordinator.resetLocalMediaState('logout');
		this.voiceStateSync.reset();

		try {
			await voiceStatsDB.clear();
		} catch (error) {
			logger.error('Failed to clear voice stats DB during logout', error);
			throw error;
		} finally {
			logger.info('Cleanup complete');
		}
	}

	handleGatewayError(error: GatewayErrorData): void {
		const voiceErrorCodes = new Set<GatewayErrorCode>([
			GatewayErrorCodes.VOICE_CONNECTION_NOT_FOUND,
			GatewayErrorCodes.VOICE_CHANNEL_NOT_FOUND,
			GatewayErrorCodes.VOICE_INVALID_CHANNEL_TYPE,
			GatewayErrorCodes.VOICE_MEMBER_NOT_FOUND,
			GatewayErrorCodes.VOICE_MEMBER_TIMED_OUT,
			GatewayErrorCodes.VOICE_USER_NOT_IN_VOICE,
			GatewayErrorCodes.VOICE_GUILD_NOT_FOUND,
			GatewayErrorCodes.VOICE_PERMISSION_DENIED,
			GatewayErrorCodes.VOICE_CHANNEL_FULL,
			GatewayErrorCodes.VOICE_MISSING_CONNECTION_ID,
			GatewayErrorCodes.VOICE_TOKEN_FAILED,
			GatewayErrorCodes.VOICE_UNCLAIMED_ACCOUNT,
		]);

		if (!voiceErrorCodes.has(error.code)) {
			return;
		}

		logger.warn(`Voice-related gateway error: [${error.code}] ${error.message}`);

		if (error.code === GatewayErrorCodes.VOICE_CONNECTION_NOT_FOUND) {
			if (VoiceConnectionManager.connecting) {
				logger.info('Connection not found while connecting, aborting');
				VoiceConnectionManager.abortConnection();
			}
		} else if (
			error.code === GatewayErrorCodes.VOICE_PERMISSION_DENIED ||
			error.code === GatewayErrorCodes.VOICE_CHANNEL_FULL ||
			error.code === GatewayErrorCodes.VOICE_MEMBER_TIMED_OUT ||
			error.code === GatewayErrorCodes.VOICE_UNCLAIMED_ACCOUNT
		) {
			if (VoiceConnectionManager.connecting && !VoiceConnectionManager.connected) {
				logger.info('Permission denied, channel full, or timeout while connecting, aborting');
				VoiceConnectionManager.abortConnection();
			}
			if (error.code === GatewayErrorCodes.VOICE_MEMBER_TIMED_OUT) {
				if (!this.i18n) {
					throw new Error('MediaEngineFacade: i18n not initialized');
				}
				ToastActionCreators.createToast({
					type: 'error',
					children: this.i18n._(msg`You can't join while you're on timeout.`),
				});
			} else if (error.code === GatewayErrorCodes.VOICE_UNCLAIMED_ACCOUNT) {
				if (!this.i18n) {
					throw new Error('MediaEngineFacade: i18n not initialized');
				}
				ToastActionCreators.createToast({
					type: 'error',
					children: this.i18n._(msg`Claim your account to join this voice channel.`),
				});
			}
		} else if (error.code === GatewayErrorCodes.VOICE_TOKEN_FAILED) {
			if (VoiceConnectionManager.connecting) {
				logger.info('Token failed while connecting, aborting');
				VoiceConnectionManager.abortConnection();
			}
		}
	}

	cleanup(): void {
		this.cancelPendingServerDisconnect();
		this.clearViewerStreamKeys();
		this.stopTracking();
		this.activeConnection = null;
		this.pendingUserMove = null;
		this.statsManager.cleanup();
		VoiceSubscriptionManager.cleanup();
		VoicePermissionManager.reset();
		VoiceMediaManager.resetStreamTracking();
		VoiceConnectionManager.cleanup();
		VoiceStateManager.clearAllVoiceStates();
		VoiceParticipantManager.clear();
		VoiceMediaStateCoordinator.resetLocalMediaState('cleanup');
		this.voiceStateSync.reset();
	}

	reset(): void {
		this.cancelPendingServerDisconnect();
		this.clearViewerStreamKeys();
		this.statsManager.reset();
		this.activeConnection = null;
		this.pendingUserMove = null;
		VoiceConnectionManager.resetConnectionState();
		VoiceConnectionManager.resetReconnectState();
		VoicePermissionManager.reset();
		VoiceMediaManager.resetStreamTracking();
		VoiceParticipantManager.clear();
		VoiceMediaStateCoordinator.resetLocalMediaState('cleanup');
		this.voiceStateSync.reset();
	}

	private async restoreLocalMediaState(): Promise<void> {
		const room = VoiceConnectionManager.room;
		const participant = room?.localParticipant ?? null;
		if (!participant) return;

		if (LocalVoiceStateStore.getSelfVideo() && !participant.isCameraEnabled) {
			await VoiceMediaManager.setCameraEnabled(true, {
				deviceId: VoiceSettingsStore.getVideoDeviceId(),
				sendUpdate: false,
			});
		}

		if (LocalVoiceStateStore.getSelfStream() && !participant.isScreenShareEnabled) {
			try {
				await VoiceMediaManager.setScreenShareEnabled(true, {sendUpdate: false});
			} catch (error) {
				logger.warn('Failed to restore screen share', {error});
				VoiceMediaStateCoordinator.applyScreenShareState(false, {reason: 'server', sendUpdate: false});
			}
		}
	}

	private navigateToVoiceChannel(guildId: string | null, channelId: string): void {
		const targetGuildId = guildId ?? ME;
		NavigationActionCreators.selectChannel(targetGuildId, channelId);
	}

	private clearViewerStreamKeys(): void {
		if (LocalVoiceStateStore.getViewerStreamKeys().length === 0) {
			return;
		}
		LocalVoiceStateStore.updateViewerStreamKeys([]);
	}
}

const instance = new MediaEngineFacade();
(window as typeof window & {_mediaEngineFacade?: MediaEngineFacade})._mediaEngineFacade = instance;
export default instance;
