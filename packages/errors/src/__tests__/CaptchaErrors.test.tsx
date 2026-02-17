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

import {HttpStatus} from '@fluxer/constants/src/HttpConstants';
import {CaptchaRequiredError, InvalidCaptchaError} from '@fluxer/errors/src/CaptchaErrors';
import {BadRequestError} from '@fluxer/errors/src/domains/core/BadRequestError';
import {FluxerError} from '@fluxer/errors/src/FluxerError';
import {ErrorCodeToI18nKey} from '@fluxer/errors/src/i18n/ErrorCodeMappings';
import {getErrorMessage} from '@fluxer/errors/src/i18n/ErrorI18n';
import type {ErrorI18nKey} from '@fluxer/errors/src/i18n/ErrorI18nTypes.generated';
import {describe, expect, it} from 'vitest';

describe('CaptchaErrors', () => {
	describe('CaptchaRequiredError', () => {
		it('should have correct code and name', () => {
			const error = new CaptchaRequiredError();

			expect(error.code).toBe('CAPTCHA_REQUIRED');
			expect(error.name).toBe('CaptchaRequiredError');
		});

		it('should have status 400', () => {
			const error = new CaptchaRequiredError();

			expect(error.status).toBe(HttpStatus.BAD_REQUEST);
		});

		it('should extend BadRequestError', () => {
			const error = new CaptchaRequiredError();

			expect(error).toBeInstanceOf(BadRequestError);
		});

		it('should extend FluxerError', () => {
			const error = new CaptchaRequiredError();

			expect(error).toBeInstanceOf(FluxerError);
		});

		it('should have an i18n mapping that resolves to the correct message', () => {
			const error = new CaptchaRequiredError();
			const i18nKey = ErrorCodeToI18nKey[error.code as keyof typeof ErrorCodeToI18nKey] as ErrorI18nKey;

			expect(i18nKey).toBe('captcha.required');
			expect(getErrorMessage(i18nKey, 'en-US')).toBe('Captcha is required.');
		});
	});

	describe('InvalidCaptchaError', () => {
		it('should have correct code and name', () => {
			const error = new InvalidCaptchaError();

			expect(error.code).toBe('INVALID_CAPTCHA');
			expect(error.name).toBe('InvalidCaptchaError');
		});

		it('should have status 400', () => {
			const error = new InvalidCaptchaError();

			expect(error.status).toBe(HttpStatus.BAD_REQUEST);
		});

		it('should extend BadRequestError', () => {
			const error = new InvalidCaptchaError();

			expect(error).toBeInstanceOf(BadRequestError);
		});

		it('should extend FluxerError', () => {
			const error = new InvalidCaptchaError();

			expect(error).toBeInstanceOf(FluxerError);
		});

		it('should have an i18n mapping that resolves to the correct message', () => {
			const error = new InvalidCaptchaError();
			const i18nKey = ErrorCodeToI18nKey[error.code as keyof typeof ErrorCodeToI18nKey] as ErrorI18nKey;

			expect(i18nKey).toBe('captcha.invalid');
			expect(getErrorMessage(i18nKey, 'en-US')).toBe('Invalid captcha.');
		});
	});

	describe('error differentiation', () => {
		it('should have different codes for required vs invalid', () => {
			const requiredError = new CaptchaRequiredError();
			const invalidError = new InvalidCaptchaError();

			expect(requiredError.code).not.toBe(invalidError.code);
		});

		it('should have different i18n messages for required vs invalid', () => {
			const requiredKey = ErrorCodeToI18nKey['CAPTCHA_REQUIRED'] as ErrorI18nKey;
			const invalidKey = ErrorCodeToI18nKey['INVALID_CAPTCHA'] as ErrorI18nKey;

			expect(getErrorMessage(requiredKey, 'en-US')).not.toBe(getErrorMessage(invalidKey, 'en-US'));
		});

		it('should have different names for required vs invalid', () => {
			const requiredError = new CaptchaRequiredError();
			const invalidError = new InvalidCaptchaError();

			expect(requiredError.name).not.toBe(invalidError.name);
		});
	});
});
