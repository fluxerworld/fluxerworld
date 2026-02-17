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

import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import VoiceStateManager from '@app/stores/voice/VoiceStateManager';
import type {CallVoiceState} from '@app/types/gateway/GatewayVoiceTypes';
import {ME} from '@fluxer/constants/src/AppConstants';
import {makeAutoObservable, observable} from 'mobx';

export enum CallMode {
	MINIMUM = 'MINIMUM',
	NORMAL = 'NORMAL',
	FULL_SCREEN = 'FULL_SCREEN',
}

export enum CallLayout {
	MINIMUM = 'MINIMUM',
	NORMAL = 'NORMAL',
	FULL_SCREEN = 'FULL_SCREEN',
}

export interface GatewayCallData {
	channel_id: string;
	message_id?: string;
	region?: string;
	ringing?: Array<string>;
	voice_states?: Array<CallVoiceState>;
}

export interface Call {
	channelId: string;
	messageId: string | null;
	region: string | null;
	ringing: Array<string>;
	layout: CallLayout;
	participants: Array<string>;
}

class CallStateStore {
	calls = observable.map<string, Call>();
	private pendingRinging = observable.map<string, Set<string>>();

	constructor() {
		makeAutoObservable(
			this,
			{
				getCall: false,
				getActiveCalls: false,
				hasActiveCall: false,
				isCallActive: false,
				getCallLayout: false,
				getMessageId: false,
				getParticipants: false,
				isUserPendingRinging: false,
			},
			{autoBind: true},
		);
	}

	getCall(channelId: string): Call | undefined {
		return this.calls.get(channelId);
	}

	getActiveCalls(): Array<Call> {
		return Array.from(this.calls.values()).filter((call) => this.hasActiveCall(call.channelId));
	}

	hasActiveCall(channelId: string): boolean {
		const call = this.calls.get(channelId);
		if (!call) return false;

		const participants = this.getParticipants(channelId);
		return participants.length > 0 || call.ringing.length > 0;
	}

	isCallActive(channelId: string, messageId?: string): boolean {
		const call = this.calls.get(channelId);
		if (!call) return false;
		if (messageId) return call.messageId === messageId;
		return call.region != null;
	}

	getCallLayout(channelId: string): CallLayout {
		const call = this.calls.get(channelId);
		const connectedChannelId = MediaEngineStore.channelId;
		if (call?.layout && channelId === connectedChannelId) {
			return call.layout;
		}
		return CallLayout.MINIMUM;
	}

	getMessageId(channelId: string): string | null {
		const call = this.calls.get(channelId);
		return call?.messageId ?? null;
	}

	getParticipants(channelId: string): Array<string> {
		const voiceStates = VoiceStateManager.getAllVoiceStatesInChannel(ME, channelId);
		return Object.values(voiceStates)
			.map((state) => state.user_id)
			.filter(Boolean);
	}

	clearPendingRinging(channelId: string, userIds?: Array<string>): void {
		if (!userIds || userIds.length === 0) {
			if (!this.pendingRinging.has(channelId)) return;
			this.pendingRinging.delete(channelId);
			this.syncCallRinging(channelId, new Set());
			return;
		}

		const normalized = this.normalizeUserIds(userIds);
		if (normalized.length === 0) return;

		const existing = this.pendingRinging.get(channelId);
		if (!existing) return;

		const nextSet = new Set(existing);
		let changed = false;

		for (const id of normalized) {
			if (nextSet.delete(id)) {
				changed = true;
			}
		}

		if (!changed) return;

		if (nextSet.size === 0) {
			this.pendingRinging.delete(channelId);
			this.syncCallRinging(channelId, new Set());
		} else {
			this.pendingRinging.set(channelId, nextSet);
			this.syncCallRinging(channelId, nextSet);
		}
	}

	isUserPendingRinging(channelId: string, userId?: string | null): boolean {
		if (!userId) return false;
		const set = this.pendingRinging.get(channelId);
		return Boolean(set?.has(userId));
	}

	handleCallCreate(data: {channelId: string; call?: GatewayCallData}): void {
		if (!data.call) return;

		const existingCall = this.calls.get(data.channelId);
		if (existingCall) {
			this.handleCallUpdate(data.call);
			return;
		}

		const {ringing = [], message_id, region, voice_states = []} = data.call;
		const normalizedRinging = this.normalizeUserIds(ringing);
		const participants = this.extractParticipantsFromVoiceStates(voice_states);

		const call: Call = {
			channelId: data.channelId,
			messageId: message_id ?? null,
			region: region ?? null,
			ringing: normalizedRinging,
			layout: CallLayout.MINIMUM,
			participants,
		};

		this.calls.set(data.channelId, call);
		this.setPendingRinging(data.channelId, normalizedRinging);
	}

	handleCallUpdate(data: GatewayCallData): void {
		const {channel_id, ringing, message_id, region, voice_states} = data;

		const call = this.calls.get(channel_id);

		if (!call) {
			this.handleCallCreate({channelId: channel_id, call: data});
			return;
		}

		const hasRingingPayload = ringing !== undefined;
		const normalizedRinging = hasRingingPayload ? this.normalizeUserIds(ringing) : call.ringing;
		const hasVoiceStatesPayload = voice_states !== undefined;
		const participants = hasVoiceStatesPayload
			? this.extractParticipantsFromVoiceStates(voice_states)
			: call.participants;

		const updatedCall: Call = {
			...call,
			ringing: normalizedRinging,
			messageId: message_id !== undefined ? message_id : call.messageId,
			region: region !== undefined ? region : call.region,
			participants,
		};

		if (!this.isCallSnapshotEqual(call, updatedCall)) {
			this.calls.set(channel_id, updatedCall);
		}
		if (hasRingingPayload) {
			this.setPendingRinging(channel_id, normalizedRinging);
		}
	}

	private normalizeUserIds(userIds?: Array<string>): Array<string> {
		if (!userIds || userIds.length === 0) return [];
		const normalized = userIds.map(String).filter(Boolean);
		return Array.from(new Set(normalized)).sort();
	}

	private extractParticipantsFromVoiceStates(voiceStates?: Array<CallVoiceState>): Array<string> {
		if (!voiceStates || voiceStates.length === 0) return [];
		const participants = voiceStates.map((state) => state.user_id).filter((id): id is string => Boolean(id));
		return Array.from(new Set(participants)).sort();
	}

	private setPendingRinging(channelId: string, userIds: Array<string>): void {
		const nextSet = new Set(userIds);
		const existing = this.pendingRinging.get(channelId);
		if (existing && this.areSetsEqual(existing, nextSet)) {
			return;
		}

		if (nextSet.size === 0) {
			this.pendingRinging.delete(channelId);
			this.syncCallRinging(channelId, new Set());
			return;
		}

		this.pendingRinging.set(channelId, nextSet);
		this.syncCallRinging(channelId, nextSet);
	}

	private isCallSnapshotEqual(a: Call, b: Call): boolean {
		return (
			a.channelId === b.channelId &&
			a.messageId === b.messageId &&
			a.region === b.region &&
			a.layout === b.layout &&
			this.areArraysEqual(a.ringing, b.ringing) &&
			this.areArraysEqual(a.participants, b.participants)
		);
	}

	private areArraysEqual(a: Array<string>, b: Array<string>): boolean {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i += 1) {
			if (a[i] !== b[i]) return false;
		}
		return true;
	}

	private areSetsEqual(a: Set<string>, b: Set<string>): boolean {
		if (a.size !== b.size) return false;
		for (const value of a) {
			if (!b.has(value)) return false;
		}
		return true;
	}

	private syncCallRinging(channelId: string, ringSet?: Set<string>): void {
		const call = this.calls.get(channelId);
		if (!call) return;

		const nextSet = ringSet ?? this.pendingRinging.get(channelId) ?? new Set<string>();
		const nextRinging = Array.from(nextSet);
		const isSame =
			nextRinging.length === call.ringing.length && nextRinging.every((id, index) => call.ringing[index] === id);

		if (isSame) return;

		this.calls.set(channelId, {...call, ringing: nextRinging});
	}

	handleCallDelete(data: {channelId: string}): void {
		this.calls.delete(data.channelId);
		this.clearPendingRinging(data.channelId);
	}

	handleCallLayoutUpdate(channelId: string, layout: CallLayout): void {
		const call = this.calls.get(channelId);
		if (!call) return;
		call.layout = layout;
	}

	handleCallParticipants(channelId: string, participants: Array<string>): void {
		const call = this.calls.get(channelId);
		if (!call) return;

		const uniqueParticipants = Array.from(new Set(participants));
		call.participants = uniqueParticipants;
	}
}

export default new CallStateStore();
