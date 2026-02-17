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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import {z} from 'zod';

const RateLimitConfigSchema = z.object({
	limit: z.number().positive(),
	windowMs: z.number().positive(),
});

export const AdminConfigSchema = z.object({
	env: z.enum(['development', 'production', 'test']),
	secretKeyBase: z.string().min(1),
	apiEndpoint: z.url(),
	mediaEndpoint: z.url(),
	staticCdnEndpoint: z.url(),
	adminEndpoint: z.url(),
	webAppEndpoint: z.url(),
	kvUrl: z.url(),
	oauthClientId: z.string().min(1),
	oauthClientSecret: z.string().min(1),
	oauthRedirectUri: z.url(),
	basePath: z.string(),
	buildTimestamp: z.string(),
	releaseChannel: z.string(),
	selfHosted: z.boolean(),
	rateLimit: RateLimitConfigSchema.optional(),
});

export type AdminConfig = z.infer<typeof AdminConfigSchema>;
