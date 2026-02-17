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

import type {
	CsamScanJobPayload,
	EvidenceContext,
	FrameSample,
	PhotoDnaMatchResult,
} from '@fluxer/api/src/csam/CsamTypes';

export interface StoreEvidenceArgs {
	reportId: bigint;
	job: CsamScanJobPayload;
	matchResult: PhotoDnaMatchResult;
	frames: Array<FrameSample>;
	hashes: Array<string>;
	context?: EvidenceContext;
}

export interface StoreEvidenceResult {
	integrityHash: string;
	evidenceZipKey: string;
	assetCopyKey: string;
}

export interface ICsamEvidenceService {
	storeEvidence(args: StoreEvidenceArgs): Promise<StoreEvidenceResult>;
}
