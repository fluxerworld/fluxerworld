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

import {Config} from '@fluxer/integration/Config';
import type {
	GatewayDispatch,
	GatewayHelloPayload,
	GatewayPayload,
	GatewayResumeState,
	ReadyPayload,
	VoiceServerUpdate,
	VoiceStateUpdate,
} from '@fluxer/integration/gateway/GatewayTypes';
import {GatewayOpcode} from '@fluxer/integration/gateway/GatewayTypes';
import WebSocket from 'ws';

export type EventMatcher = (data: unknown) => boolean;

export class GatewayClient {
	private ws: WebSocket | null = null;
	private token: string;
	private gatewayUrl: string;
	private sessionId: string | null = null;
	private sequence: number = 0;
	private heartbeatInterval: NodeJS.Timeout | null = null;
	private events: Array<GatewayDispatch> = [];
	private eventListeners: Map<string, Array<(dispatch: GatewayDispatch) => void>> = new Map();
	private readyPromise: Promise<ReadyPayload> | null = null;
	private readyResolve: ((payload: ReadyPayload) => void) | null = null;
	private resumedPromise: Promise<void> | null = null;
	private resumedResolve: (() => void) | null = null;
	private closed: boolean = false;

	constructor(token: string) {
		this.token = token;
		this.gatewayUrl = Config.gatewayUrl;
	}

	async connect(): Promise<ReadyPayload> {
		return new Promise((resolve, reject) => {
			this.setupWebSocket(reject, undefined);
			this.readyPromise!.then(resolve).catch(reject);
		});
	}

	async resume(resumeState: GatewayResumeState): Promise<void> {
		return new Promise((resolve, reject) => {
			this.sessionId = resumeState.sessionId;
			this.sequence = resumeState.sequence;
			this.resumedPromise = new Promise((res) => {
				this.resumedResolve = res;
			});
			this.setupWebSocket(reject, resumeState);
			this.resumedPromise.then(resolve).catch(reject);
		});
	}

	private setupWebSocket(reject: (error: Error) => void, resumeState?: GatewayResumeState): void {
		const url = `${this.gatewayUrl}?v=1&encoding=json`;

		const headers: Record<string, string> = {
			'User-Agent': 'FluxerIntegrationTests/1.0',
		};
		if (Config.webAppOrigin) {
			headers['Origin'] = Config.webAppOrigin;
		}
		if (Config.testToken) {
			headers['X-Test-Token'] = Config.testToken;
		}

		this.ws = new WebSocket(url, {headers});

		this.readyPromise = new Promise((res) => {
			this.readyResolve = res;
		});

		this.ws.on('open', () => {});

		this.ws.on('message', (data: WebSocket.Data) => {
			this.handleMessage(data.toString(), resumeState);
		});

		this.ws.on('error', (error) => {
			reject(error);
		});

		this.ws.on('close', (code, reason) => {
			this.closed = true;
			this.stopHeartbeat();
			if (!this.readyResolve && !this.resumedResolve) {
				reject(new Error(`WebSocket closed: ${code} ${reason.toString()}`));
			}
		});
	}

	private handleMessage(data: string, resume?: GatewayResumeState): void {
		const payload: GatewayPayload = JSON.parse(data);

		if (payload.s != null) {
			this.sequence = payload.s;
		}

		switch (payload.op) {
			case GatewayOpcode.HELLO:
				this.handleHello(payload.d as GatewayHelloPayload, resume);
				break;

			case GatewayOpcode.DISPATCH:
				this.handleDispatch(payload);
				break;

			case GatewayOpcode.HEARTBEAT_ACK:
				break;

			case GatewayOpcode.HEARTBEAT:
				this.sendHeartbeat();
				break;

			case GatewayOpcode.INVALID_SESSION:
				console.error('Invalid session received');
				break;

			case GatewayOpcode.RECONNECT:
				console.log('Reconnect requested');
				break;
		}
	}

	private handleHello(hello: GatewayHelloPayload, resume?: GatewayResumeState): void {
		this.startHeartbeat(hello.heartbeat_interval);

		if (resume) {
			this.sendResume(resume);
		} else {
			this.sendIdentify();
		}
	}

	private handleDispatch(payload: GatewayPayload): void {
		const dispatch: GatewayDispatch = {
			type: payload.t!,
			data: payload.d,
			sequence: payload.s ?? 0,
		};

		this.events.push(dispatch);

		const listeners = this.eventListeners.get(dispatch.type);
		if (listeners) {
			for (const listener of listeners) {
				listener(dispatch);
			}
		}

		if (dispatch.type === 'READY') {
			const ready = dispatch.data as ReadyPayload;
			this.sessionId = ready.session_id;
			if (this.readyResolve) {
				this.readyResolve(ready);
				this.readyResolve = null;
			}
		} else if (dispatch.type === 'RESUMED') {
			if (this.resumedResolve) {
				this.resumedResolve();
				this.resumedResolve = null;
			}
		}
	}

	private sendIdentify(): void {
		this.send({
			op: GatewayOpcode.IDENTIFY,
			d: {
				token: this.token,
				properties: {
					os: 'linux',
					browser: 'FluxerIntegrationTests',
					device: 'FluxerIntegrationTests',
				},
				compress: false,
				large_threshold: 250,
			},
		});
	}

	private sendResume(resume: GatewayResumeState): void {
		this.send({
			op: GatewayOpcode.RESUME,
			d: {
				token: this.token,
				session_id: resume.sessionId,
				seq: resume.sequence,
			},
		});
	}

	private sendHeartbeat(): void {
		this.send({
			op: GatewayOpcode.HEARTBEAT,
			d: this.sequence,
		});
	}

	private startHeartbeat(interval: number): void {
		this.heartbeatInterval = setInterval(() => {
			if (!this.closed) {
				this.sendHeartbeat();
			}
		}, interval);
	}

	private stopHeartbeat(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}
	}

	send(payload: Omit<GatewayPayload, 's' | 't'>): void {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(payload));
		}
	}

	sendVoiceStateUpdate(
		guildId: string | null,
		channelId: string | null,
		connectionId?: string | null,
		selfMute: boolean = false,
		selfDeaf: boolean = false,
		selfVideo: boolean = false,
		selfStream: boolean = false,
	): void {
		this.send({
			op: GatewayOpcode.VOICE_STATE_UPDATE,
			d: {
				guild_id: guildId,
				channel_id: channelId,
				connection_id: connectionId,
				self_mute: selfMute,
				self_deaf: selfDeaf,
				self_video: selfVideo,
				self_stream: selfStream,
			},
		});
	}

	activateGuild(guildId: string): void {
		this.send({
			op: GatewayOpcode.LAZY_REQUEST,
			d: {
				subscriptions: {
					[guildId]: {
						active: true,
					},
				},
			},
		});
	}

	waitForEvent(eventType: string, timeoutMs: number = 5000, matcher?: EventMatcher): Promise<GatewayDispatch> {
		return new Promise((resolve, reject) => {
			const existingIndex = this.events.findIndex((e) => e.type === eventType && (!matcher || matcher(e.data)));
			if (existingIndex !== -1) {
				const event = this.events.splice(existingIndex, 1)[0]!;
				resolve(event);
				return;
			}

			const timeout = setTimeout(() => {
				cleanup();
				reject(new Error(`Timeout waiting for event: ${eventType}`));
			}, timeoutMs);

			const listener = (dispatch: GatewayDispatch) => {
				if (!matcher || matcher(dispatch.data)) {
					cleanup();
					const index = this.events.indexOf(dispatch);
					if (index !== -1) {
						this.events.splice(index, 1);
					}
					resolve(dispatch);
				}
			};

			const cleanup = () => {
				clearTimeout(timeout);
				const listeners = this.eventListeners.get(eventType);
				if (listeners) {
					const index = listeners.indexOf(listener);
					if (index !== -1) {
						listeners.splice(index, 1);
					}
				}
			};

			if (!this.eventListeners.has(eventType)) {
				this.eventListeners.set(eventType, []);
			}
			this.eventListeners.get(eventType)!.push(listener);
		});
	}

	waitForVoiceServerUpdate(
		timeoutMs: number = 5000,
		matcher?: (vsu: VoiceServerUpdate) => boolean,
	): Promise<VoiceServerUpdate> {
		return this.waitForEvent('VOICE_SERVER_UPDATE', timeoutMs, matcher as EventMatcher).then(
			(dispatch) => dispatch.data as VoiceServerUpdate,
		);
	}

	waitForVoiceStateUpdate(
		timeoutMs: number = 5000,
		matcher?: (vs: VoiceStateUpdate) => boolean,
	): Promise<VoiceStateUpdate> {
		return this.waitForEvent('VOICE_STATE_UPDATE', timeoutMs, matcher as EventMatcher).then(
			(dispatch) => dispatch.data as VoiceStateUpdate,
		);
	}

	assertNoEvent(eventType: string, waitMs: number = 500): Promise<void> {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				cleanup();
				resolve();
			}, waitMs);

			const listener = (dispatch: GatewayDispatch) => {
				cleanup();
				reject(new Error(`Unexpected event received: ${eventType} - ${JSON.stringify(dispatch.data)}`));
			};

			const cleanup = () => {
				clearTimeout(timeout);
				const listeners = this.eventListeners.get(eventType);
				if (listeners) {
					const index = listeners.indexOf(listener);
					if (index !== -1) {
						listeners.splice(index, 1);
					}
				}
			};

			if (!this.eventListeners.has(eventType)) {
				this.eventListeners.set(eventType, []);
			}
			this.eventListeners.get(eventType)!.push(listener);
		});
	}

	getSessionId(): string | null {
		return this.sessionId;
	}

	getSequence(): number {
		return this.sequence;
	}

	getResumeState(): GatewayResumeState | null {
		if (!this.sessionId) return null;
		return {
			sessionId: this.sessionId,
			sequence: this.sequence,
		};
	}

	close(): void {
		this.closed = true;
		this.stopHeartbeat();
		if (this.ws) {
			this.ws.close(1000, 'Test complete');
			this.ws = null;
		}
	}
}

export async function createGatewayClient(token: string): Promise<GatewayClient> {
	const client = new GatewayClient(token);
	await client.connect();
	return client;
}
