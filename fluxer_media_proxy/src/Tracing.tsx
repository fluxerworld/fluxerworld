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

import type {SpanOptions, TracingInterface} from '@fluxer/media_proxy/src/types/Tracing';
import {addSpanEvent as telemetryAddSpanEvent, withSpan as telemetryWithSpan} from '@fluxer/telemetry/src/Tracing';
import type {Attributes} from '@opentelemetry/api';

export function createTracing(): TracingInterface {
	return {
		async withSpan<T>(options: SpanOptions, fn: () => Promise<T>): Promise<T> {
			return telemetryWithSpan(options.name, async () => fn(), {
				attributes: options.attributes as Attributes | undefined,
			});
		},
		addSpanEvent(name: string, attributes?: Record<string, unknown>): void {
			telemetryAddSpanEvent(name, attributes as Attributes | undefined);
		},
	};
}
