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

import {Config} from '@fluxer/api/src/Config';
import {sanitizeLimitConfigForInstance} from '@fluxer/api/src/constants/LimitConfig';
import {fetchMany, fetchOne, upsertOne} from '@fluxer/api/src/database/Cassandra';
import type {InstanceConfigurationRow} from '@fluxer/api/src/database/types/InstanceConfigTypes';
import {Logger} from '@fluxer/api/src/Logger';
import {InstanceConfiguration} from '@fluxer/api/src/Tables';
import type {LimitConfigSnapshot} from '@fluxer/limits/src/LimitTypes';

const FETCH_CONFIG_QUERY = InstanceConfiguration.selectCql({
	where: InstanceConfiguration.where.eq('key'),
	limit: 1,
});

const FETCH_ALL_CONFIG_QUERY = InstanceConfiguration.selectCql();

export interface InstanceConfig {
	manualReviewEnabled: boolean;
	manualReviewScheduleEnabled: boolean;
	manualReviewScheduleStartHourUtc: number;
	manualReviewScheduleEndHourUtc: number;
	registrationAlertsWebhookUrl: string | null;
	systemAlertsWebhookUrl: string | null;
}

export interface InstanceSsoConfig {
	enabled: boolean;
	displayName: string | null;
	issuer: string | null;
	authorizationUrl: string | null;
	tokenUrl: string | null;
	userInfoUrl: string | null;
	jwksUrl: string | null;
	clientId: string | null;
	clientSecret?: string | null;
	clientSecretSet?: boolean;
	scope: string | null;
	allowedEmailDomains: Array<string>;
	autoProvision: boolean;
	redirectUri: string | null;
}

export class InstanceConfigRepository {
	async getConfig(key: string): Promise<string | null> {
		const row = await fetchOne<InstanceConfigurationRow>(FETCH_CONFIG_QUERY, {key});
		return row?.value ?? null;
	}

	async getAllConfigs(): Promise<Map<string, string>> {
		const rows = await fetchMany<InstanceConfigurationRow>(FETCH_ALL_CONFIG_QUERY, {});
		const configs = new Map<string, string>();
		for (const row of rows) {
			if (row.value != null) {
				configs.set(row.key, row.value);
			}
		}
		return configs;
	}

	async setConfig(key: string, value: string): Promise<void> {
		await upsertOne(
			InstanceConfiguration.upsertAll({
				key,
				value,
				updated_at: new Date(),
			}),
		);
	}

	async getInstanceConfig(): Promise<InstanceConfig> {
		const configs = await this.getAllConfigs();

		return {
			manualReviewEnabled: configs.get('manual_review_enabled') === 'true',
			manualReviewScheduleEnabled: configs.get('manual_review_schedule_enabled') === 'true',
			manualReviewScheduleStartHourUtc: Number.parseInt(
				configs.get('manual_review_schedule_start_hour_utc') ?? '0',
				10,
			),
			manualReviewScheduleEndHourUtc: Number.parseInt(configs.get('manual_review_schedule_end_hour_utc') ?? '23', 10),
			registrationAlertsWebhookUrl: configs.get('registration_alerts_webhook_url') ?? null,
			systemAlertsWebhookUrl: configs.get('system_alerts_webhook_url') ?? null,
		};
	}

	async setManualReviewEnabled(enabled: boolean): Promise<void> {
		await this.setConfig('manual_review_enabled', enabled ? 'true' : 'false');
	}

	async setManualReviewSchedule(scheduleEnabled: boolean, startHourUtc: number, endHourUtc: number): Promise<void> {
		await this.setConfig('manual_review_schedule_enabled', scheduleEnabled ? 'true' : 'false');
		await this.setConfig('manual_review_schedule_start_hour_utc', String(startHourUtc));
		await this.setConfig('manual_review_schedule_end_hour_utc', String(endHourUtc));
	}

	async setRegistrationAlertsWebhookUrl(url: string | null): Promise<void> {
		if (url) {
			await this.setConfig('registration_alerts_webhook_url', url);
		} else {
			await this.setConfig('registration_alerts_webhook_url', '');
		}
	}

	async setSystemAlertsWebhookUrl(url: string | null): Promise<void> {
		if (url) {
			await this.setConfig('system_alerts_webhook_url', url);
		} else {
			await this.setConfig('system_alerts_webhook_url', '');
		}
	}

	isManualReviewActiveNow(config: InstanceConfig): boolean {
		if (!config.manualReviewEnabled) {
			return false;
		}

		if (!config.manualReviewScheduleEnabled) {
			return true;
		}

		const nowUtc = new Date();
		const currentHour = nowUtc.getUTCHours();

		const start = config.manualReviewScheduleStartHourUtc;
		const end = config.manualReviewScheduleEndHourUtc;

		if (start <= end) {
			return currentHour >= start && currentHour <= end;
		}
		return currentHour >= start || currentHour <= end;
	}

	async hasLimitConfig(): Promise<boolean> {
		const raw = await this.getConfig('limit_config');
		return raw !== null;
	}

	async getLimitConfig(): Promise<LimitConfigSnapshot | null> {
		const raw = await this.getConfig('limit_config');
		if (!raw) {
			return null;
		}

		try {
			const parsed: LimitConfigSnapshot = JSON.parse(raw);
			return sanitizeLimitConfigForInstance(parsed, {selfHosted: Config.instance.selfHosted});
		} catch (error) {
			Logger.warn({error}, 'Invalid limit config JSON, returning null');
			return null;
		}
	}

	async setLimitConfig(config: LimitConfigSnapshot): Promise<void> {
		await this.setConfig('limit_config', JSON.stringify(config));
	}

	async getSsoConfig(options?: {includeSecret?: boolean}): Promise<InstanceSsoConfig> {
		const configs = await this.getAllConfigs();

		const read = (key: string): string | null => {
			const v = configs.get(key);
			if (!v) return null;
			const trimmed = v.trim();
			return trimmed.length === 0 ? null : trimmed;
		};

		const allowedDomainsRaw = configs.get('sso_allowed_domains');
		let allowedDomains: Array<string> = [];
		if (allowedDomainsRaw) {
			try {
				const parsed = JSON.parse(allowedDomainsRaw);
				if (Array.isArray(parsed)) {
					allowedDomains = parsed.map((item) => String(item)).filter((item) => item.length > 0);
				}
			} catch {
				allowedDomains = allowedDomainsRaw
					.split(',')
					.map((s) => s.trim())
					.filter((s) => s.length > 0);
			}
		}

		const clientSecret = read('sso_client_secret');

		return {
			enabled: configs.get('sso_enabled') === 'true',
			displayName: read('sso_display_name'),
			issuer: read('sso_issuer'),
			authorizationUrl: read('sso_authorization_url'),
			tokenUrl: read('sso_token_url'),
			userInfoUrl: read('sso_userinfo_url'),
			jwksUrl: read('sso_jwks_url'),
			clientId: read('sso_client_id'),
			clientSecret: options?.includeSecret ? clientSecret : undefined,
			clientSecretSet: Boolean(clientSecret),
			scope: read('sso_scope'),
			allowedEmailDomains: allowedDomains,
			autoProvision: configs.get('sso_auto_provision') !== 'false',
			redirectUri: read('sso_redirect_uri'),
		};
	}

	async setSsoConfig(config: Partial<InstanceSsoConfig>): Promise<InstanceSsoConfig> {
		const current = await this.getSsoConfig({includeSecret: true});
		const next: InstanceSsoConfig = {
			...current,
			...config,
			clientSecret: config.clientSecret !== undefined ? config.clientSecret : current.clientSecret,
		};

		await Promise.all([
			this.setConfig('sso_enabled', next.enabled ? 'true' : 'false'),
			this.setConfig('sso_display_name', next.displayName ?? ''),
			this.setConfig('sso_issuer', next.issuer ?? ''),
			this.setConfig('sso_authorization_url', next.authorizationUrl ?? ''),
			this.setConfig('sso_token_url', next.tokenUrl ?? ''),
			this.setConfig('sso_userinfo_url', next.userInfoUrl ?? ''),
			this.setConfig('sso_jwks_url', next.jwksUrl ?? ''),
			this.setConfig('sso_client_id', next.clientId ?? ''),
			this.setConfig('sso_scope', next.scope ?? ''),
			this.setConfig('sso_allowed_domains', JSON.stringify(next.allowedEmailDomains ?? [])),
			this.setConfig('sso_auto_provision', next.autoProvision ? 'true' : 'false'),
			this.setConfig('sso_redirect_uri', next.redirectUri ?? ''),
		]);

		if (config.clientSecret !== undefined) {
			await this.setConfig('sso_client_secret', config.clientSecret ?? '');
		}

		return this.getSsoConfig({includeSecret: true});
	}
}
