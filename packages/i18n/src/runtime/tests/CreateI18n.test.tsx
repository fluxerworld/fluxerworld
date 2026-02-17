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

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {createI18n} from '@fluxer/i18n/src/runtime/CreateI18n';
import type {I18nResult} from '@fluxer/i18n/src/runtime/I18nTypes';
import {beforeEach, describe, expect, it} from 'vitest';

type TestKey = 'greeting' | 'farewell' | 'with_vars';

function writeFile(filePath: string, content: string): void {
	fs.mkdirSync(path.dirname(filePath), {recursive: true});
	fs.writeFileSync(filePath, content, 'utf8');
}

function unwrapResult(result: I18nResult<TestKey, string>): string {
	expect(result.ok).toBe(true);
	if (result.ok) {
		return result.value;
	}
	throw new Error(result.error.message);
}

describe('createI18n', () => {
	let tempDir: string;
	let localesPath: string;
	let messagesFile: string;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluxer-i18n-'));
		localesPath = path.join(tempDir, 'locales');
		messagesFile = path.join(localesPath, 'messages.yaml');
		writeFile(
			messagesFile,
			["'farewell': 'Bye'", "'greeting': 'Hello {name}'", "'with_vars': 'Hello {name}, you have {count}'", ''].join(
				'\n',
			),
		);
		writeFile(path.join(localesPath, 'fr.yaml'), ["'greeting': 'Salut {name}'", ''].join('\n'));
	});

	it('returns compiled templates from the default locale', () => {
		const i18n = createI18n<TestKey, string, Record<string, unknown>>(
			{
				localesPath,
				defaultLocale: 'en-US',
				defaultMessagesFile: messagesFile,
				parseTemplate: (value) => (typeof value === 'string' ? value : null),
			},
			(template, variables, mf) => String(mf.compile(template)(variables)),
		);

		const result = i18n.getTemplate('greeting', 'en-US', {name: 'Taylor'});

		expect(unwrapResult(result)).toBe('Hello Taylor');
	});

	it('loads locale files on demand', () => {
		const i18n = createI18n<TestKey, string, Record<string, unknown>>(
			{
				localesPath,
				defaultLocale: 'en-US',
				defaultMessagesFile: messagesFile,
				parseTemplate: (value) => (typeof value === 'string' ? value : null),
			},
			(template, variables, mf) => String(mf.compile(template)(variables)),
		);

		const result = i18n.getTemplate('greeting', 'fr', {name: 'Taylor'});

		expect(unwrapResult(result)).toBe('Salut Taylor');
	});

	it('returns a missing-template error result', () => {
		const i18n = createI18n<TestKey, string, Record<string, unknown>>(
			{
				localesPath,
				defaultLocale: 'en-US',
				defaultMessagesFile: messagesFile,
				parseTemplate: (value) => (typeof value === 'string' ? value : null),
			},
			(template, variables, mf) => String(mf.compile(template)(variables)),
		);

		const result = i18n.getTemplate('missing' as TestKey, 'en-US', {name: 'Taylor'});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.kind).toBe('missing-template');
		}
	});

	it('returns invalid-variables error when validation fails', () => {
		const i18n = createI18n<TestKey, string, Record<string, unknown> | undefined>(
			{
				localesPath,
				defaultLocale: 'en-US',
				defaultMessagesFile: messagesFile,
				parseTemplate: (value) => (typeof value === 'string' ? value : null),
				validateVariables: (key, template, variables) => {
					if (variables) {
						return null;
					}
					if (template.includes('{')) {
						return `Missing variables for ${key}`;
					}
					return null;
				},
			},
			(template, variables, mf) => String(mf.compile(template)(variables ?? {})),
		);

		const result = i18n.getTemplate('with_vars', 'en-US', undefined);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.kind).toBe('invalid-variables');
		}
	});

	it('returns compile-failed when the compiler throws', () => {
		const i18n = createI18n<TestKey, string, Record<string, unknown>>(
			{
				localesPath,
				defaultLocale: 'en-US',
				defaultMessagesFile: messagesFile,
				parseTemplate: (value) => (typeof value === 'string' ? value : null),
			},
			() => {
				throw new Error('compile failed');
			},
		);

		const result = i18n.getTemplate('greeting', 'en-US', {name: 'Taylor'});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.kind).toBe('compile-failed');
		}
	});

	it('returns default locale for unsupported locales', () => {
		const warnings: Array<string> = [];
		const i18n = createI18n<TestKey, string, Record<string, unknown>>(
			{
				localesPath,
				defaultLocale: 'en-US',
				defaultMessagesFile: messagesFile,
				parseTemplate: (value) => (typeof value === 'string' ? value : null),
				onWarning: (message) => {
					warnings.push(message);
				},
			},
			(template, variables, mf) => String(mf.compile(template)(variables)),
		);

		const result = i18n.getTemplate('greeting', 'pt-BR', {name: 'Taylor'});

		expect(unwrapResult(result)).toBe('Hello Taylor');
		expect(warnings).toContain('Unsupported locale, falling back to en-US: pt-BR');
	});
});
