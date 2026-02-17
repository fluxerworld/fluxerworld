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

import {AuditLogActionType} from '@fluxer/constants/src/AuditLogActionType';
import {AuditLogActionTypeSchema} from '@fluxer/schema/src/primitives/AuditLogValidators';
import {describe, expect, it} from 'vitest';

describe('AuditLogActionTypeSchema', () => {
	it('accepts valid audit log action types', () => {
		const result = AuditLogActionTypeSchema.safeParse(AuditLogActionType.GUILD_UPDATE);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(AuditLogActionType.GUILD_UPDATE);
		}
	});

	it('accepts channel action types', () => {
		const result = AuditLogActionTypeSchema.safeParse(AuditLogActionType.CHANNEL_CREATE);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(AuditLogActionType.CHANNEL_CREATE);
		}
	});

	it('accepts member action types', () => {
		const result = AuditLogActionTypeSchema.safeParse(AuditLogActionType.MEMBER_KICK);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(AuditLogActionType.MEMBER_KICK);
		}
	});

	it('accepts role action types', () => {
		const result = AuditLogActionTypeSchema.safeParse(AuditLogActionType.ROLE_CREATE);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(AuditLogActionType.ROLE_CREATE);
		}
	});

	it('accepts message action types', () => {
		const result = AuditLogActionTypeSchema.safeParse(AuditLogActionType.MESSAGE_DELETE);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(AuditLogActionType.MESSAGE_DELETE);
		}
	});

	it('rejects non-numeric values', () => {
		const result = AuditLogActionTypeSchema.safeParse('invalid');
		expect(result.success).toBe(false);
	});
});
