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

import {Config} from '@fluxer/api/src/Config';
import type {FrameSample} from '@fluxer/api/src/csam/CsamTypes';
import {Logger} from '@fluxer/api/src/Logger';

interface HashServiceRequest {
	images: Array<{
		mime_type: string;
		data: string;
	}>;
}

interface HashServiceResponse {
	hashes: Array<string>;
	errors?: Array<string>;
}

export interface IPhotoDnaHashClient {
	hashFrames(frames: Array<FrameSample>): Promise<Array<string>>;
}

export class PhotoDnaHashClient implements IPhotoDnaHashClient {
	private readonly endpoint: string;
	private readonly timeoutMs: number;

	constructor() {
		if (!Config.photoDna.enabled) {
			throw new Error('PhotoDNA hash client initialized while the feature is disabled');
		}

		const url = Config.photoDna.hashService.url;
		if (!url) {
			throw new Error('PhotoDNA hash service URL is not configured');
		}

		this.endpoint = url;
		this.timeoutMs = Config.photoDna.hashService.timeoutMs;
	}

	async hashFrames(frames: Array<FrameSample>): Promise<Array<string>> {
		const url = `${this.endpoint.replace(/\/$/, '')}/hash`;
		const body: HashServiceRequest = {
			images: frames.map((frame) => ({
				mime_type: frame.mimeType,
				data: frame.base64,
			})),
		};

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify(body),
				signal: controller.signal,
			});

			if (!response.ok) {
				const text = await response.text().catch(() => '<no body>');
				throw new Error(`PhotoDNA hash service returned ${response.status}: ${text}`);
			}

			const result = (await response.json()) as HashServiceResponse;

			if (!Array.isArray(result.hashes)) {
				throw new Error('Invalid response from PhotoDNA hash service');
			}

			return result.hashes;
		} catch (error) {
			Logger.error({error}, 'Failed to compute PhotoDNA hashes');
			throw error;
		} finally {
			clearTimeout(timeout);
		}
	}
}
