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

import {Logger} from '@app/lib/Logger';
import {VoiceConnectionThrottle} from '@app/stores/voice/VoiceConnectionThrottle';
import {VoiceReconnectManager} from '@app/stores/voice/VoiceReconnectManager';
import type {Room} from 'livekit-client';
import {Room as LiveKitRoom, RoomEvent} from 'livekit-client';
import {makeAutoObservable, runInAction} from 'mobx';
import type {Subscription} from 'rxjs';
import {timer} from 'rxjs';

const logger = new Logger('VoiceConnectionManager');

const VOICE_SERVER_TIMEOUT_MS = 5000;

export interface VoiceServerUpdateData {
	token: string;
	endpoint: string;
	connection_id: string;
	guild_id?: string;
	channel_id?: string;
}

export interface VoiceConnectionState {
	room: Room | null;
	guildId: string | null;
	channelId: string | null;
	connecting: boolean;
	connected: boolean;
	reconnecting: boolean;
	voiceServerEndpoint: string | null;
	connectionId: string | null;
}

const initialConnectionState: VoiceConnectionState = {
	room: null,
	guildId: null,
	channelId: null,
	connecting: false,
	connected: false,
	reconnecting: false,
	voiceServerEndpoint: null,
	connectionId: null,
};

class VoiceConnectionManager {
	connectionState: VoiceConnectionState = initialConnectionState;
	private throttle = new VoiceConnectionThrottle();
	private reconnect = new VoiceReconnectManager();
	private voiceServerTimeoutSub: Subscription | null = null;
	private isLocalDisconnecting = false;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
	}

	get room(): Room | null {
		return this.connectionState.room;
	}

	get guildId(): string | null {
		return this.connectionState.guildId;
	}

	get channelId(): string | null {
		return this.connectionState.channelId;
	}

	get connected(): boolean {
		return this.connectionState.connected;
	}

	get connecting(): boolean {
		return this.connectionState.connecting;
	}

	get reconnecting(): boolean {
		return this.connectionState.reconnecting;
	}

	get connectionId(): string | null {
		return this.connectionState.connectionId;
	}

	get voiceServerEndpoint(): string | null {
		return this.connectionState.voiceServerEndpoint;
	}

	get shouldAutoReconnect(): boolean {
		return this.reconnect.shouldAutoReconnect;
	}

	get reconnectAttempts(): number {
		return this.reconnect.reconnectAttempts;
	}

	get disconnecting(): boolean {
		return this.isLocalDisconnecting;
	}

	get lastConnectedChannel(): {guildId: string; channelId: string} | null {
		return this.reconnect.lastConnectedChannel;
	}

	startConnection(guildId: string | null, channelId: string): void {
		if (this.throttle.shouldThrottle()) {
			logger.warn('Connection throttled');
			return;
		}

		this.throttle.recordConnectRequest();
		this.throttle.incrementAttemptId();

		runInAction(() => {
			this.connectionState = {
				...this.connectionState,
				channelId,
				guildId,
				connecting: true,
				connected: false,
				reconnecting: false,
				connectionId: this.connectionState.connectionId,
			};
		});

		this.throttle.setInFlightConnect(true);
		this.scheduleVoiceServerTimeout(guildId, channelId);
		this.reconnect.setLastConnectedChannel(guildId, channelId);

		logger.info('Connection started', {guildId, channelId});
	}

	recoverConnectionExpectation(guildId: string | null, channelId: string): void {
		this.throttle.recordConnectRequest();
		this.throttle.incrementAttemptId();

		runInAction(() => {
			this.connectionState = {
				...this.connectionState,
				channelId,
				guildId,
				connecting: true,
				connected: false,
				reconnecting: false,
				connectionId: this.connectionState.connectionId,
			};
		});

		this.throttle.setInFlightConnect(true);
		this.scheduleVoiceServerTimeout(guildId, channelId);
		this.reconnect.setLastConnectedChannel(guildId, channelId);

		logger.info('Connection expectation recovered', {guildId, channelId});
	}

	handleVoiceServerUpdate(
		raw: VoiceServerUpdateData,
		onRoomCreated: (room: Room, attemptId: number, guildId: string | null, channelId: string) => void,
		onBeforeReconnect?: (isChannelMove: boolean) => void,
	): void {
		const guildId = raw.guild_id ?? null;
		const endpoint = raw.endpoint ?? null;
		const token = raw.token ?? null;
		const connectionId = raw.connection_id ?? null;
		const incomingChannelId = raw.channel_id ?? null;

		const {
			guildId: expectedGuildId,
			channelId: expectedChannelId,
			connected,
			room: existingRoom,
		} = this.connectionState;
		const attemptId = this.throttle.connectAttemptId;

		logger.debug('handleVoiceServerUpdate called', {
			incomingGuildId: guildId,
			expectedGuildId,
			incomingChannelId,
			expectedChannelId,
			endpoint,
			hasToken: !!token,
			connectionId,
			attemptId,
		});

		if (expectedGuildId !== guildId || expectedChannelId == null) {
			logger.warn('Ignoring VOICE_SERVER_UPDATE: guild or channel mismatch', {
				expectedGuildId,
				incomingGuildId: guildId,
				expectedChannelId,
				incomingChannelId,
			});
			return;
		}

		const isChannelMove = !!(incomingChannelId && incomingChannelId !== expectedChannelId);

		if (isChannelMove) {
			if (connected) {
				logger.info('VOICE_SERVER_UPDATE: server-initiated channel move', {
					expectedChannelId,
					incomingChannelId,
					connectionId,
				});
			} else {
				logger.warn('Ignoring VOICE_SERVER_UPDATE: stale channel update', {
					expectedChannelId,
					incomingChannelId,
					connectionId,
				});
				return;
			}
		}

		if (!this.throttle.isLatestAttempt(attemptId)) {
			logger.warn('Ignoring VOICE_SERVER_UPDATE: not latest attempt', {attemptId});
			return;
		}

		const resolvedChannelId = incomingChannelId ?? expectedChannelId;

		this.clearVoiceServerTimeout();

		let previousRoom = connected && existingRoom ? existingRoom : null;

		if (previousRoom) {
			onBeforeReconnect?.(isChannelMove);
			previousRoom.removeAllListeners();
			if (isChannelMove) {
				this.disconnectPreviousRoom(previousRoom);
				previousRoom = null;
			}
		}

		runInAction(() => {
			this.connectionState = {
				...this.connectionState,
				room: null,
				connecting: true,
				connected: false,
				reconnecting: false,
				guildId,
				channelId: resolvedChannelId,
				voiceServerEndpoint: endpoint,
				connectionId: connectionId ?? this.connectionState.connectionId,
			};
		});

		this.throttle.setInFlightConnect(true);

		const room = new LiveKitRoom({adaptiveStream: true, dynacast: true});

		onRoomCreated(room, attemptId, guildId, resolvedChannelId);

		if (!endpoint || !token) {
			logger.error('Missing endpoint or token', {endpoint, hasToken: !!token});
			this.disconnectPreviousRoom(previousRoom);
			runInAction(() => {
				this.connectionState = {
					...this.connectionState,
					connecting: false,
					reconnecting: false,
				};
			});
			this.throttle.setInFlightConnect(false);
			return;
		}

		logger.info('Attempting to connect to LiveKit', {endpoint, guildId, channelId: resolvedChannelId});

		room
			.connect(endpoint, token, {autoSubscribe: false})
			.then(() => {
				this.disconnectPreviousRoom(previousRoom);
				logger.info('LiveKit connection succeeded');
				if (!this.throttle.isLatestAttempt(attemptId)) {
					logger.warn('Connection succeeded but attempt is stale, disconnecting');
					try {
						room.removeAllListeners();
						room.disconnect();
					} catch (error) {
						logger.warn('Failed to disconnect stale room', error);
					}
					return;
				}
				logger.info('Initializing voice connection');
				runInAction(() => {
					this.connectionState = {
						...this.connectionState,
						room,
					};
				});
			})
			.catch((error) => {
				this.disconnectPreviousRoom(previousRoom);
				logger.error('LiveKit connection failed', {error, endpoint});
				if (this.throttle.isLatestAttempt(attemptId)) {
					runInAction(() => {
						this.connectionState = {
							...this.connectionState,
							connecting: false,
							reconnecting: false,
						};
					});
					this.throttle.setInFlightConnect(false);
					this.reconnect.setReconnectState('error');
				}
			});
	}

	markConnected(): void {
		runInAction(() => {
			this.connectionState = {
				...this.connectionState,
				connected: true,
				connecting: false,
				reconnecting: false,
			};
		});
		this.throttle.setInFlightConnect(false);
		this.reconnect.resetOnConnection();
		logger.info('Connection established');
	}

	markDisconnected(reason: 'user' | 'error' | 'server' = 'user'): void {
		runInAction(() => {
			this.connectionState = {
				...initialConnectionState,
				connectionId: reason === 'user' ? null : this.connectionState.connectionId,
			};
		});
		this.throttle.setInFlightConnect(false);
		this.reconnect.setReconnectState(reason);
		logger.info('Connection terminated', {reason});
	}

	markReconnecting(): void {
		runInAction(() => {
			this.connectionState = {
				...this.connectionState,
				connecting: true,
				connected: false,
				reconnecting: true,
			};
		});
		logger.info('Connection reconnecting');
	}

	markReconnected(): void {
		runInAction(() => {
			this.connectionState = {
				...this.connectionState,
				connecting: false,
				connected: true,
				reconnecting: false,
			};
		});
		this.reconnect.resetOnConnection();
		logger.info('Connection reconnected');
	}

	disconnectFromVoiceChannel(reason: 'user' | 'error' | 'server' = 'user'): void {
		const {room} = this.connectionState;

		this.isLocalDisconnecting = reason === 'user';

		this.clearVoiceServerTimeout();

		if (room) {
			room.removeAllListeners();
			room.disconnect();
		}

		runInAction(() => {
			this.connectionState = {
				...initialConnectionState,
				connectionId: reason === 'user' ? null : this.connectionState.connectionId,
			};
		});

		this.reconnect.setReconnectState(reason);

		this.isLocalDisconnecting = false;
		logger.info('Disconnected from voice channel', {reason});
	}

	disconnectForChannelMove(): void {
		const {room} = this.connectionState;

		this.clearVoiceServerTimeout();

		if (room) {
			room.removeAllListeners();
			room.disconnect();
		}

		runInAction(() => {
			this.connectionState = {
				...initialConnectionState,
				connectionId: this.connectionState.connectionId,
			};
		});

		logger.info('Disconnected for channel move (preserving connectionId)');
	}

	scheduleReconnect(callback: () => void): boolean {
		return this.reconnect.scheduleReconnect(callback);
	}

	markReconnectionAttempted(): void {
		this.reconnect.markAttempted();
	}

	resetReconnectState(): void {
		this.reconnect.reset();
	}

	updateChannelId(channelId: string): void {
		runInAction(() => {
			this.connectionState = {
				...this.connectionState,
				channelId,
				connected: false,
				connecting: true,
				reconnecting: false,
				room: null,
			};
		});
		logger.info('Channel updated', {channelId});
	}

	acceptServerChannelChange(channelId: string): void {
		const previousChannelId = this.connectionState.channelId;
		runInAction(() => {
			this.connectionState = {
				...this.connectionState,
				channelId,
			};
		});
		this.reconnect.setLastConnectedChannel(this.connectionState.guildId, channelId);
		logger.info('Accepted server channel change', {previousChannelId, newChannelId: channelId});
	}

	createGuardedHandler<T extends ReadonlyArray<unknown>>(
		attemptId: number,
		handler: (...args: T) => void,
	): (...args: T) => void {
		return (...args: T) => {
			if (!this.throttle.isLatestAttempt(attemptId)) {
				return;
			}
			handler(...args);
		};
	}

	bindConnectionEvents(
		room: Room,
		attemptId: number,
		handlers: {
			onConnected: () => void;
			onDisconnected: (reason?: unknown) => void;
			onReconnecting: () => void;
			onReconnected: () => void;
		},
	): void {
		room.on(RoomEvent.Connected, this.createGuardedHandler(attemptId, handlers.onConnected));
		room.on(RoomEvent.Disconnected, this.createGuardedHandler(attemptId, handlers.onDisconnected));
		room.on(RoomEvent.Reconnecting, this.createGuardedHandler(attemptId, handlers.onReconnecting));
		room.on(RoomEvent.Reconnected, this.createGuardedHandler(attemptId, handlers.onReconnected));
	}

	resetConnectionState(): void {
		runInAction(() => {
			this.connectionState = initialConnectionState;
		});
		this.isLocalDisconnecting = false;
		this.throttle.setInFlightConnect(false);
	}

	clearInFlightConnect(): void {
		this.throttle.setInFlightConnect(false);
	}

	abortConnection(): void {
		this.clearVoiceServerTimeout();

		runInAction(() => {
			this.connectionState = {
				...initialConnectionState,
				connectionId: null,
			};
		});

		this.isLocalDisconnecting = false;
		this.throttle.setInFlightConnect(false);
		logger.info('Connection aborted due to gateway error');
	}

	private scheduleVoiceServerTimeout(guildId: string | null, channelId: string): void {
		this.clearVoiceServerTimeout();
		this.voiceServerTimeoutSub = timer(VOICE_SERVER_TIMEOUT_MS).subscribe(() => {
			runInAction(() => {
				if (
					this.connectionState.guildId === guildId &&
					this.connectionState.channelId === channelId &&
					!this.connectionState.connected
				) {
					logger.warn('Voice server timeout', {guildId, channelId});
					this.connectionState = initialConnectionState;
					this.throttle.setInFlightConnect(false);
					this.reconnect.setReconnectState('error');
				}
			});
		});
	}

	private disconnectPreviousRoom(previousRoom: Room | null): void {
		if (!previousRoom) return;
		try {
			if (previousRoom.state === 'connected') {
				previousRoom.disconnect();
				logger.debug('Previous room disconnected');
			}
		} catch (error) {
			logger.warn('Failed to disconnect previous room', error);
		}
	}

	private clearVoiceServerTimeout(): void {
		this.voiceServerTimeoutSub?.unsubscribe();
		this.voiceServerTimeoutSub = null;
	}

	cleanup(): void {
		const {room} = this.connectionState;

		this.clearVoiceServerTimeout();

		if (room) {
			room.removeAllListeners();
			room.disconnect();
		}

		runInAction(() => {
			this.connectionState = initialConnectionState;
		});

		this.isLocalDisconnecting = false;
		this.throttle.reset();
		this.reconnect.cleanup();

		logger.info('Cleanup complete');
	}
}

export default new VoiceConnectionManager();
