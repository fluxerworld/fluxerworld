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

import {getConfig} from '@fluxer/config/src/ConfigLoader';

export type ReleaseChannel = 'stable' | 'canary' | 'nightly';

export interface BuildMetadata {
	buildSha: string;
	buildNumber: string;
	buildTimestamp: string;
	releaseChannel: ReleaseChannel;
}

const FALLBACK_VALUES = {
	BUILD_SHA: 'dev',
	BUILD_NUMBER: '0',
	RELEASE_CHANNEL: 'nightly',
} as const;

let fallbackLogged = false;

function isDevEnvironment(): boolean {
	try {
		const config = getConfig();
		return config.env === 'development' || config.env === 'test';
	} catch {
		return false;
	}
}

function logFallbackWarning(usedFallbacks: Array<string>): void {
	if (fallbackLogged || usedFallbacks.length === 0 || isDevEnvironment()) {
		return;
	}
	fallbackLogged = true;
	process.stdout.write(
		`[build-metadata] Using fallback values for: ${usedFallbacks.join(', ')}. ` +
			`This indicates missing env vars in CI/production.\n`,
	);
}

function getEnvOrDefault(name: string, defaultValue: string, usedFallbacks: Array<string>): string {
	const value = process.env[name];
	if (value !== undefined && value.trim() !== '') {
		return value.trim();
	}
	usedFallbacks.push(name);
	return defaultValue;
}

function resolveReleaseChannel(usedFallbacks: Array<string>): ReleaseChannel {
	const raw = getEnvOrDefault('RELEASE_CHANNEL', FALLBACK_VALUES.RELEASE_CHANNEL, usedFallbacks).toLowerCase();
	switch (raw) {
		case 'stable':
			return 'stable';
		case 'canary':
			return 'canary';
		default:
			return 'nightly';
	}
}

let cachedMetadata: BuildMetadata | null = null;

export function getBuildMetadata(): BuildMetadata {
	if (cachedMetadata === null) {
		const usedFallbacks: Array<string> = [];
		cachedMetadata = {
			buildSha: getEnvOrDefault('BUILD_SHA', FALLBACK_VALUES.BUILD_SHA, usedFallbacks),
			buildNumber: getEnvOrDefault('BUILD_NUMBER', FALLBACK_VALUES.BUILD_NUMBER, usedFallbacks),
			buildTimestamp: getEnvOrDefault('BUILD_TIMESTAMP', String(Math.floor(Date.now() / 1000)), usedFallbacks),
			releaseChannel: resolveReleaseChannel(usedFallbacks),
		};
		logFallbackWarning(usedFallbacks);
	}
	return cachedMetadata;
}

export function isDevBuild(): boolean {
	return getBuildMetadata().buildSha === 'dev';
}

export function getServiceVersionLabel(): string | undefined {
	const metadata = getBuildMetadata();
	return metadata.buildSha !== 'dev' ? metadata.buildSha : undefined;
}

export function getSentryBuildContext(): BuildMetadata {
	return getBuildMetadata();
}
