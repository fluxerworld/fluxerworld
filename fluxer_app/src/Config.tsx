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

import * as v from 'valibot';

const envSchema = v.object({
	PUBLIC_BUILD_SHA: v.nullish(v.string(), 'dev'),
	PUBLIC_BUILD_NUMBER: v.nullish(v.pipe(v.string(), v.transform(Number), v.number()), '0'),
	PUBLIC_BUILD_TIMESTAMP: v.nullish(
		v.pipe(v.string(), v.transform(Number), v.number()),
		`${Math.floor(Date.now() / 1000)}`,
	),
	PUBLIC_RELEASE_CHANNEL: v.nullish(v.picklist(['stable', 'canary', 'nightly']), 'nightly'),
	PUBLIC_BOOTSTRAP_API_ENDPOINT: v.nullish(v.string(), '/api'),
	PUBLIC_BOOTSTRAP_API_PUBLIC_ENDPOINT: v.nullish(v.string()),
	PUBLIC_RELAY_DIRECTORY_URL: v.nullish(v.string()),
});

const env = v.parse(envSchema, {
	PUBLIC_BUILD_SHA: import.meta.env.PUBLIC_BUILD_SHA,
	PUBLIC_BUILD_NUMBER: import.meta.env.PUBLIC_BUILD_NUMBER,
	PUBLIC_BUILD_TIMESTAMP: import.meta.env.PUBLIC_BUILD_TIMESTAMP,
	PUBLIC_RELEASE_CHANNEL: import.meta.env.PUBLIC_RELEASE_CHANNEL,
	PUBLIC_BOOTSTRAP_API_ENDPOINT: import.meta.env.PUBLIC_BOOTSTRAP_API_ENDPOINT,
	PUBLIC_BOOTSTRAP_API_PUBLIC_ENDPOINT: import.meta.env.PUBLIC_BOOTSTRAP_API_PUBLIC_ENDPOINT,
	PUBLIC_RELAY_DIRECTORY_URL: import.meta.env.PUBLIC_RELAY_DIRECTORY_URL,
});

export default {
	PUBLIC_BUILD_SHA: env.PUBLIC_BUILD_SHA,
	PUBLIC_BUILD_NUMBER: env.PUBLIC_BUILD_NUMBER,
	PUBLIC_BUILD_TIMESTAMP: env.PUBLIC_BUILD_TIMESTAMP,
	PUBLIC_RELEASE_CHANNEL: env.PUBLIC_RELEASE_CHANNEL,
	PUBLIC_BOOTSTRAP_API_ENDPOINT: env.PUBLIC_BOOTSTRAP_API_ENDPOINT,
	PUBLIC_BOOTSTRAP_API_PUBLIC_ENDPOINT: env.PUBLIC_BOOTSTRAP_API_PUBLIC_ENDPOINT ?? env.PUBLIC_BOOTSTRAP_API_ENDPOINT,
	PUBLIC_RELAY_DIRECTORY_URL: env.PUBLIC_RELAY_DIRECTORY_URL ?? null,
};
