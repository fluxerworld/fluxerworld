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

import {type SpanOptions, withSpan} from '@fluxer/api/src/telemetry/Tracing';
import {recordCounter} from '@fluxer/telemetry/src/Metrics';

export async function withBusinessSpan<T>(
	spanName: string,
	metricName: string,
	attributes: Record<string, string> = {},
	fn: () => Promise<T>,
): Promise<T> {
	const spanOptions: SpanOptions = {
		name: spanName,
		attributes,
	};

	try {
		const result = await withSpan(spanOptions, fn);
		recordCounter({
			name: metricName,
			dimensions: {...attributes, status: 'success'},
			value: 1,
		});
		return result;
	} catch (error) {
		recordCounter({
			name: metricName,
			dimensions: {
				...attributes,
				status: 'error',
				error_type: error instanceof Error ? error.name : 'unknown',
			},
			value: 1,
		});
		throw error;
	}
}
