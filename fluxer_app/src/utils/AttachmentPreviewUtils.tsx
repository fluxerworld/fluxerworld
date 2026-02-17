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

import type {MessageAttachment} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import type {MessageDescriptor} from '@lingui/core';
import {msg} from '@lingui/core/macro';

export const TEXT_PREVIEW_MAX_BYTES = 128 * 1024;
export const TEXT_PREVIEW_COLLAPSED_BYTES = 16 * 1024;

const TEXTUAL_MIME_PREFIXES = [
	'text/',
	'application/json',
	'application/ld+json',
	'application/xml',
	'application/javascript',
];
const TEXTUAL_MIME_EXACT = new Set([
	'application/x-sh',
	'application/x-shellscript',
	'application/x-bash',
	'application/sql',
	'application/x-yaml',
	'package/manifest+json',
]);

const TEXTUAL_EXTENSIONS = new Set([
	'txt',
	'md',
	'markdown',
	'log',
	'json',
	'js',
	'jsx',
	'ts',
	'tsx',
	'py',
	'java',
	'c',
	'cpp',
	'h',
	'cs',
	'css',
	'scss',
	'sass',
	'html',
	'htm',
	'xml',
	'yml',
	'yaml',
	'sh',
	'bash',
	'ps1',
	'go',
	'rb',
	'php',
	'rust',
	'dockerfile',
	'sql',
	'ini',
	'cfg',
	'conf',
]);

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
	js: 'javascript',
	jsx: 'javascript',
	ts: 'typescript',
	tsx: 'typescript',
	py: 'python',
	java: 'java',
	c: 'c',
	cpp: 'cpp',
	h: 'cpp',
	cs: 'csharp',
	css: 'css',
	scss: 'scss',
	sass: 'scss',
	html: 'xml',
	htm: 'xml',
	xml: 'xml',
	json: 'json',
	yml: 'yaml',
	yaml: 'yaml',
	sh: 'bash',
	bash: 'bash',
	ps1: 'powershell',
	go: 'go',
	rb: 'ruby',
	php: 'php',
	rust: 'rust',
	dockerfile: 'dockerfile',
	sql: 'sql',
	ini: 'ini',
	cfg: 'ini',
	conf: 'ini',
	md: 'markdown',
	markdown: 'markdown',
	log: 'plaintext',
	txt: 'plaintext',
};

const MIME_LANGUAGE_MAP: Record<string, string> = {
	'application/json': 'json',
	'application/ld+json': 'json',
	'application/javascript': 'javascript',
	'application/x-javascript': 'javascript',
	'text/javascript': 'javascript',
	'application/typescript': 'typescript',
	'text/typescript': 'typescript',
	'text/html': 'xml',
	'application/xhtml+xml': 'xml',
	'application/xml': 'xml',
	'text/xml': 'xml',
	'text/css': 'css',
	'application/xml+rss': 'xml',
	'application/atom+xml': 'xml',
	'application/x-yaml': 'yaml',
	'text/yaml': 'yaml',
	'text/markdown': 'markdown',
	'text/x-markdown': 'markdown',
	'application/x-sh': 'bash',
	'application/x-shellscript': 'bash',
	'application/x-bash': 'bash',
	'application/x-php': 'php',
	'application/x-python': 'python',
	'application/x-ruby': 'ruby',
};

export const SUPPORTED_PREVIEW_LANGUAGES = [
	'auto',
	'plaintext',
	'json',
	'javascript',
	'typescript',
	'python',
	'java',
	'c',
	'cpp',
	'csharp',
	'go',
	'ruby',
	'php',
	'rust',
	'bash',
	'powershell',
	'css',
	'scss',
	'xml',
	'yaml',
	'markdown',
	'sql',
	'ini',
	'dockerfile',
];

export const LANGUAGE_LABELS: Record<string, MessageDescriptor> = {
	auto: msg`Auto detect language`,
	plaintext: msg`Plain text`,
	json: msg`JSON`,
	javascript: msg`JavaScript`,
	typescript: msg`TypeScript`,
	python: msg`Python`,
	java: msg`Java`,
	c: msg`C`,
	cpp: msg`C++`,
	csharp: msg`C#`,
	go: msg`Go`,
	ruby: msg`Ruby`,
	php: msg`PHP`,
	rust: msg`Rust`,
	bash: msg`Bash`,
	powershell: msg`PowerShell`,
	css: msg`CSS`,
	scss: msg`SCSS`,
	xml: msg`HTML / XML`,
	yaml: msg`YAML`,
	markdown: msg`Markdown`,
	sql: msg`SQL`,
	ini: msg`INI`,
	dockerfile: msg`Dockerfile`,
};

export function isTextualAttachment(attachment: MessageAttachment): boolean {
	if (!attachment.url) return false;
	if (attachment.expired) return false;

	const {content_type: rawType, filename} = attachment;
	const normalizedType = (rawType ?? '').toLowerCase().split(';')[0].trim();

	if (normalizedType) {
		if (TEXTUAL_MIME_PREFIXES.some((prefix) => normalizedType.startsWith(prefix))) {
			return true;
		}
		if (TEXTUAL_MIME_EXACT.has(normalizedType)) {
			return true;
		}
	}

	const extension = (filename ?? '').split('.').pop()?.toLowerCase();
	if (extension && TEXTUAL_EXTENSIONS.has(extension)) return true;

	return false;
}

export function getLanguageFromAttachment(attachment: MessageAttachment): string | null {
	const extension = (attachment.filename ?? '').split('.').pop()?.toLowerCase();
	if (extension && EXTENSION_LANGUAGE_MAP[extension]) {
		return EXTENSION_LANGUAGE_MAP[extension];
	}

	const normalizedType = (attachment.content_type ?? '').toLowerCase().split(';')[0].trim();
	if (normalizedType && MIME_LANGUAGE_MAP[normalizedType]) {
		return MIME_LANGUAGE_MAP[normalizedType];
	}

	return null;
}

export function shouldPreviewAttachment(attachment: MessageAttachment): boolean {
	if (!isTextualAttachment(attachment)) return false;
	if (attachment.size && attachment.size > TEXT_PREVIEW_MAX_BYTES) return false;
	return true;
}
