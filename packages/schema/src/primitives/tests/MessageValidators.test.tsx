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

import {MessageReferenceTypes, MessageTypes} from '@fluxer/constants/src/ChannelConstants';
import {MessageReferenceTypeSchema, MessageTypeSchema} from '@fluxer/schema/src/primitives/MessageValidators';
import {describe, expect, it} from 'vitest';

describe('MessageTypeSchema', () => {
	it('accepts default message type', () => {
		const result = MessageTypeSchema.safeParse(MessageTypes.DEFAULT);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(MessageTypes.DEFAULT);
		}
	});

	it('accepts recipient add message type', () => {
		const result = MessageTypeSchema.safeParse(MessageTypes.RECIPIENT_ADD);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(MessageTypes.RECIPIENT_ADD);
		}
	});

	it('accepts call message type', () => {
		const result = MessageTypeSchema.safeParse(MessageTypes.CALL);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(MessageTypes.CALL);
		}
	});

	it('accepts reply message type', () => {
		const result = MessageTypeSchema.safeParse(MessageTypes.REPLY);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(MessageTypes.REPLY);
		}
	});

	it('rejects non-numeric values', () => {
		const result = MessageTypeSchema.safeParse('invalid');
		expect(result.success).toBe(false);
	});
});

describe('MessageReferenceTypeSchema', () => {
	it('accepts default reference type', () => {
		const result = MessageReferenceTypeSchema.safeParse(MessageReferenceTypes.DEFAULT);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(MessageReferenceTypes.DEFAULT);
		}
	});

	it('accepts forward reference type', () => {
		const result = MessageReferenceTypeSchema.safeParse(MessageReferenceTypes.FORWARD);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(MessageReferenceTypes.FORWARD);
		}
	});

	it('rejects non-numeric values', () => {
		const result = MessageReferenceTypeSchema.safeParse('invalid');
		expect(result.success).toBe(false);
	});
});
