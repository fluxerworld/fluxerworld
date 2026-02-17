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

import {resolveSentryInitConfig} from '@fluxer/sentry/src/SentryConfig';
import type {
	ISentryClient,
	SentryConfig,
	SentryContext,
	SentryInitLogger,
	SentryUser,
} from '@fluxer/sentry/src/SentryContracts';
import {DefaultSentryLogger} from '@fluxer/sentry/src/SentryLogger';
import type {SeverityLevel} from '@sentry/node';

export interface SentryServiceDependencies {
	client: ISentryClient;
	logger?: SentryInitLogger;
}

export class SentryService {
	private readonly client: ISentryClient;
	private readonly logger: SentryInitLogger;
	private initialized = false;

	public constructor(dependencies: SentryServiceDependencies) {
		this.client = dependencies.client;
		this.logger = dependencies.logger ?? DefaultSentryLogger;
	}

	public init(config?: SentryConfig): void {
		if (this.initialized) {
			this.logger.info('Sentry already initialized');
			return;
		}

		const resolvedConfig = resolveSentryInitConfig(config);
		if (resolvedConfig === null) {
			this.logger.info('Sentry DSN not configured, skipping initialization');
			return;
		}

		this.logger.info(
			{
				release: resolvedConfig.release,
				environment: resolvedConfig.environment,
				serviceName: resolvedConfig.serviceName,
			},
			'Initializing Sentry',
		);

		this.client.init(resolvedConfig);

		this.initialized = true;
		this.logger.info('Sentry initialized successfully');
	}

	public captureException(error: Error, context?: SentryContext): void {
		if (!this.initialized) {
			return;
		}

		this.client.captureException(error, context);
	}

	public captureMessage(message: string, level: SeverityLevel = 'info', context?: SentryContext): void {
		if (!this.initialized) {
			return;
		}

		this.client.captureMessage(message, level, context);
	}

	public async flush(timeout = 2000): Promise<void> {
		if (!this.initialized) {
			return;
		}

		await this.client.flush(timeout);
	}

	public setUser(user: SentryUser | null): void {
		this.client.setUser(user);
	}
}
