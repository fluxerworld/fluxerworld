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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import {readFile} from 'node:fs/promises';
import type {LocaleCode} from '@fluxer/constants/src/Locales';
import {renderMarkdownWithBase} from '@fluxer/marketing/src/markdown/MarkdownRenderer';

export async function loadMarkdownWithFallback(basePath: string, locale: LocaleCode): Promise<string> {
	const localeCode = locale;
	const filePath = `${basePath}/${localeCode}.md`;
	const fallbackPath = `${basePath}/en-US.md`;

	try {
		return await readFile(filePath, 'utf-8');
	} catch {
		try {
			return await readFile(fallbackPath, 'utf-8');
		} catch {
			return '# Content not available\n\nThe requested content could not be loaded.';
		}
	}
}

export function renderMarkdownToHtml(content: string, baseUrl: string, appEndpoint: string): string {
	return renderMarkdownWithBase(content, baseUrl, appEndpoint);
}
