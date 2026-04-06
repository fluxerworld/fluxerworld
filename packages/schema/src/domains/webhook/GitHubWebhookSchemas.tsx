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

import {z} from 'zod';

// GitHub webhook payloads are extremely varied and contain many fields
// that change across API versions. We accept the entire payload as-is
// and let the individual transformers extract what they need.
// NOTE: z.record(z.any()) is broken in Zod v4 (crashes with _zod TypeError).
// Use z.record(z.string(), z.any()) which explicitly provides both key and value types.
export const GitHubWebhook = z.record(z.string(), z.any());

export type GitHubWebhook = z.infer<typeof GitHubWebhook>;
