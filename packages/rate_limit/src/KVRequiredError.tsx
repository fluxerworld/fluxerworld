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

export interface KVRequiredErrorOptions {
	serviceName: string;

	configPath: string;

	fluxerServerHint?: string;
}

export function throwKVRequiredError(options: KVRequiredErrorOptions): never {
	const {serviceName, configPath, fluxerServerHint} = options;

	const message =
		`${serviceName} running in standalone mode requires KV-backed rate limiting. ` +
		`${configPath} is not set. ` +
		`Standalone services MUST have internal.kv configured for distributed rate limiting.`;

	const hint = fluxerServerHint
		? `If running in fluxer_server mode, ensure ${fluxerServerHint}.`
		: `If running in fluxer_server mode, ensure setInjectedKVProvider() is called before service initialization.`;

	throw new Error(`${message} ${hint}`);
}
