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

import {parseString} from '@fluxer/api/src/utils/StringUtils';
import type {RichEmbedRequest} from '@fluxer/schema/src/domains/message/MessageRequestSchemas';
import type {SentryWebhook} from '@fluxer/schema/src/domains/webhook/SentryWebhookSchemas';

export async function transform(event: string, body: SentryWebhook): Promise<RichEmbedRequest | null> {
	switch (event) {
		case 'created':
			return transformIssueCreated(body);
		default:
			return null;
	}
}

async function transformIssueCreated(body: SentryWebhook): Promise<RichEmbedRequest | null> {
	if (body.action !== 'created' || !body.data?.issue) {
		return null;
	}

	const issue = body.data.issue;
	const level = issue.level.toUpperCase();

	const levelColors: Record<string, number> = {
		ERROR: 0xeb4841,
		WARNING: 0xfcbd1f,
		INFO: 0x369df7,
		DEBUG: 0x6c7293,
	};

	const color = levelColors[level] ?? 0x369df7;

	return {
		title: parseString(issue.title, 70),
		url: issue.permalink,
		color,
		fields: [
			{
				name: 'Culprit',
				value: issue.culprit ? parseString(issue.culprit, 1024) : 'Unknown',
				inline: false,
			},
			{
				name: 'Project',
				value: issue.project.name,
				inline: true,
			},
			{
				name: 'Level',
				value: level,
				inline: true,
			},
			{
				name: 'ID',
				value: issue.shortId,
				inline: true,
			},
		].filter((f) => f.value !== 'Unknown' || f.name === 'Culprit'),
	};
}
