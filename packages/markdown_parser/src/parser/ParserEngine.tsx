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

import {createParserInput} from '@fluxer/markdown_parser/src/parser/ParserInput';
import * as BlockParsers from '@fluxer/markdown_parser/src/parsers/BlockParsers';
import * as EmojiParsers from '@fluxer/markdown_parser/src/parsers/EmojiParsers';
import * as InlineParsers from '@fluxer/markdown_parser/src/parsers/InlineParsers';
import * as ListParsers from '@fluxer/markdown_parser/src/parsers/ListParsers';
import {NodeType, ParserFlags} from '@fluxer/markdown_parser/src/types/Enums';
import {MAX_AST_NODES, MAX_LINE_LENGTH} from '@fluxer/markdown_parser/src/types/MarkdownConstants';
import type {Node} from '@fluxer/markdown_parser/src/types/Nodes';
import * as ASTUtils from '@fluxer/markdown_parser/src/utils/AstUtils';

interface ParserRuntimeState {
	lines: Array<string>;
	currentLineIndex: number;
	totalLineCount: number;
	parserFlags: number;
	nodeCount: number;
}

export function parseMarkdownAst(input: string, parserFlags: number): {nodes: Array<Node>} {
	const parserInput = createParserInput(input);
	const state: ParserRuntimeState = {
		lines: parserInput.lines,
		currentLineIndex: 0,
		totalLineCount: parserInput.totalLineCount,
		parserFlags,
		nodeCount: 0,
	};

	return parseWithRuntimeState(state);
}

function parseWithRuntimeState(state: ParserRuntimeState): {nodes: Array<Node>} {
	const ast: Array<Node> = [];
	if (state.totalLineCount === 0) {
		return {nodes: ast};
	}

	const blockParserDependencies = createBlockParserDependencies(state);

	while (state.currentLineIndex < state.totalLineCount && state.nodeCount <= MAX_AST_NODES) {
		const line = state.lines[state.currentLineIndex];
		if (line.length > MAX_LINE_LENGTH) {
			state.lines[state.currentLineIndex] = line.slice(0, MAX_LINE_LENGTH);
		}

		const trimmedLine = line.trimStart();
		if (trimmedLine === '') {
			const blankLineCount = countBlankLines(state.lines, state.currentLineIndex, state.totalLineCount);
			if (ast.length > 0 && state.currentLineIndex + blankLineCount < state.totalLineCount) {
				const nextLine = state.lines[state.currentLineIndex + blankLineCount];
				const nextTrimmed = nextLine.trimStart();
				const isNextHeading = nextTrimmed
					? BlockParsers.parseHeading(nextTrimmed, blockParserDependencies.parseInline) !== null
					: false;
				const isPreviousHeading = ast[ast.length - 1]?.type === NodeType.Heading;

				if (!isNextHeading && !isPreviousHeading) {
					const newlines = '\n'.repeat(blankLineCount);
					ast.push({type: NodeType.Text, content: newlines});
					state.nodeCount++;
				}
			}
			state.currentLineIndex += blankLineCount;
			continue;
		}

		const blockResult = BlockParsers.parseBlock(
			state.lines,
			state.currentLineIndex,
			state.parserFlags,
			state.nodeCount,
			blockParserDependencies,
		);

		if (blockResult.node) {
			ast.push(blockResult.node);
			if (blockResult.extraNodes) {
				for (const extraNode of blockResult.extraNodes) {
					ast.push(extraNode);
				}
			}
			state.currentLineIndex = blockResult.newLineIndex;
			state.nodeCount = blockResult.newNodeCount;
			continue;
		}

		parseInlineLine(ast, state, blockParserDependencies.parseInline);
		state.currentLineIndex++;
	}

	ASTUtils.flattenAST(ast);

	for (const node of ast) {
		EmojiParsers.applyTextPresentation(node);
	}

	return {nodes: ast};
}

function createBlockParserDependencies(state: ParserRuntimeState): BlockParsers.BlockParserDependencies {
	return {
		parseInline(text: string): Array<Node> {
			return InlineParsers.parseInline(text, state.parserFlags);
		},
		parseNested(text: string, parserFlags: number): Array<Node> {
			return parseMarkdownAst(text, parserFlags).nodes;
		},
	};
}

function countBlankLines(lines: Array<string>, startLine: number, totalLineCount: number): number {
	let count = 0;
	let current = startLine;
	while (current < totalLineCount && lines[current].trim() === '') {
		count++;
		current++;
	}
	return count;
}

function parseInlineLine(
	ast: Array<Node>,
	state: ParserRuntimeState,
	parseInline: (text: string) => Array<Node>,
): void {
	let text = state.lines[state.currentLineIndex];
	let linesConsumed = 1;

	while (state.currentLineIndex + linesConsumed < state.totalLineCount) {
		const nextLine = state.lines[state.currentLineIndex + linesConsumed];
		const trimmedNext = nextLine.trimStart();

		if (isBlockStart(trimmedNext, state.parserFlags)) {
			break;
		}

		if (trimmedNext === '') {
			break;
		}

		text += `\n${nextLine}`;
		linesConsumed++;
	}

	if (state.currentLineIndex + linesConsumed < state.totalLineCount) {
		const nextLine = state.lines[state.currentLineIndex + linesConsumed];
		const trimmedNext = nextLine.trimStart();
		const isNextLineHeading = isHeadingStart(trimmedNext, state.parserFlags);
		const isNextLineBlockquote = trimmedNext.startsWith('>');
		if (trimmedNext === '' || (!isNextLineHeading && !isNextLineBlockquote)) {
			text += '\n';
		}
	}

	const inlineNodes = parseInline(text);

	for (const node of inlineNodes) {
		ast.push(node);
		state.nodeCount++;
		if (state.nodeCount > MAX_AST_NODES) break;
	}

	state.currentLineIndex += linesConsumed - 1;
}

function isBlockStart(line: string, parserFlags: number): boolean {
	return !!(
		line.startsWith('#') ||
		(parserFlags & ParserFlags.ALLOW_SUBTEXT && line.startsWith('-#')) ||
		(parserFlags & ParserFlags.ALLOW_CODE_BLOCKS && line.startsWith('```')) ||
		(parserFlags & ParserFlags.ALLOW_LISTS && ListParsers.matchListItem(line) != null) ||
		(parserFlags & (ParserFlags.ALLOW_BLOCKQUOTES | ParserFlags.ALLOW_MULTILINE_BLOCKQUOTES) &&
			(line.startsWith('>') || line.startsWith('>>> ')))
	);
}

const MAX_HEADING_LEVEL = 4;

function isHeadingStart(trimmedLine: string, parserFlags: number): boolean {
	if (!(parserFlags & ParserFlags.ALLOW_HEADINGS)) return false;
	if (!trimmedLine.startsWith('#')) return false;

	let level = 0;
	while (level < trimmedLine.length && level < MAX_HEADING_LEVEL && trimmedLine[level] === '#') {
		level++;
	}

	return level >= 1 && level <= MAX_HEADING_LEVEL && trimmedLine[level] === ' ';
}
