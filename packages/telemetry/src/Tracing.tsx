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

import type {Attributes, Span} from '@opentelemetry/api';
import {SpanStatusCode, trace} from '@opentelemetry/api';

const DEFAULT_TRACER_NAME = 'fluxer';

export interface WithSpanOptions {
	attributes?: Attributes;
	tracerName?: string;
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return 'Unknown error';
}

export function getTracer(name: string = DEFAULT_TRACER_NAME) {
	return trace.getTracer(name);
}

export async function withSpan<T>(
	name: string,
	fn: (span: Span) => Promise<T> | T,
	options?: WithSpanOptions,
): Promise<T> {
	const tracer = getTracer(options?.tracerName);
	const spanOptions = options?.attributes === undefined ? {} : {attributes: options.attributes};
	return tracer.startActiveSpan(name, spanOptions, async (span) => {
		try {
			const result = await fn(span);
			span.setStatus({code: SpanStatusCode.OK});
			return result;
		} catch (error) {
			span.setStatus({
				code: SpanStatusCode.ERROR,
				message: getErrorMessage(error),
			});
			throw error;
		} finally {
			span.end();
		}
	}) as Promise<T>;
}

export function addSpanEvent(name: string, attributes?: Attributes): void {
	const activeSpan = trace.getActiveSpan();
	if (activeSpan !== undefined) {
		activeSpan.addEvent(name, attributes);
	}
}

export function setSpanAttributes(attributes: Attributes): void {
	const activeSpan = trace.getActiveSpan();
	if (activeSpan !== undefined) {
		activeSpan.setAttributes(attributes);
	}
}

export function getActiveSpan(): Span | undefined {
	return trace.getActiveSpan();
}

export function formatTraceparent(span: Span): string | null {
	const spanContext = span.spanContext();
	if (!spanContext.traceId || !spanContext.spanId) {
		return null;
	}
	const traceFlags = spanContext.traceFlags?.toString(16).padStart(2, '0') ?? '00';
	return `00-${spanContext.traceId}-${spanContext.spanId}-${traceFlags}`;
}
