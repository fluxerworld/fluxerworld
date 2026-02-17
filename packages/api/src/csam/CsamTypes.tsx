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

import type {ChannelRow} from '@fluxer/api/src/database/types/ChannelTypes';
import type {GuildRow} from '@fluxer/api/src/database/types/GuildTypes';
import type {MessageRow} from '@fluxer/api/src/database/types/MessageTypes';
import type {UserRow} from '@fluxer/api/src/database/types/UserTypes';
import type {WorkerJobPayload} from '@fluxer/worker/src/contracts/WorkerTypes';

export type CsamResourceType = 'attachment' | 'avatar' | 'emoji' | 'sticker' | 'banner' | 'other';

export interface CsamScanTarget {
	bucket: string;
	key: string;
	cdnUrl: string | null;
	filename: string;
	contentType: string | null;
	resourceType: CsamResourceType;
	channelId?: string | null;
	messageId?: string | null;
	attachmentId?: string | null;
	userId?: string | null;
	guildId?: string | null;
}
export interface CsamScanJobPayload extends WorkerJobPayload {
	jobId: string;
	resourceType: CsamResourceType;
	bucket: string;
	key: string;
	cdnUrl: string | null;
	filename: string;
	contentType: string | null;
	channelId: string | null;
	messageId: string | null;
	guildId: string | null;
	userId: string | null;
}

export interface FrameSample {
	timestamp: number;
	mimeType: string;
	base64: string;
}

export interface PhotoDnaMatchDetail {
	source: string;
	violations: Array<string>;
	matchDistance: number;
	matchId?: string;
}

export type CsamScanProviderType = 'photo_dna' | 'arachnid_shield';

export interface PhotoDnaMatchResult {
	isMatch: boolean;
	trackingId: string;
	matchDetails: Array<PhotoDnaMatchDetail>;
	timestamp: string;
	provider?: CsamScanProviderType;
}

export type CsamScanJobStatus = 'pending' | 'processing' | 'hashing' | 'matched' | 'no_match' | 'failed';

export interface CsamScanQueueEntry {
	requestId: string;
	hashes: Array<string>;
}

export interface CsamScanResultMessage {
	isMatch: boolean;
	matchResult?: PhotoDnaMatchResult;
	error?: string;
}

export interface AttachmentEvidenceInfo {
	attachmentId: string;
	filename: string;
	contentType: string;
	size: number;
	cdnUrl: string;
	evidenceKey: string;
}

export interface EvidenceContext {
	message?: MessageRow | Record<string, unknown> | null;
	user?: UserRow | Record<string, unknown> | null;
	guild?: GuildRow | Record<string, unknown> | null;
	channel?: ChannelRow | Record<string, unknown> | null;
	attachments?: Array<Record<string, unknown> | AttachmentEvidenceInfo> | null;
	contactLogs?: Array<Record<string, unknown>> | null;
	additional?: Record<string, unknown>;
}
