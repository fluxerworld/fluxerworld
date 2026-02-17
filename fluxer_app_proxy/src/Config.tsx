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

import {loadConfig} from '@fluxer/config/src/ConfigLoader';
import {extractBaseServiceConfig} from '@fluxer/config/src/ServiceConfigSlices';

function normalizeProxyPath(value: string | undefined): string {
	const defaultPath = '/error-reporting-proxy';
	let clean = (value ?? '').trim();

	if (clean === '') {
		return defaultPath;
	}

	if (!clean.startsWith('/')) {
		clean = `/${clean}`;
	}

	if (clean !== '/') {
		clean = clean.replace(/\/+$/, '');
		if (clean === '') {
			return '/';
		}
	}

	return clean;
}

function parseSentryDsn(dsn: string | undefined): {
	project_id: string;
	public_key: string;
	target_url: string;
	path_prefix: string;
} | null {
	if (!dsn?.trim()) {
		return null;
	}

	try {
		const parsed = new URL(dsn.trim());

		if (!parsed.protocol || !parsed.host) {
			return null;
		}

		const pathPart = parsed.pathname.replace(/^\/+|\/+$/g, '');
		const segments = pathPart ? pathPart.split('/') : [];

		if (segments.length === 0) {
			return null;
		}

		const projectId = segments[segments.length - 1]!;
		const prefixSegments = segments.slice(0, -1);
		const pathPrefix = prefixSegments.length > 0 ? `/${prefixSegments.join('/')}` : '';

		const publicKey = parsed.username;
		if (!publicKey) {
			return null;
		}

		return {
			project_id: projectId,
			public_key: publicKey,
			target_url: `${parsed.protocol}//${parsed.host}`,
			path_prefix: pathPrefix,
		};
	} catch {
		return null;
	}
}

const master = await loadConfig();
const appProxy = master.services.app_proxy;

if (!appProxy?.kv) {
	throw new Error('Application proxy requires `kv` configuration');
}

if (!appProxy.rate_limit) {
	throw new Error('Application proxy requires `rate_limit` configuration');
}

export const Config = {
	...extractBaseServiceConfig(master),
	port: appProxy.port,
	static_cdn_endpoint: appProxy.static_cdn_endpoint,
	sentry_proxy_path: normalizeProxyPath(appProxy.sentry_proxy_path),
	sentry_report_host: appProxy.sentry_report_host.replace(/\/+$/, ''),
	sentry_proxy: parseSentryDsn(appProxy.sentry_dsn),
	assets_dir: appProxy.assets_dir,
	kv: {
		url: appProxy.kv.url,
		timeout_ms: appProxy.kv.timeout_ms ?? 5000,
	},
	rate_limit: {
		sentry: appProxy.rate_limit.sentry,
	},
};

export type Config = typeof Config;
