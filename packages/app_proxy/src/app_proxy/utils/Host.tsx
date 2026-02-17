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

export function normalizeHost(value: string): string {
	const trimmed = value.trim().toLowerCase();
	if (!trimmed) {
		return '';
	}
	const primary = trimmed.split(',')[0]?.trim() ?? '';
	if (primary.startsWith('[')) {
		const end = primary.indexOf(']');
		return end > 0 ? primary.slice(1, end) : primary;
	}
	return primary.split(':')[0] ?? primary;
}

export function resolveSentryHost(config: {
	sentry_proxy: {target_url: string} | null;
	sentry_report_host: string;
}): string | null {
	if (!config.sentry_proxy || !config.sentry_report_host) {
		return null;
	}

	const normalizedSentryHost = normalizeHostValue(config.sentry_report_host);
	return normalizedSentryHost || null;
}

function normalizeHostValue(rawHost: string): string {
	try {
		return normalizeHost(new URL(rawHost).host);
	} catch {
		return normalizeHost(rawHost);
	}
}
