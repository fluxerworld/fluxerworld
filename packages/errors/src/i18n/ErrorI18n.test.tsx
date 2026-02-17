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

import {getErrorMessage, getErrorMessageResult, hasErrorLocale} from '@fluxer/errors/src/i18n/ErrorI18n';
import type {ErrorI18nKey} from '@fluxer/errors/src/i18n/ErrorI18nTypes.generated';
import {beforeEach, describe, expect, it, vi} from 'vitest';

describe('ErrorI18n', () => {
	let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		consoleWarnSpy.mockClear();
	});

	describe('constructor and initialization', () => {
		it('loads default bundle from messages.yaml', () => {
			const message = getErrorMessage('rate_limits.rate_limited', 'en-US');

			expect(message).toBe("You're being rate limited.");
		});

		it('initializes internal state correctly', () => {
			expect(hasErrorLocale('en-US')).toBe(true);
		});

		it('handles missing default bundle gracefully', () => {
			const message = getErrorMessage('nonexistent.key' as ErrorI18nKey, 'en-US', undefined, 'Fallback message');

			expect(message).toBe('Fallback message');
		});
	});

	describe('getMessage() - basic retrieval', () => {
		it('returns message for valid key in default locale', () => {
			const message = getErrorMessage('rate_limits.rate_limited', 'en-US');

			expect(message).toBe("You're being rate limited.");
		});

		it('returns message for valid key in supported locale', () => {
			const message = getErrorMessage('rate_limits.rate_limited', 'fr');

			expect(message).toBe('Tu as atteint la limite de requêtes.');
		});

		it('returns key when translation missing', () => {
			const message = getErrorMessage('nonexistent.key' as ErrorI18nKey, 'en-US');

			expect(message).toBe('nonexistent.key');
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				'Missing translation for error message: nonexistent.key (locale: en-US)',
			);
		});

		it('returns fallbackMessage when provided and key missing', () => {
			const message = getErrorMessage('nonexistent.key' as ErrorI18nKey, 'en-US', undefined, 'Custom fallback');

			expect(message).toBe('Custom fallback');
		});
	});

	describe('getMessage() - locale handling', () => {
		it('normalizes en-GB locale to en-US', () => {
			const message = getErrorMessage('rate_limits.rate_limited', 'en-GB');

			expect(message).toBe("You're being rate limited.");
		});

		it('normalizes en-CA locale to en-US', () => {
			const message = getErrorMessage('rate_limits.rate_limited', 'en-CA');

			expect(message).toBe("You're being rate limited.");
		});

		it('falls back to en-US for unsupported locales', () => {
			const message = getErrorMessage('rate_limits.rate_limited', 'de-DE');

			expect(message).toBe("You're being rate limited.");
			expect(consoleWarnSpy).toHaveBeenCalledWith('Unsupported locale, falling back to en-US: de-DE');
		});

		it('handles null locale by defaulting to en-US', () => {
			const message = getErrorMessage('rate_limits.rate_limited', null);

			expect(message).toBe("You're being rate limited.");
		});

		it('handles undefined locale by defaulting to en-US', () => {
			const message = getErrorMessage('rate_limits.rate_limited', undefined);

			expect(message).toBe("You're being rate limited.");
		});

		it('loads locale on-demand when first accessed', () => {
			expect(hasErrorLocale('fr')).toBe(true);

			const message = getErrorMessage('account.disabled', 'fr');

			expect(message).toBe('Ce compte a été désactivé.');
		});
	});

	describe('getMessage() - variable interpolation', () => {
		it('interpolates simple {variable} placeholders', () => {
			const message = getErrorMessage('channels_and_guilds.invalid_channel_id', 'en-US', {
				channelId: '123456789',
			});

			expect(message).toBe('Invalid channel ID: 123456789.');
		});

		it('handles MessageFormat plural syntax', () => {
			const message = getErrorMessage('rate_limits.username_changed_too_often', 'en-US', {
				minutes: 1,
			});

			expect(message).toBe("You've changed your username too often recently. Please try again in 1 minute.");
		});

		it('handles MessageFormat plural syntax for multiple values', () => {
			const message = getErrorMessage('rate_limits.username_changed_too_often', 'en-US', {
				minutes: 5,
			});

			expect(message).toBe("You've changed your username too often recently. Please try again in 5 minutes.");
		});

		it('falls back to simple interpolation on MessageFormat failure', () => {
			const message = getErrorMessage('channels_and_guilds.invalid_channel_id', 'en-US', {
				channelId: 'test-channel',
			});

			expect(message).toBe('Invalid channel ID: test-channel.');
		});

		it('returns raw message when no variables provided', () => {
			const message = getErrorMessage('rate_limits.rate_limited', 'en-US');

			expect(message).toBe("You're being rate limited.");
		});

		it('handles complex nested error keys', () => {
			const message = getErrorMessage('roles.invalid_role_id', 'en-US', {roleId: '999'});

			expect(message).toBe('Invalid role ID: 999.');
		});
	});

	describe('getMessage() - edge cases', () => {
		it('returns key when source message does not exist', () => {
			const message = getErrorMessage('completely.made.up.key' as ErrorI18nKey, 'en-US');

			expect(message).toBe('completely.made.up.key');
		});

		it('uses fallback when both key and fallbackMessage provided', () => {
			const message = getErrorMessage('missing.key' as ErrorI18nKey, 'en-US', {}, 'Fallback used');

			expect(message).toBe('Fallback used');
		});

		it('returns source message when locale translation missing but source exists', () => {
			const message = getErrorMessage('rate_limits.rate_limited', 'xx-XX');

			expect(message).toBe("You're being rate limited.");
			expect(consoleWarnSpy).toHaveBeenCalledWith('Unsupported locale, falling back to en-US: xx-XX');
		});
	});

	describe('getMessageResult()', () => {
		it('returns error result for missing template', () => {
			const result = getErrorMessageResult('missing.key' as ErrorI18nKey, 'en-US');

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.kind).toBe('missing-template');
			}
		});
	});
});
