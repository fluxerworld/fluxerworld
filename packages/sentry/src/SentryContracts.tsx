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

import type {SeverityLevel} from '@sentry/node';

export interface SentryConfig {
	dsn?: string;
	environment?: string;
	release?: string;
	serviceName?: string;
	sampleRate?: number;
	buildSha?: string;
	buildNumber?: string;
	buildTimestamp?: string;
	releaseChannel?: string;
}

export interface SentryContext {
	[key: string]: unknown;
}

export interface SentryUser {
	id?: string;
	username?: string;
	email?: string;
	ip_address?: string;
}

export interface SentryBuildContext {
	sha?: string;
	number?: string;
	timestamp?: string;
	channel?: string;
}

export interface SentryClientInitConfig {
	dsn: string;
	environment: string;
	release?: string;
	dist?: string;
	serviceName?: string;
	sampleRate: number;
	buildContext: SentryBuildContext;
}

export interface SentryInitLogger {
	info(msg: string): void;
	info(obj: Record<string, unknown>, msg: string): void;
}

export interface ISentryClient {
	init(config: SentryClientInitConfig): void;
	captureException(error: Error, context?: SentryContext): void;
	captureMessage(message: string, level: SeverityLevel, context?: SentryContext): void;
	flush(timeout: number): Promise<void>;
	setUser(user: SentryUser | null): void;
}
