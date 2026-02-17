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

import type {VoiceState} from '@app/types/gateway/GatewayVoiceTypes';

export interface ParsedVoiceParticipantIdentity {
	userId: string;
	connectionId: string;
}

export function parseVoiceParticipantIdentity(identity: string): ParsedVoiceParticipantIdentity {
	const match = identity.match(/^user_(\d+)_(.+)$/);
	return {userId: match?.[1] ?? '', connectionId: match?.[2] ?? ''};
}

interface IsVoiceParticipantActuallySpeakingArgs {
	isSpeaking: boolean;
	voiceState: VoiceState | null;
	isMicrophoneEnabled: boolean;
}

export function isVoiceParticipantActuallySpeaking({
	isSpeaking,
	voiceState,
	isMicrophoneEnabled,
}: IsVoiceParticipantActuallySpeakingArgs): boolean {
	if (!isSpeaking) return false;
	if (!isMicrophoneEnabled) return false;
	if (voiceState?.self_mute ?? false) return false;
	if (voiceState?.mute ?? false) return false;
	return true;
}
