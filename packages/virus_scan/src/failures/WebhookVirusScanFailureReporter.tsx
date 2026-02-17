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

import type {LoggerInterface} from '@fluxer/logger/src/LoggerInterface';
import type {IVirusScanFailureReporter} from '@fluxer/virus_scan/src/failures/IVirusScanFailureReporter';
import type {VirusScanFailureContext} from '@fluxer/virus_scan/src/failures/VirusScanFailureContext';
import {ms} from 'itty-time';

const DEFAULT_ALERT_SAMPLE_RATE = 0.05;
const DEFAULT_ERROR_FIELD_LIMIT = 900;
const DEFAULT_REQUEST_TIMEOUT_MS = ms('5 seconds');

export interface VirusScanWebhookFailureReporterConfig {
	getWebhookUrl: () => Promise<string | undefined>;
	logger: LoggerInterface;
	sampleRate?: number;
	errorFieldLimit?: number;
	requestTimeoutMs?: number;
}

export class WebhookVirusScanFailureReporter implements IVirusScanFailureReporter {
	private readonly sampleRate: number;
	private readonly errorFieldLimit: number;
	private readonly requestTimeoutMs: number;
	private readonly timeoutSeconds: number;

	constructor(private config: VirusScanWebhookFailureReporterConfig) {
		this.sampleRate = config.sampleRate ?? DEFAULT_ALERT_SAMPLE_RATE;
		this.errorFieldLimit = config.errorFieldLimit ?? DEFAULT_ERROR_FIELD_LIMIT;
		this.requestTimeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
		this.timeoutSeconds = Math.round(this.requestTimeoutMs / 1000);
	}

	async initialize(): Promise<void> {
		const webhookUrl = await this.config.getWebhookUrl();
		if (!webhookUrl) {
			this.config.logger.warn(
				'VirusScanService initialised without systemAlertsWebhookUrl configured - virus scan failure alerts will be disabled',
			);
		}
	}

	async reportFailure(context: VirusScanFailureContext): Promise<void> {
		const webhookUrl = await this.config.getWebhookUrl();
		if (!webhookUrl) {
			return;
		}
		if (Math.random() >= this.sampleRate) {
			return;
		}

		const errorDescription = this.truncateText(this.describeError(context.error), this.errorFieldLimit);
		const payload = this.buildPayload(context, errorDescription);

		try {
			const response = await fetch(webhookUrl, {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify(payload),
				signal: AbortSignal.timeout(this.requestTimeoutMs),
			});

			if (!response.ok) {
				const responseBody = await response.text();
				this.config.logger.warn(
					{
						statusCode: response.status,
						responseBody,
					},
					'Failed to deliver virus scan alert',
				);
			}
		} catch (error) {
			if (error instanceof Error && error.name === 'TimeoutError') {
				this.config.logger.warn(`Virus scan alert webhook timed out after ${this.timeoutSeconds}s`);
				return;
			}
			this.config.logger.warn(
				{
					error: error instanceof Error ? error.message : String(error),
				},
				'Failed to deliver virus scan alert',
			);
		}
	}

	private buildPayload(context: VirusScanFailureContext, errorDescription: string) {
		return {
			username: 'Virus Scan Monitor',
			content: 'A virus scan failed to complete.',
			embeds: [
				{
					title: 'Virus scan failure detected',
					description: `Unable to scan attachment ${context.filename}`,
					color: 0xe53e3e,
					fields: [
						{
							name: 'Scan mode',
							value: context.failOpen ? 'Fail-open' : 'Fail-closed',
							inline: true,
						},
						{
							name: 'File hash',
							value: context.fileHash,
						},
						{
							name: 'Error',
							value: errorDescription || 'Unknown error',
						},
					],
					timestamp: new Date().toISOString(),
				},
			],
		};
	}

	private describeError(error: unknown): string {
		if (typeof error === 'string') {
			return error;
		}
		if (error instanceof Error) {
			return error.message;
		}
		return 'Unknown error';
	}

	private truncateText(value: string, limit: number): string {
		if (value.length <= limit) {
			return value;
		}
		return `${value.slice(0, limit - 3)}...`;
	}
}
