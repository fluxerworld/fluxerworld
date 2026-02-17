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

import {WebhookTypeSchema} from '@fluxer/schema/src/primitives/WebhookValidators';
import {describe, expect, it} from 'vitest';

describe('WebhookTypeSchema', () => {
	it('accepts incoming webhook type', () => {
		const result = WebhookTypeSchema.safeParse(1);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(1);
		}
	});

	it('accepts channel follower webhook type', () => {
		const result = WebhookTypeSchema.safeParse(2);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(2);
		}
	});

	it('rejects non-numeric values', () => {
		const result = WebhookTypeSchema.safeParse('invalid');
		expect(result.success).toBe(false);
	});
});
