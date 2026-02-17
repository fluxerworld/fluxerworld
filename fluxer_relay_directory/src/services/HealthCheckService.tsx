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

import type {IRelayRepository, RelayInfo} from '@app/repositories/RelayRepository';
import type {Logger} from 'pino';

export interface HealthCheckConfig {
	interval_ms: number;
	timeout_ms: number;
	unhealthy_threshold: number;
}

export interface IHealthCheckService {
	start(): void;
	stop(): void;
	checkRelay(relay: RelayInfo): Promise<boolean>;
}

export class HealthCheckService implements IHealthCheckService {
	private readonly repository: IRelayRepository;
	private readonly config: HealthCheckConfig;
	private readonly logger: Logger;
	private intervalHandle: ReturnType<typeof setInterval> | null = null;

	constructor(repository: IRelayRepository, config: HealthCheckConfig, logger: Logger) {
		this.repository = repository;
		this.config = config;
		this.logger = logger.child({service: 'health-check'});
	}

	start(): void {
		if (this.intervalHandle) {
			return;
		}

		this.logger.info({interval_ms: this.config.interval_ms}, 'Starting relay health check service');

		this.intervalHandle = setInterval(() => {
			this.checkAllRelays().catch((err) => {
				this.logger.error({error: err}, 'Health check cycle failed');
			});
		}, this.config.interval_ms);

		this.checkAllRelays().catch((err) => {
			this.logger.error({error: err}, 'Initial health check failed');
		});
	}

	stop(): void {
		if (this.intervalHandle) {
			clearInterval(this.intervalHandle);
			this.intervalHandle = null;
			this.logger.info('Stopped relay health check service');
		}
	}

	async checkRelay(relay: RelayInfo): Promise<boolean> {
		const healthUrl = new URL('/_health', relay.url).toString();

		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), this.config.timeout_ms);

			const response = await fetch(healthUrl, {
				method: 'GET',
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			const isHealthy = response.ok;

			if (isHealthy) {
				this.repository.updateRelayHealth(relay.id, true, 0);
				this.logger.debug({relay_id: relay.id, relay_name: relay.name}, 'Relay health check passed');
			} else {
				this.handleFailedCheck(relay);
				this.logger.warn(
					{relay_id: relay.id, relay_name: relay.name, status: response.status},
					'Relay health check failed with non-OK status',
				);
			}

			return isHealthy;
		} catch (error) {
			this.handleFailedCheck(relay);
			this.logger.warn(
				{relay_id: relay.id, relay_name: relay.name, error: String(error)},
				'Relay health check failed with error',
			);
			return false;
		}
	}

	private handleFailedCheck(relay: RelayInfo): void {
		const newFailedChecks = relay.failed_checks + 1;
		const isHealthy = newFailedChecks < this.config.unhealthy_threshold;

		this.repository.updateRelayHealth(relay.id, isHealthy, newFailedChecks);

		if (!isHealthy) {
			this.logger.warn(
				{
					relay_id: relay.id,
					relay_name: relay.name,
					failed_checks: newFailedChecks,
					threshold: this.config.unhealthy_threshold,
				},
				'Relay marked as unhealthy',
			);
		}
	}

	private async checkAllRelays(): Promise<void> {
		const relays = this.repository.getAllRelays();

		this.logger.debug({relay_count: relays.length}, 'Running health checks');

		const results = await Promise.allSettled(relays.map((relay: RelayInfo) => this.checkRelay(relay)));

		const healthy = results.filter(
			(r): r is PromiseFulfilledResult<boolean> => r.status === 'fulfilled' && r.value,
		).length;
		const unhealthy = relays.length - healthy;

		this.logger.info({total: relays.length, healthy, unhealthy}, 'Health check cycle completed');
	}
}
