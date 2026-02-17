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

import {getEmailTemplate, hasEmailLocale} from '@fluxer/email/src/email_i18n/EmailI18n';
import type {EmailTemplate, EmailTemplateKey} from '@fluxer/email/src/email_i18n/EmailI18nTypes.generated';
import type {I18nResult} from '@fluxer/i18n/src/runtime/I18nTypes';
import {beforeEach, describe, expect, it, vi} from 'vitest';

describe('EmailI18n', () => {
	let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		consoleWarnSpy.mockClear();
	});

	function unwrapTemplate(result: I18nResult<EmailTemplateKey, EmailTemplate>): EmailTemplate {
		expect(result.ok).toBe(true);
		if (result.ok) {
			return result.value;
		}
		throw new Error(result.error.message);
	}

	describe('constructor and initialization', () => {
		it('loads default templates from messages.yaml', () => {
			const template = unwrapTemplate(
				getEmailTemplate('email_verification', 'en-US', {
					username: 'testuser',
					verifyUrl: 'https://example.com/verify',
				}),
			);

			expect(template.subject).toBe('Verify your Fluxer email address');
			expect(template.body).toContain('Hello testuser');
			expect(template.body).toContain('https://example.com/verify');
		});

		it('initializes internal state correctly', () => {
			expect(hasEmailLocale('en-US')).toBe(true);
		});

		it('handles missing default bundle gracefully', () => {
			const result = getEmailTemplate('NONEXISTENT_TEMPLATE' as EmailTemplateKey, 'en-US', {});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.kind).toBe('missing-template');
			}
		});
	});

	describe('getTemplate() - basic retrieval', () => {
		it('returns template with subject and body', () => {
			const template = unwrapTemplate(
				getEmailTemplate('password_reset', 'en-US', {
					username: 'john',
					resetUrl: 'https://example.com/reset',
				}),
			);

			expect(template.subject).toBe('Reset your Fluxer password');
			expect(template.body).toContain('Hello john');
			expect(template.body).toContain('https://example.com/reset');
		});

		it('returns source template when locale not translated', () => {
			const template = unwrapTemplate(
				getEmailTemplate('email_verification', 'xx-XX', {
					username: 'testuser',
					verifyUrl: 'https://example.com/verify',
				}),
			);

			expect(template.subject).toBe('Verify your Fluxer email address');
			expect(template.body).toContain('Hello testuser');
		});

		it('returns error result for missing template key', () => {
			const result = getEmailTemplate('invalid_template_key' as EmailTemplateKey, 'en-US', {});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.kind).toBe('missing-template');
				expect(result.error.message).toBe('Missing template invalid_template_key');
			}
		});
	});

	describe('getTemplate() - locale handling', () => {
		it('returns default locale templates when locale is null', () => {
			const template = unwrapTemplate(
				getEmailTemplate('email_verification', null, {
					username: 'user',
					verifyUrl: 'https://example.com/verify',
				}),
			);

			expect(template.subject).toBe('Verify your Fluxer email address');
		});

		it('falls back to en-US for unsupported locales', () => {
			const template = unwrapTemplate(
				getEmailTemplate('email_verification', 'xx-XX', {
					username: 'user',
					verifyUrl: 'https://example.com/verify',
				}),
			);

			expect(template.subject).toBe('Verify your Fluxer email address');
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				'Unsupported locale for email translations, falling back to en-US: xx-XX',
			);
		});

		it('loads locale on-demand', () => {
			expect(hasEmailLocale('fr')).toBe(true);

			const template = unwrapTemplate(
				getEmailTemplate('email_verification', 'fr', {
					username: 'utilisateur',
					verifyUrl: 'https://example.com/verify',
				}),
			);

			expect(template.subject).toBeTruthy();
			expect(template.body).toContain('utilisateur');
		});

		it('does NOT normalize English locales (different from ErrorI18n)', () => {
			const template = unwrapTemplate(
				getEmailTemplate('email_verification', 'en-GB', {
					username: 'user',
					verifyUrl: 'https://example.com/verify',
				}),
			);

			expect(template.subject).toBe('Verify your Fluxer email address');
			expect(consoleWarnSpy).not.toHaveBeenCalled();
		});
	});

	describe('getTemplate() - variable interpolation', () => {
		it('always uses MessageFormat compilation', () => {
			const template = unwrapTemplate(
				getEmailTemplate('account_temp_banned', 'en-US', {
					username: 'banneduser',
					durationHours: 24,
					bannedUntil: new Date('2025-01-15T10:00:00Z'),
					reason: null,
					termsUrl: 'https://example.com/terms',
					guidelinesUrl: 'https://example.com/guidelines',
				}),
			);

			expect(template.subject).toBe('Your Fluxer account has been temporarily suspended');
			expect(template.body).toContain('24 hours');
			expect(template.body).toContain('January');
		});

		it('interpolates variables in both subject and body', () => {
			const template = unwrapTemplate(
				getEmailTemplate('email_change_revert', 'en-US', {
					username: 'alice',
					newEmail: 'alice@example.com',
					revertUrl: 'https://example.com/revert',
				}),
			);

			expect(template.body).toContain('alice');
			expect(template.body).toContain('alice@example.com');
			expect(template.body).toContain('https://example.com/revert');
		});

		it('handles MessageFormat plural select syntax', () => {
			const template = unwrapTemplate(
				getEmailTemplate('account_temp_banned', 'en-US', {
					username: 'user',
					durationHours: 1,
					bannedUntil: new Date('2025-01-15T10:00:00Z'),
					reason: null,
					termsUrl: 'https://example.com/terms',
					guidelinesUrl: 'https://example.com/guidelines',
				}),
			);

			expect(template.body).toContain('1 hour');
		});

		it('handles MessageFormat date formatting', () => {
			const date = new Date('2025-06-15T14:30:00Z');
			const template = unwrapTemplate(
				getEmailTemplate('dsa_report_verification', 'en-US', {
					code: '123456',
					expiresAt: date,
				}),
			);

			expect(template.body).toContain('123456');
			expect(template.body).toContain('June');
		});

		it('handles select syntax for null vs other values', () => {
			const templateWithNull = unwrapTemplate(
				getEmailTemplate('account_disabled_suspicious', 'en-US', {
					username: 'user',
					reason: null,
					forgotUrl: 'https://example.com/forgot',
				}),
			);

			const templateWithReason = unwrapTemplate(
				getEmailTemplate('account_disabled_suspicious', 'en-US', {
					username: 'user',
					reason: 'Suspicious activity detected',
					forgotUrl: 'https://example.com/forgot',
				}),
			);

			expect(templateWithNull.body).not.toContain('Reason:');
			expect(templateWithReason.body).toContain('Reason: Suspicious activity detected');
		});
	});

	describe('getTemplate() - complex templates', () => {
		it('handles IP authorization template with multiple variables', () => {
			const template = unwrapTemplate(
				getEmailTemplate('ip_authorization', 'en-US', {
					username: 'john',
					authUrl: 'https://example.com/auth',
					ipAddress: '192.168.1.1',
					location: 'Stockholm, Sweden',
				}),
			);

			expect(template.body).toContain('192.168.1.1');
			expect(template.body).toContain('Stockholm, Sweden');
		});

		it('handles report resolved template', () => {
			const template = unwrapTemplate(
				getEmailTemplate('report_resolved', 'en-US', {
					username: 'reporter',
					reportId: 'RPT-12345',
					publicComment: 'Action taken accordingly.',
				}),
			);

			expect(template.body).toContain('RPT-12345');
			expect(template.body).toContain('Action taken accordingly.');
		});

		it('handles scheduled deletion notification template', () => {
			const template = unwrapTemplate(
				getEmailTemplate('scheduled_deletion_notification', 'en-US', {
					username: 'user',
					deletionDate: new Date('2025-01-15T00:00:00Z'),
					reason: 'Requested by user',
				}),
			);

			expect(template.subject).toBe('Your Fluxer account will be permanently deleted');
			expect(template.body).toContain('Requested by user');
		});
	});

	describe('getTemplate() - caching and locale switching', () => {
		it('handles multiple template requests efficiently', () => {
			const template1 = unwrapTemplate(
				getEmailTemplate('email_verification', 'en-US', {
					username: 'user',
					verifyUrl: 'https://example.com/verify',
				}),
			);

			const template2 = unwrapTemplate(
				getEmailTemplate('password_reset', 'en-US', {
					username: 'user',
					resetUrl: 'https://example.com/reset',
				}),
			);

			expect(template1.subject).toBe('Verify your Fluxer email address');
			expect(template2.subject).toBe('Reset your Fluxer password');
		});

		it('switches between locales correctly', () => {
			const enTemplate = unwrapTemplate(
				getEmailTemplate('email_verification', 'en-US', {
					username: 'user',
					verifyUrl: 'https://example.com/verify',
				}),
			);

			const frTemplate = unwrapTemplate(
				getEmailTemplate('email_verification', 'fr', {
					username: 'utilisateur',
					verifyUrl: 'https://example.com/verify',
				}),
			);

			expect(enTemplate.subject).not.toBe(frTemplate.subject);
		});
	});
});
