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

import fs from 'node:fs';
import path from 'node:path';

const TS_LICENSE_HEADER = `/*
 * Copyright (C) {year} Fluxer Contributors
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
 */`;

const ERLANG_LICENSE_HEADER = `%% Copyright (C) {year} Fluxer Contributors
%%
%% This file is part of Fluxer.
%%
%% Fluxer is free software: you can redistribute it and/or modify
%% it under the terms of the GNU Affero General Public License as published by
%% the Free Software Foundation, either version 3 of the License, or
%% (at your option) any later version.
%%
%% Fluxer is distributed in the hope that it will be useful,
%% but WITHOUT ANY WARRANTY; without even the implied warranty of
%% MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
%% GNU Affero General Public License for more details.
%%
%% You should have received a copy of the GNU Affero General Public License
%% along with Fluxer. If not, see <https://www.gnu.org/licenses/>.`;

const SHELL_LICENSE_HEADER = `# Copyright (C) {year} Fluxer Contributors
#
# This file is part of Fluxer.
#
# Fluxer is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# Fluxer is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with Fluxer. If not, see <https://www.gnu.org/licenses/>.`;

const BLOCK_COMMENT_EXTS = new Set([
	'ts',
	'tsx',
	'js',
	'jsx',
	'mjs',
	'cjs',
	'css',
	'go',
	'rs',
	'c',
	'cc',
	'cpp',
	'cxx',
	'h',
	'hh',
	'hpp',
	'hxx',
	'mm',
	'm',
	'java',
	'kt',
	'kts',
	'swift',
	'scala',
	'dart',
	'cs',
	'fs',
]);

const HASH_LINE_EXTS = new Set(['sh', 'bash', 'zsh', 'py', 'rb', 'ps1', 'psm1', 'psd1', 'ksh', 'fish']);

type HeaderStyle = {kind: 'block'} | {kind: 'line'; prefix: string};

interface FileTemplate {
	header: string;
	style: HeaderStyle;
}

class Processor {
	private currentYear: number;
	private updated: number = 0;
	private ignorePatterns: Array<string> = [];

	constructor() {
		this.currentYear = new Date().getFullYear();
		this.loadGitignore();
	}

	private loadGitignore(): void {
		try {
			const content = fs.readFileSync('../.gitignore', 'utf-8');
			for (const line of content.split('\n')) {
				const trimmed = line.trim();
				if (trimmed.length > 0 && !trimmed.startsWith('#')) {
					this.ignorePatterns.push(trimmed);
				}
			}
		} catch {
			console.error('Warning: Could not read .gitignore file, proceeding without ignore patterns');
		}
	}

	private shouldIgnore(filePath: string): boolean {
		if (filePath.includes('fluxer_static')) {
			return true;
		}

		for (const pattern of this.ignorePatterns) {
			if (this.matchPattern(pattern, filePath)) {
				return true;
			}
		}

		return false;
	}

	private matchPattern(pattern: string, filePath: string): boolean {
		const sep = path.sep;

		if (pattern.startsWith('**/')) {
			const subPattern = pattern.slice(3);
			if (subPattern.endsWith('/')) {
				const dirName = subPattern.slice(0, -1);
				return filePath.split(sep).some((part) => part === dirName);
			}
			return filePath.split(sep).some((part) => part === subPattern);
		}

		if (pattern.endsWith('/')) {
			const dirPattern = pattern.slice(0, -1);
			return filePath.split(sep).some((part) => part === dirPattern) || filePath.startsWith(`${dirPattern}${sep}`);
		}

		if (pattern.startsWith('/')) {
			return filePath === pattern.slice(1);
		}

		const parts = filePath.split(sep);
		const fileName = path.basename(filePath);
		return parts.some((part) => part === pattern) || fileName === pattern;
	}

	private getTemplate(filePath: string): FileTemplate | null {
		const ext = path.extname(filePath).slice(1).toLowerCase();
		return this.templateForExtension(ext);
	}

	private templateForExtension(ext: string): FileTemplate | null {
		if (BLOCK_COMMENT_EXTS.has(ext)) {
			return {header: TS_LICENSE_HEADER, style: {kind: 'block'}};
		}

		if (HASH_LINE_EXTS.has(ext)) {
			return {header: SHELL_LICENSE_HEADER, style: {kind: 'line', prefix: '#'}};
		}

		switch (ext) {
			case 'erl':
			case 'hrl':
				return {header: ERLANG_LICENSE_HEADER, style: {kind: 'line', prefix: '%%'}};
			default:
				return null;
		}
	}

	private detectLicense(content: string): {hasHeader: boolean; detectedYear: number | null} {
		const lines = content.split('\n').slice(0, 25);
		let hasAgpl = false;
		let hasFluxer = false;
		let detectedYear: number | null = null;

		const yearRegex = /\b(20\d{2})\b/;

		for (const line of lines) {
			const lower = line.toLowerCase();
			if (lower.includes('gnu affero general public license') || lower.includes('agpl')) {
				hasAgpl = true;
			}
			if (lower.includes('fluxer')) {
				hasFluxer = true;
			}
			if (lower.includes('copyright') && lower.includes('fluxer') && detectedYear === null) {
				const match = line.match(yearRegex);
				if (match) {
					const year = parseInt(match[1], 10);
					if (year >= 1900 && year < 3000) {
						detectedYear = year;
					}
				}
			}
		}

		return {hasHeader: hasAgpl && hasFluxer, detectedYear};
	}

	private updateYear(content: string, oldYear: number): string {
		return content.replace(oldYear.toString(), this.currentYear.toString());
	}

	private stripLicenseHeader(content: string, style: HeaderStyle): {stripped: string; success: boolean} {
		const lines = content.split('\n');
		if (lines.length === 0) {
			return {stripped: content, success: false};
		}

		let prefixEnd = 0;
		if (lines[0]?.startsWith('#!')) {
			prefixEnd = 1;
		}

		let headerStart = prefixEnd;
		while (headerStart < lines.length && lines[headerStart].trim().length === 0) {
			headerStart++;
		}

		if (headerStart >= lines.length) {
			return {stripped: content, success: false};
		}

		const originalEnding = content.endsWith('\n');
		let afterIdx: number;

		if (style.kind === 'block') {
			const first = lines[headerStart].trimStart();
			if (!first.startsWith('/*')) {
				return {stripped: content, success: false};
			}

			let headerEnd = headerStart;
			let foundEnd = false;
			for (let i = headerStart; i < lines.length; i++) {
				if (lines[i].includes('*/')) {
					headerEnd = i;
					foundEnd = true;
					break;
				}
			}

			if (!foundEnd) {
				return {stripped: content, success: false};
			}

			afterIdx = headerEnd + 1;
			while (afterIdx < lines.length && lines[afterIdx].trim().length === 0) {
				afterIdx++;
			}
		} else {
			const prefix = style.prefix;
			const first = lines[headerStart].trimStart();
			if (!first.startsWith(prefix)) {
				return {stripped: content, success: false};
			}

			let headerEnd = headerStart;
			while (headerEnd < lines.length) {
				const trimmed = lines[headerEnd].trimStart();
				if (trimmed.length === 0) {
					break;
				}
				if (trimmed.startsWith(prefix)) {
					headerEnd++;
					continue;
				}
				break;
			}

			afterIdx = headerEnd;
			while (afterIdx < lines.length && lines[afterIdx].trim().length === 0) {
				afterIdx++;
			}
		}

		const newLines = [...lines.slice(0, prefixEnd), ...lines.slice(afterIdx)];
		let result = newLines.join('\n');
		if (originalEnding && !result.endsWith('\n')) {
			result += '\n';
		}

		return {stripped: result, success: true};
	}

	private addHeader(content: string, template: FileTemplate): string {
		const header = template.header.replace('{year}', this.currentYear.toString());

		const firstLine = content.split('\n')[0];
		if (firstLine?.startsWith('#!')) {
			const rest = content.split('\n').slice(1).join('\n');
			return `${firstLine}\n\n${header}\n\n${rest}`;
		}

		return `${header}\n\n${content}`;
	}

	private processFile(filePath: string): void {
		const content = fs.readFileSync(filePath, 'utf-8');
		const template = this.getTemplate(filePath);
		if (!template) {
			return;
		}

		const {hasHeader, detectedYear} = this.detectLicense(content);

		let newContent: string;
		let action: string;

		if (!hasHeader) {
			newContent = this.addHeader(content, template);
			action = 'Added header';
		} else {
			const {stripped, success} = this.stripLicenseHeader(content, template.style);
			if (success) {
				newContent = this.addHeader(stripped, template);
				action = 'Normalized header';
			} else if (detectedYear !== null) {
				if (detectedYear === this.currentYear) {
					return;
				}
				newContent = this.updateYear(content, detectedYear);
				action = `Updated year ${detectedYear} \u2192 ${this.currentYear}`;
			} else {
				return;
			}
		}

		fs.writeFileSync(filePath, newContent);
		this.updated++;
		console.log(`${action}: ${filePath}`);
	}

	private walkDir(dir: string): void {
		let entries: Array<fs.Dirent>;
		try {
			entries = fs.readdirSync(dir, {withFileTypes: true});
		} catch {
			return;
		}

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			const relativePath = path.relative('..', fullPath);

			if (this.shouldIgnore(relativePath)) {
				continue;
			}

			if (entry.isDirectory()) {
				this.walkDir(fullPath);
			} else if (entry.isFile()) {
				const template = this.getTemplate(fullPath);
				if (template) {
					try {
						this.processFile(fullPath);
					} catch (e) {
						console.error(`Error processing ${fullPath}: ${e instanceof Error ? e.message : String(e)}`);
					}
				}
			}
		}
	}

	walk(): void {
		this.walkDir('..');
	}

	getUpdatedCount(): number {
		return this.updated;
	}
}

function main(): void {
	const processor = new Processor();
	processor.walk();
	console.log(`Updated ${processor.getUpdatedCount()} files`);
}

main();
