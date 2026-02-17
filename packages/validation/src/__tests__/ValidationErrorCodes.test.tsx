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

import {type ValidationErrorCode, ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {describe, expect, it} from 'vitest';

describe('ValidationErrorCodes', () => {
	describe('structure', () => {
		it('should be a constant object', () => {
			expect(typeof ValidationErrorCodes).toBe('object');
		});

		it('should have string values matching their keys', () => {
			for (const [key, value] of Object.entries(ValidationErrorCodes)) {
				expect(key).toBe(value);
				expect(typeof value).toBe('string');
			}
		});

		it('should have all unique values', () => {
			const values = Object.values(ValidationErrorCodes);
			const uniqueValues = new Set(values);
			expect(uniqueValues.size).toBe(values.length);
		});
	});

	describe('common error codes', () => {
		it('should include format-related error codes', () => {
			expect(ValidationErrorCodes.INVALID_FORMAT).toBe('INVALID_FORMAT');
			expect(ValidationErrorCodes.INVALID_EMAIL_ADDRESS).toBe('INVALID_EMAIL_ADDRESS');
			expect(ValidationErrorCodes.INVALID_SNOWFLAKE).toBe('INVALID_SNOWFLAKE');
			expect(ValidationErrorCodes.INVALID_URL_FORMAT).toBe('INVALID_URL_FORMAT');
		});

		it('should include length-related error codes', () => {
			expect(ValidationErrorCodes.CONTENT_EXCEEDS_MAX_LENGTH).toBe('CONTENT_EXCEEDS_MAX_LENGTH');
			expect(ValidationErrorCodes.STRING_LENGTH_INVALID).toBe('STRING_LENGTH_INVALID');
			expect(ValidationErrorCodes.USERNAME_LENGTH_INVALID).toBe('USERNAME_LENGTH_INVALID');
			expect(ValidationErrorCodes.PASSWORD_LENGTH_INVALID).toBe('PASSWORD_LENGTH_INVALID');
		});

		it('should include user-related error codes', () => {
			expect(ValidationErrorCodes.USERNAME_INVALID_CHARACTERS).toBe('USERNAME_INVALID_CHARACTERS');
			expect(ValidationErrorCodes.EMAIL_ALREADY_IN_USE).toBe('EMAIL_ALREADY_IN_USE');
			expect(ValidationErrorCodes.INVALID_PASSWORD).toBe('INVALID_PASSWORD');
		});

		it('should include date-related error codes', () => {
			expect(ValidationErrorCodes.INVALID_DATE_OF_BIRTH_FORMAT).toBe('INVALID_DATE_OF_BIRTH_FORMAT');
			expect(ValidationErrorCodes.SCHEDULED_TIME_MUST_BE_FUTURE).toBe('SCHEDULED_TIME_MUST_BE_FUTURE');
		});

		it('should include value range error codes', () => {
			expect(ValidationErrorCodes.VALUE_MUST_BE_INTEGER_IN_RANGE).toBe('VALUE_MUST_BE_INTEGER_IN_RANGE');
			expect(ValidationErrorCodes.VALUE_TOO_SMALL).toBe('VALUE_TOO_SMALL');
		});
	});

	describe('type safety', () => {
		it('should allow using error codes as ValidationErrorCode type', () => {
			const code: ValidationErrorCode = ValidationErrorCodes.INVALID_FORMAT;
			expect(code).toBe('INVALID_FORMAT');
		});

		it('should work with Object.values for iteration', () => {
			const allCodes = Object.values(ValidationErrorCodes);
			expect(allCodes.length).toBeGreaterThan(0);
			expect(allCodes).toContain('INVALID_FORMAT');
			expect(allCodes).toContain('INVALID_EMAIL_ADDRESS');
		});

		it('should work with Object.keys for iteration', () => {
			const allKeys = Object.keys(ValidationErrorCodes);
			expect(allKeys.length).toBeGreaterThan(0);
			expect(allKeys).toContain('INVALID_FORMAT');
			expect(allKeys).toContain('INVALID_EMAIL_ADDRESS');
		});
	});

	describe('specific error code categories', () => {
		it('should have attachment-related error codes', () => {
			expect(ValidationErrorCodes.ATTACHMENT_FIELDS_REQUIRED).toBe('ATTACHMENT_FIELDS_REQUIRED');
			expect(ValidationErrorCodes.ATTACHMENT_MUST_BE_IMAGE).toBe('ATTACHMENT_MUST_BE_IMAGE');
			expect(ValidationErrorCodes.DUPLICATE_ATTACHMENT_IDS_NOT_ALLOWED).toBe('DUPLICATE_ATTACHMENT_IDS_NOT_ALLOWED');
		});

		it('should have channel-related error codes', () => {
			expect(ValidationErrorCodes.CHANNEL_NOT_FOUND).toBe('CHANNEL_NOT_FOUND');
			expect(ValidationErrorCodes.CHANNEL_MUST_BE_VOICE).toBe('CHANNEL_MUST_BE_VOICE');
			expect(ValidationErrorCodes.INVALID_CHANNEL_ID).toBe('INVALID_CHANNEL_ID');
		});

		it('should have guild-related error codes', () => {
			expect(ValidationErrorCodes.GUILD_BANNER_REQUIRES_FEATURE).toBe('GUILD_BANNER_REQUIRES_FEATURE');
			expect(ValidationErrorCodes.CANNOT_LEAVE_GUILD_AS_OWNER).toBe('CANNOT_LEAVE_GUILD_AS_OWNER');
		});

		it('should have permission-related error codes', () => {
			expect(ValidationErrorCodes.PREMIUM_REQUIRED_FOR_CUSTOM_EMOJI).toBe('PREMIUM_REQUIRED_FOR_CUSTOM_EMOJI');
			expect(ValidationErrorCodes.BANNERS_REQUIRE_PREMIUM).toBe('BANNERS_REQUIRE_PREMIUM');
		});

		it('should have token and authentication error codes', () => {
			expect(ValidationErrorCodes.INVALID_OR_EXPIRED_RESET_TOKEN).toBe('INVALID_OR_EXPIRED_RESET_TOKEN');
			expect(ValidationErrorCodes.INVALID_OR_EXPIRED_VERIFICATION_TOKEN).toBe('INVALID_OR_EXPIRED_VERIFICATION_TOKEN');
			expect(ValidationErrorCodes.INVALID_MFA_CODE).toBe('INVALID_MFA_CODE');
		});

		it('should have rate limit error codes', () => {
			expect(ValidationErrorCodes.AVATAR_CHANGED_TOO_MANY_TIMES).toBe('AVATAR_CHANGED_TOO_MANY_TIMES');
			expect(ValidationErrorCodes.USERNAME_CHANGED_TOO_MANY_TIMES).toBe('USERNAME_CHANGED_TOO_MANY_TIMES');
		});
	});
});
