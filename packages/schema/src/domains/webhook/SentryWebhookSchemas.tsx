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

import {createStringType} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {URLType} from '@fluxer/schema/src/primitives/UrlValidators';
import {z} from 'zod';

const SentryProject = z.object({
	id: createStringType(0, 152133),
	name: createStringType(0, 152133),
	slug: createStringType(0, 152133),
	platform: createStringType(0, 152133),
});

const SentryMetadata = z.object({
	value: createStringType(0, 4096),
	type: createStringType(0, 152133),
});

const SentryIssue = z.object({
	id: createStringType(0, 152133),
	shortId: createStringType(0, 152133),
	title: createStringType(0, 512),
	culprit: createStringType(0, 512).optional(),
	permalink: URLType,
	level: createStringType(0, 64),
	status: createStringType(0, 64),
	platform: createStringType(0, 64),
	project: SentryProject,
	type: createStringType(0, 64),
	metadata: SentryMetadata.loose(),
	count: createStringType(0, 64),
	userCount: z.number(),
	firstSeen: createStringType(0, 64),
	lastSeen: createStringType(0, 64),
});

const SentryInstallation = z.object({
	uuid: createStringType(0, 152133),
});

const SentryActor = z.object({
	type: createStringType(0, 64),
	id: createStringType(0, 152133),
	name: createStringType(0, 152133),
});

const SentryIssueData = z.object({
	issue: SentryIssue,
});

export const SentryWebhook = z.object({
	action: createStringType(0, 64).nullish(),
	installation: SentryInstallation.nullish(),
	data: SentryIssueData.nullish(),
	actor: SentryActor.nullish(),
});

export type SentryWebhook = z.infer<typeof SentryWebhook>;
