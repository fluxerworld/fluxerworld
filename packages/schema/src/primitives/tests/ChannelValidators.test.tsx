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

import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {
	AuditLogReasonType,
	ChannelNameType,
	GeneralChannelNameType,
	VanityURLCodeType,
} from '@fluxer/schema/src/primitives/ChannelValidators';
import {describe, expect, it} from 'vitest';

describe('ChannelNameType', () => {
	it('accepts valid channel names', () => {
		const result = ChannelNameType.safeParse('general');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe('general');
		}
	});

	it('converts to lowercase', () => {
		const result = ChannelNameType.safeParse('GENERAL');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe('general');
		}
	});

	it('replaces spaces with hyphens', () => {
		const result = ChannelNameType.safeParse('my channel');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe('my-channel');
		}
	});

	it('removes disallowed characters', () => {
		const result = ChannelNameType.safeParse('my#channel@name');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe('mychannelname');
		}
	});

	it('handles unicode characters', () => {
		const result = ChannelNameType.safeParse('channel-name');
		expect(result.success).toBe(true);
	});

	it('rejects channels exceeding max length', () => {
		const result = ChannelNameType.safeParse('a'.repeat(101));
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(ValidationErrorCodes.STRING_LENGTH_INVALID);
		}
	});

	it('falls back to hyphen for empty result', () => {
		const result = ChannelNameType.safeParse('###');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe('-');
		}
	});

	it('normalizes and trims input', () => {
		const result = ChannelNameType.safeParse('  my-channel  ');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe('my-channel');
		}
	});
});

describe('GeneralChannelNameType', () => {
	it('accepts valid channel names with spaces', () => {
		const result = GeneralChannelNameType.safeParse('General Chat');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe('General Chat');
		}
	});

	it('preserves case', () => {
		const result = GeneralChannelNameType.safeParse('My Channel');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe('My Channel');
		}
	});

	it('normalizes multiple spaces to single space', () => {
		const result = GeneralChannelNameType.safeParse('My   Channel');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe('My Channel');
		}
	});

	it('trims whitespace', () => {
		const result = GeneralChannelNameType.safeParse('  My Channel  ');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe('My Channel');
		}
	});

	it('rejects empty names after normalization', () => {
		const result = GeneralChannelNameType.safeParse('   ');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(ValidationErrorCodes.NAME_EMPTY_AFTER_NORMALIZATION);
		}
	});

	it('rejects names exceeding max length', () => {
		const result = GeneralChannelNameType.safeParse('a'.repeat(101));
		expect(result.success).toBe(false);
	});
});

describe('VanityURLCodeType', () => {
	it('accepts valid vanity URL codes', () => {
		const result = VanityURLCodeType.safeParse('myserver');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe('myserver');
		}
	});

	it('accepts codes with hyphens', () => {
		const result = VanityURLCodeType.safeParse('my-server');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe('my-server');
		}
	});

	it('accepts codes with numbers', () => {
		const result = VanityURLCodeType.safeParse('server123');
		expect(result.success).toBe(true);
	});

	it('converts to lowercase', () => {
		const result = VanityURLCodeType.safeParse('MyServer');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe('myserver');
		}
	});

	it('replaces spaces with hyphens', () => {
		const result = VanityURLCodeType.safeParse('my server');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe('my-server');
		}
	});

	it('collapses multiple hyphens', () => {
		const result = VanityURLCodeType.safeParse('my--server');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe('my-server');
		}
	});

	it('rejects codes that are too short', () => {
		const result = VanityURLCodeType.safeParse('a');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(ValidationErrorCodes.VANITY_URL_CODE_LENGTH_INVALID);
		}
	});

	it('rejects codes that are too long', () => {
		const result = VanityURLCodeType.safeParse('a'.repeat(33));
		expect(result.success).toBe(false);
	});

	it('rejects codes starting with hyphen', () => {
		const result = VanityURLCodeType.safeParse('-myserver');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(ValidationErrorCodes.VANITY_URL_INVALID_CHARACTERS);
		}
	});

	it('rejects codes ending with hyphen', () => {
		const result = VanityURLCodeType.safeParse('myserver-');
		expect(result.success).toBe(false);
	});

	it('rejects codes with invalid characters', () => {
		const result = VanityURLCodeType.safeParse('my_server');
		expect(result.success).toBe(false);
	});
});

describe('AuditLogReasonType', () => {
	it('accepts valid audit log reasons', () => {
		const result = AuditLogReasonType.safeParse('User was spamming');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe('User was spamming');
		}
	});

	it('accepts null', () => {
		const result = AuditLogReasonType.safeParse(null);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBeNull();
		}
	});

	it('accepts undefined', () => {
		const result = AuditLogReasonType.safeParse(undefined);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBeNull();
		}
	});

	it('returns null for empty string', () => {
		const result = AuditLogReasonType.safeParse('');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBeNull();
		}
	});

	it('returns null for whitespace-only string', () => {
		const result = AuditLogReasonType.safeParse('   ');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBeNull();
		}
	});

	it('returns null for strings exceeding max length', () => {
		const result = AuditLogReasonType.safeParse('a'.repeat(513));
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBeNull();
		}
	});

	it('accepts strings at max length', () => {
		const reason = 'a'.repeat(512);
		const result = AuditLogReasonType.safeParse(reason);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(reason);
		}
	});

	it('trims and normalizes reason', () => {
		const result = AuditLogReasonType.safeParse('  Reason here  ');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe('Reason here');
		}
	});
});
