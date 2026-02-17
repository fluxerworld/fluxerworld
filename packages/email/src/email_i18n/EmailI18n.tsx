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

import * as path from 'node:path';
import type {EmailTemplate, EmailTemplateKey} from '@fluxer/email/src/email_i18n/EmailI18nTypes.generated';
import {identityLocale} from '@fluxer/i18n/src/normalization/IdentityLocale';
import {createI18n} from '@fluxer/i18n/src/runtime/CreateI18n';
import type {I18nResult} from '@fluxer/i18n/src/runtime/I18nTypes';

const LOCALES_PATH = path.join(import.meta.dirname, 'locales');
const DEFAULT_LOCALE = 'en-US';
const DEFAULT_MESSAGES_FILE = path.join(LOCALES_PATH, 'messages.yaml');

const emailI18n = createI18n<EmailTemplateKey, EmailTemplate, Record<string, unknown>>(
	{
		localesPath: LOCALES_PATH,
		defaultLocale: DEFAULT_LOCALE,
		defaultMessagesFile: DEFAULT_MESSAGES_FILE,
		normalizeLocale: (locale) => identityLocale(locale),
		parseTemplate: (value): EmailTemplate | null => {
			if (typeof value !== 'object' || value === null) {
				return null;
			}
			const {subject, body} = value as {subject?: unknown; body?: unknown};
			if (typeof subject !== 'string' || typeof body !== 'string') {
				return null;
			}
			return {subject, body};
		},
		onWarning: (message) => {
			if (message.startsWith('Unsupported locale, falling back to en-US:')) {
				console.warn(
					`Unsupported locale for email translations, falling back to en-US: ${message.split(': ').slice(1).join(': ')}`,
				);
			} else {
				console.warn(message);
			}
		},
	},
	(template, variables, mf) => {
		const compiledSubject = String(mf.compile(template.subject)(variables));
		const compiledBody = String(mf.compile(template.body)(variables));
		return {subject: compiledSubject, body: compiledBody};
	},
);

export function getEmailTemplate(
	templateKey: EmailTemplateKey,
	locale: string | null,
	variables: Record<string, unknown>,
): I18nResult<EmailTemplateKey, EmailTemplate> {
	return emailI18n.getTemplate(templateKey, locale, variables);
}

export function hasEmailLocale(locale: string): boolean {
	return emailI18n.hasLocale(locale);
}

export function resetEmailI18n(): void {
	emailI18n.reset();
}
