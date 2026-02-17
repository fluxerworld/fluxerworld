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

import {
	getMarketingMessage,
	getMarketingMessageResult,
	hasMarketingLocale,
} from '@fluxer/marketing/src/marketing_i18n/MarketingI18n';
import type {MarketingI18nKey} from '@fluxer/marketing/src/marketing_i18n/MarketingI18nTypes.generated';
import {beforeEach, describe, expect, it, vi} from 'vitest';

describe('MarketingI18n', () => {
	let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		consoleWarnSpy.mockClear();
	});

	describe('constructor and initialization', () => {
		it('loads default strings from messages.yaml', () => {
			const message = getMarketingMessage('navigation.close', 'en-US');

			expect(message).toBe('Close');
		});

		it('initializes internal state correctly', () => {
			expect(hasMarketingLocale('en-US')).toBe(true);
		});
	});

	describe('getMessage() - basic retrieval', () => {
		it('returns message for valid key', () => {
			const message = getMarketingMessage('general.tagline', 'en-US');

			expect(message).toBe('A chat app that puts you first');
		});

		it('returns key when translation missing', () => {
			const message = getMarketingMessage('nonexistent.key' as MarketingI18nKey, 'en-US');

			expect(message).toBe('nonexistent.key');
			expect(consoleWarnSpy).toHaveBeenCalledWith('Missing translation key: nonexistent.key');
		});

		it('handles nested keys correctly', () => {
			const message = getMarketingMessage('navigation.page_not_found.title', 'en-US');

			expect(message).toBe('Page not found');
		});
	});

	describe('getMessage() - locale handling', () => {
		it('returns default locale when locale is null', () => {
			const message = getMarketingMessage('navigation.close', null);

			expect(message).toBe('Close');
		});

		it('falls back to en-US for unsupported locales', () => {
			const message = getMarketingMessage('navigation.close', 'xx-XX');

			expect(message).toBe('Close');
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				'Unsupported locale for marketing translations, falling back to en-US: xx-XX',
			);
		});

		it('loads locale on-demand when first accessed', () => {
			expect(hasMarketingLocale('fr')).toBe(true);

			const message = getMarketingMessage('navigation.close', 'fr');

			expect(message).toBeTruthy();
		});
	});

	describe('getMessage() - variable interpolation with named variables', () => {
		it('interpolates named variables from object', () => {
			const message = getMarketingMessage(
				'platform_support.mobile.install_as_app.guides.pwa_installation_guide',
				'en-US',
				{
					name: 'Chrome',
				},
			);

			expect(message).toBe('PWA installation guide for Chrome');
		});

		it('interpolates multiple named variables', () => {
			const message = getMarketingMessage('pricing_and_tiers.visionary.lifetime_offer_copy', 'en-US', ['$299', '100']);

			expect(message).toContain('$299');
			expect(message).toContain('100');
		});

		it('handles mixed placeholders with named variables', () => {
			const message = getMarketingMessage('donations.donation_disclaimer', 'en-US', ['Plutonium']);

			expect(message).toContain('Plutonium');
		});

		it('leaves unmatched placeholders intact with named variables', () => {
			const message = getMarketingMessage('pricing_and_tiers.visionary.lifetime_offer_copy', 'en-US', {
				0: '$299',
			});

			expect(message).toContain('{1}');
		});
	});

	describe('getMessage() - variable interpolation with positional variables', () => {
		it('interpolates positional variables from array', () => {
			const message = getMarketingMessage('pricing_and_tiers.visionary.slots_left.generic', 'en-US', [50, 100]);

			expect(message).toBe('50 of 100 slots left');
		});

		it('interpolates single positional variable', () => {
			const message = getMarketingMessage('pricing_and_tiers.visionary.slots_left.visionary_only', 'en-US', [25]);

			expect(message).toBe('25 Visionary slots left');
		});

		it('interpolates multiple positional variables in correct order', () => {
			const message = getMarketingMessage(
				'platform_support.mobile.install_as_app.guides.pwa_installation_guide',
				'en-US',
				{
					name: 'Safari',
				},
			);

			expect(message).toBe('PWA installation guide for Safari');
		});

		it('leaves unmatched positional placeholders intact', () => {
			const message = getMarketingMessage('pricing_and_tiers.visionary.lifetime_offer_copy', 'en-US', ['$299']);

			expect(message).toContain('$299');
			expect(message).toContain('{1}');
		});
	});

	describe('getMessage() - missing variable validation', () => {
		it('returns key when placeholders exist but no variables provided', () => {
			const message = getMarketingMessage(
				'platform_support.mobile.install_as_app.guides.pwa_installation_guide',
				'en-US',
			);

			expect(message).toBe('platform_support.mobile.install_as_app.guides.pwa_installation_guide');
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				'Translation key "platform_support.mobile.install_as_app.guides.pwa_installation_guide" requires variables but none were provided. Template: "PWA installation guide for {name}"',
			);
		});

		it('returns key for positional placeholders without variables', () => {
			const message = getMarketingMessage('pricing_and_tiers.visionary.slots_left.generic', 'en-US');

			expect(message).toBe('pricing_and_tiers.visionary.slots_left.generic');
		});

		it('does not warn when no placeholders exist', () => {
			const message = getMarketingMessage('navigation.close', 'en-US');

			expect(message).toBe('Close');
		});
	});

	describe('getMessage() - complex keys and nested structures', () => {
		it('handles deeply nested keys', () => {
			const message = getMarketingMessage(
				'platform_support.mobile.install_as_app.guides.steps.press_install_in_popup',
				'en-US',
			);

			expect(message).toBe('Press "Install" in the popup that appears');
		});

		it('handles keys with underscores', () => {
			const message = getMarketingMessage('press_branding.assets.logo_variants.color_logo', 'en-US');

			expect(message).toBe('Color logo');
		});
	});

	describe('getMessage() - edge cases', () => {
		it('returns key itself when source message does not exist', () => {
			const message = getMarketingMessage('completely.made.up.key' as MarketingI18nKey, 'en-US');

			expect(message).toBe('completely.made.up.key');
		});

		it('returns raw message when variables provided but no placeholders', () => {
			const message = getMarketingMessage('navigation.close', 'en-US', {unused: 'variable'});

			expect(message).toBe('Close');
		});

		it('handles empty variables array', () => {
			const message = getMarketingMessage('navigation.close', 'en-US', []);

			expect(message).toBe('Close');
		});
	});

	describe('getMessageResult()', () => {
		it('returns error result for missing template', () => {
			const result = getMarketingMessageResult('missing.key' as MarketingI18nKey, 'en-US');

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.kind).toBe('missing-template');
			}
		});
	});
});
