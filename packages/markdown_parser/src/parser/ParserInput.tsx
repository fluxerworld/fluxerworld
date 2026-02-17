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

import {MAX_LINES} from '@fluxer/markdown_parser/src/types/MarkdownConstants';

export interface ParserInput {
	lines: Array<string>;
	totalLineCount: number;
}

export function createParserInput(input: string): ParserInput {
	if (!input || input === '') {
		return {lines: [], totalLineCount: 0};
	}

	const lines = input['split']('\n');
	if (lines.length > MAX_LINES) {
		lines.length = MAX_LINES;
	}

	if (lines.length === 1 && lines[0] === '') {
		return {lines: [], totalLineCount: 0};
	}

	return {
		lines,
		totalLineCount: lines.length,
	};
}
