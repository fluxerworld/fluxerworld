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

import type {
	ISentryClient,
	SentryBuildContext,
	SentryClientInitConfig,
	SentryContext,
	SentryUser,
} from '@fluxer/sentry/src/SentryContracts';
import * as Sentry from '@sentry/node';

export const SentryNodeClient: ISentryClient = {
	init(config: SentryClientInitConfig): void {
		const buildContextEntries = toBuildContextEntries(config.buildContext);

		Sentry.init({
			dsn: config.dsn,
			...(config.release !== undefined && {release: config.release}),
			...(config.dist !== undefined && {dist: config.dist}),
			environment: config.environment,
			tracesSampleRate: config.sampleRate,
			profilesSampleRate: config.sampleRate,
			initialScope: (scope) => {
				if (config.serviceName) {
					scope.setTag('service', config.serviceName);
				}
				if (config.buildContext.channel) {
					scope.setTag('release_channel', config.buildContext.channel);
				}
				if (config.buildContext.sha) {
					scope.setTag('build_sha', config.buildContext.sha);
				}
				if (config.buildContext.number) {
					scope.setTag('build_number', config.buildContext.number);
				}
				if (config.buildContext.timestamp) {
					scope.setTag('build_timestamp', config.buildContext.timestamp);
				}
				if (buildContextEntries.length > 0) {
					scope.setContext('build', Object.fromEntries(buildContextEntries));
				}
				return scope;
			},
		});
	},
	captureException(error: Error, context?: SentryContext): void {
		Sentry.captureException(error, context !== undefined ? {extra: context} : undefined);
	},
	captureMessage(message: string, level: Sentry.SeverityLevel, context?: SentryContext): void {
		Sentry.captureMessage(message, {
			level,
			...(context !== undefined && {extra: context}),
		});
	},
	async flush(timeout: number): Promise<void> {
		await Sentry.flush(timeout);
	},
	setUser(user: SentryUser | null): void {
		Sentry.setUser(user);
	},
};

function toBuildContextEntries(buildContext: SentryBuildContext): Array<[string, string]> {
	const entries: Array<[string, string]> = [];

	if (buildContext.sha) {
		entries.push(['sha', buildContext.sha]);
	}
	if (buildContext.number) {
		entries.push(['number', buildContext.number]);
	}
	if (buildContext.timestamp) {
		entries.push(['timestamp', buildContext.timestamp]);
	}
	if (buildContext.channel) {
		entries.push(['channel', buildContext.channel]);
	}

	return entries;
}
