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

import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {normalizeString, withStringLengthRangeValidation} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import validator from 'validator';
import {z} from 'zod';

const PROTOCOLS = ['http', 'https'];
const FILENAME_SAFE_REGEX = /^[\p{L}\p{N}\p{M}_.-]+$/u;

const URL_VALIDATOR_OPTIONS = {
	require_protocol: true,
	require_host: true,
	disallow_auth: true,
	allow_trailing_dot: false,
	allow_protocol_relative_urls: false,
	allow_fragments: false,
	validate_length: true,
	protocols: ['http', 'https'] as Array<string>,
} as const;

let isDevelopment = false;

export function setIsDevelopment(value: boolean): void {
	isDevelopment = value;
}

function createUrlSchema(allowFragments: boolean) {
	return z
		.string()
		.transform(normalizeString)
		.pipe(withStringLengthRangeValidation(z.string(), 1, 2048, ValidationErrorCodes.URL_LENGTH_INVALID))
		.refine((value) => {
			if (!value.startsWith('http://') && !value.startsWith('https://')) {
				return false;
			}
			try {
				const url = new URL(value);
				return PROTOCOLS.includes(url.protocol.slice(0, -1));
			} catch {
				return false;
			}
		}, ValidationErrorCodes.INVALID_URL_FORMAT)
		.refine(
			(value) =>
				validator.isURL(value, {
					...URL_VALIDATOR_OPTIONS,
					allow_fragments: allowFragments,
					require_tld: !isDevelopment,
				}),
			ValidationErrorCodes.INVALID_URL_FORMAT,
		);
}

export const URLType = createUrlSchema(false);
export const URLWithFragmentType = createUrlSchema(true);

export const AttachmentURLType = z
	.string()
	.transform(normalizeString)
	.pipe(withStringLengthRangeValidation(z.string(), 1, 2048, ValidationErrorCodes.URL_LENGTH_INVALID))
	.refine((value) => {
		if (value.startsWith('attachment://')) {
			const filename = value.slice(13);
			if (filename.length === 0) {
				return false;
			}
			return FILENAME_SAFE_REGEX.test(filename);
		}

		if (!value.startsWith('http://') && !value.startsWith('https://')) {
			return false;
		}
		try {
			const url = new URL(value);
			return PROTOCOLS.includes(url.protocol.slice(0, -1));
		} catch {
			return false;
		}
	}, ValidationErrorCodes.INVALID_URL_OR_ATTACHMENT_FORMAT)
	.refine((value) => {
		if (value.startsWith('attachment://')) {
			return true;
		}
		return validator.isURL(value, {
			...URL_VALIDATOR_OPTIONS,
			require_tld: !isDevelopment,
		});
	}, ValidationErrorCodes.INVALID_URL_FORMAT);
