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

import type {CsamResourceType, FrameSample} from '@fluxer/api/src/csam/CsamTypes';

export type CsamScanProvider = 'photo_dna' | 'arachnid_shield';

export interface CsamMatchDetail {
	source: string;
	violations: Array<string>;
	matchDistance: number;
	matchId?: string;
}

export interface CsamMatchResult {
	isMatch: boolean;
	trackingId: string;
	matchDetails: Array<CsamMatchDetail>;
	timestamp: string;
	provider: CsamScanProvider;
}

export interface CsamScanResult {
	isMatch: boolean;
	matchResult?: CsamMatchResult;
	frames?: Array<FrameSample>;
	hashes?: Array<string>;
}

export interface CsamScanContext {
	resourceType: CsamResourceType;
	userId: string | null;
	guildId: string | null;
	channelId: string | null;
	messageId: string | null;
}

export interface ScanMediaParams {
	bucket: string;
	key: string;
	contentType: string | null;
	context?: CsamScanContext;
}

export interface ScanBase64Params {
	base64: string;
	mimeType: string;
	context?: CsamScanContext;
}

export interface ICsamScanProvider {
	readonly providerName: CsamScanProvider;
	scanMedia(params: ScanMediaParams): Promise<CsamScanResult>;
	scanBase64(params: ScanBase64Params): Promise<CsamScanResult>;
}
