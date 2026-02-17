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
import {InstanceConfigRepository} from '@fluxer/api/src/instance/InstanceConfigRepository';
import {requireAdminACL} from '@fluxer/api/src/middleware/AdminMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import {InstanceConfigResponse, InstanceConfigUpdateRequest} from '@fluxer/schema/src/domains/admin/AdminSchemas';

const instanceConfigRepository = new InstanceConfigRepository();

export function InstanceConfigAdminController(app: HonoApp) {
	app.post(
		'/admin/instance-config/get',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.INSTANCE_CONFIG_VIEW),
		OpenAPI({
			operationId: 'get_instance_config',
			summary: 'Get instance configuration',
			description:
				'Retrieves instance-wide configuration including manual review settings, webhooks, and SSO configuration. Returns current state and schedule information. Requires INSTANCE_CONFIG_VIEW permission.',
			responseSchema: InstanceConfigResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const config = await instanceConfigRepository.getInstanceConfig();
			const isActiveNow = instanceConfigRepository.isManualReviewActiveNow(config);
			const ssoConfig = await instanceConfigRepository.getSsoConfig();

			return ctx.json({
				manual_review_enabled: config.manualReviewEnabled,
				manual_review_schedule_enabled: config.manualReviewScheduleEnabled,
				manual_review_schedule_start_hour_utc: config.manualReviewScheduleStartHourUtc,
				manual_review_schedule_end_hour_utc: config.manualReviewScheduleEndHourUtc,
				manual_review_active_now: isActiveNow,
				registration_alerts_webhook_url: config.registrationAlertsWebhookUrl,
				system_alerts_webhook_url: config.systemAlertsWebhookUrl,
				sso: {
					enabled: ssoConfig.enabled,
					display_name: ssoConfig.displayName,
					issuer: ssoConfig.issuer,
					authorization_url: ssoConfig.authorizationUrl,
					token_url: ssoConfig.tokenUrl,
					userinfo_url: ssoConfig.userInfoUrl,
					jwks_url: ssoConfig.jwksUrl,
					client_id: ssoConfig.clientId,
					client_secret_set: ssoConfig.clientSecretSet ?? false,
					scope: ssoConfig.scope,
					allowed_domains: ssoConfig.allowedEmailDomains,
					auto_provision: ssoConfig.autoProvision,
					redirect_uri: ssoConfig.redirectUri,
				},
				self_hosted: Config.instance.selfHosted,
			});
		},
	);

	app.post(
		'/admin/instance-config/update',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_USER_MODIFY),
		requireAdminACL(AdminACLs.INSTANCE_CONFIG_UPDATE),
		Validator('json', InstanceConfigUpdateRequest),
		OpenAPI({
			operationId: 'update_instance_config',
			summary: 'Update instance configuration',
			description:
				'Updates instance configuration settings including manual review mode, webhook URLs, and SSO parameters. Changes apply immediately. Requires INSTANCE_CONFIG_UPDATE permission.',
			responseSchema: InstanceConfigResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const data = ctx.req.valid('json');

			if (data.manual_review_enabled !== undefined) {
				await instanceConfigRepository.setManualReviewEnabled(data.manual_review_enabled);
			}

			if (
				data.manual_review_schedule_enabled !== undefined ||
				data.manual_review_schedule_start_hour_utc !== undefined ||
				data.manual_review_schedule_end_hour_utc !== undefined
			) {
				const currentConfig = await instanceConfigRepository.getInstanceConfig();

				const scheduleEnabled = data.manual_review_schedule_enabled ?? currentConfig.manualReviewScheduleEnabled;
				const startHour = data.manual_review_schedule_start_hour_utc ?? currentConfig.manualReviewScheduleStartHourUtc;
				const endHour = data.manual_review_schedule_end_hour_utc ?? currentConfig.manualReviewScheduleEndHourUtc;

				await instanceConfigRepository.setManualReviewSchedule(scheduleEnabled, startHour, endHour);
			}

			if (data.registration_alerts_webhook_url !== undefined) {
				await instanceConfigRepository.setRegistrationAlertsWebhookUrl(data.registration_alerts_webhook_url);
			}

			if (data.system_alerts_webhook_url !== undefined) {
				await instanceConfigRepository.setSystemAlertsWebhookUrl(data.system_alerts_webhook_url);
			}

			if (data.sso) {
				const sso = data.sso;
				await instanceConfigRepository.setSsoConfig({
					enabled: sso.enabled ?? undefined,
					displayName: sso.display_name ?? undefined,
					issuer: sso.issuer ?? undefined,
					authorizationUrl: sso.authorization_url ?? undefined,
					tokenUrl: sso.token_url ?? undefined,
					userInfoUrl: sso.userinfo_url ?? undefined,
					jwksUrl: sso.jwks_url ?? undefined,
					clientId: sso.client_id ?? undefined,
					clientSecret: sso.client_secret ?? undefined,
					scope: sso.scope ?? undefined,
					allowedEmailDomains: sso.allowed_domains ?? undefined,
					autoProvision: sso.auto_provision ?? undefined,
					redirectUri: sso.redirect_uri ?? undefined,
				});
			}

			const updatedConfig = await instanceConfigRepository.getInstanceConfig();
			const isActiveNow = instanceConfigRepository.isManualReviewActiveNow(updatedConfig);
			const updatedSso = await instanceConfigRepository.getSsoConfig();

			return ctx.json({
				manual_review_enabled: updatedConfig.manualReviewEnabled,
				manual_review_schedule_enabled: updatedConfig.manualReviewScheduleEnabled,
				manual_review_schedule_start_hour_utc: updatedConfig.manualReviewScheduleStartHourUtc,
				manual_review_schedule_end_hour_utc: updatedConfig.manualReviewScheduleEndHourUtc,
				manual_review_active_now: isActiveNow,
				registration_alerts_webhook_url: updatedConfig.registrationAlertsWebhookUrl,
				system_alerts_webhook_url: updatedConfig.systemAlertsWebhookUrl,
				sso: {
					enabled: updatedSso.enabled,
					display_name: updatedSso.displayName,
					issuer: updatedSso.issuer,
					authorization_url: updatedSso.authorizationUrl,
					token_url: updatedSso.tokenUrl,
					userinfo_url: updatedSso.userInfoUrl,
					jwks_url: updatedSso.jwksUrl,
					client_id: updatedSso.clientId,
					client_secret_set: updatedSso.clientSecretSet ?? false,
					scope: updatedSso.scope,
					allowed_domains: updatedSso.allowedEmailDomains,
					auto_provision: updatedSso.autoProvision,
					redirect_uri: updatedSso.redirectUri,
				},
				self_hosted: Config.instance.selfHosted,
			});
		},
	);
}
