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

import {Logger} from '@fluxer/api/src/Logger';
import * as FetchUtils from '@fluxer/api/src/utils/FetchUtils';
import {FLUXER_USER_AGENT} from '@fluxer/constants/src/Core';
import {ms} from 'itty-time';

export interface GuildCrashAlertParams {
	guildId: string;
	stacktrace: string;
	timestamp?: string;
}

export class AlertService {
	private readonly webhookUrl: string | null;

	constructor(webhookUrl: string | null | undefined) {
		this.webhookUrl = webhookUrl ?? null;
		if (!this.webhookUrl) {
			Logger.warn('AlertService initialised without a webhook URL – guild crash alerts will be disabled');
		}
	}

	isEnabled(): boolean {
		return this.webhookUrl !== null;
	}

	async logGuildCrash(params: GuildCrashAlertParams): Promise<void> {
		if (!this.webhookUrl) return;

		const timestamp = params.timestamp ?? new Date().toISOString();
		const boundary = `----FluxerCrash${Date.now()}`;
		const payload = {
			content: 'Guild crash detected on the gateway.',
			embeds: [
				{
					title: 'Guild crash',
					description: 'A guild worker process has terminated unexpectedly.',
					color: 0xed_42_45,
					fields: [
						{name: 'Guild ID', value: `\`${params.guildId}\``, inline: true},
						{name: 'Timestamp', value: timestamp, inline: true},
					],
					footer: {
						text: 'Fluxer Gateway Alerts',
					},
					timestamp,
				},
			],
		};

		const stacktraceFilename = `guild-${params.guildId}-stacktrace.txt`;
		const lines = [
			`--${boundary}`,
			'Content-Disposition: form-data; name="payload_json"',
			'',
			JSON.stringify(payload),
			`--${boundary}`,
			`Content-Disposition: form-data; name="file"; filename="${stacktraceFilename}"`,
			'Content-Type: text/plain',
			'',
			params.stacktrace,
			`--${boundary}--`,
			'',
		];
		const body = Buffer.from(lines.join('\r\n'), 'utf-8');

		try {
			const response = await FetchUtils.sendRequest({
				url: this.webhookUrl,
				method: 'POST',
				headers: {
					'Content-Type': `multipart/form-data; boundary=${boundary}`,
					'User-Agent': FLUXER_USER_AGENT,
				},
				body,
				timeout: ms('15 seconds'),
				serviceName: 'alert_webhook',
			});

			if (response.status < 200 || response.status >= 300) {
				const responseBody = await FetchUtils.streamToString(response.stream).catch(() => '');
				Logger.error(
					{status: response.status, body: responseBody, guildId: params.guildId},
					'Guild crash alert webhook responded with non-OK status',
				);
			}
		} catch (error) {
			Logger.error({error, guildId: params.guildId}, 'Failed to send guild crash alert');
		}
	}
}
