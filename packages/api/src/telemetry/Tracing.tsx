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

import {getActiveSpan, getTracer} from '@fluxer/telemetry/src/Tracing';
import type {Attributes, SpanKind} from '@opentelemetry/api';
import {SpanStatusCode} from '@opentelemetry/api';

const tracer = getTracer('fluxer-api');

export interface SpanOptions {
	name: string;
	attributes?: Attributes;
	kind?: SpanKind;
}

export async function withSpan<T>(options: SpanOptions, fn: () => Promise<T>): Promise<T> {
	return await tracer.startActiveSpan(
		options.name,
		{
			attributes: options.attributes ?? {},
			kind: options.kind,
		},
		async (span) => {
			try {
				const result = await fn();
				span.setStatus({code: SpanStatusCode.OK});
				return result;
			} catch (error) {
				const attributes: Attributes = {
					error: true,
					'error.message': error instanceof Error ? error.message : String(error),
				};
				if (error instanceof Error) {
					attributes['error.type'] = error.name;
					if (error.stack) {
						attributes['error.stack'] = error.stack;
					}
				}
				span.setAttributes(attributes);
				span.setStatus({
					code: SpanStatusCode.ERROR,
					message: error instanceof Error ? error.message : String(error),
				});
				throw error;
			} finally {
				span.end();
			}
		},
	);
}

export function setSpanAttributes(attributes: Attributes): void {
	const span = getActiveSpan();
	if (span) {
		span.setAttributes(attributes);
	}
}

export function addSpanEvent(name: string, attributes?: Attributes): void {
	const span = getActiveSpan();
	if (span) {
		span.addEvent(name, attributes);
	}
}
