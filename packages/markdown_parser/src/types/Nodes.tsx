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

import type {AlertType, NodeType, TableAlignment, TimestampStyle} from '@fluxer/markdown_parser/src/types/Enums';

interface BaseNode {
	type: NodeType;
}

export interface TextNode extends BaseNode {
	type: 'Text';
	content: string;
}

export interface BlockquoteNode extends BaseNode {
	type: 'Blockquote';
	children: Array<Node>;
}

export interface FormattingNode extends BaseNode {
	type: 'Strong' | 'Emphasis' | 'Underline' | 'Strikethrough' | 'Spoiler' | 'Sequence';
	children: Array<Node>;
}

export interface HeadingNode extends BaseNode {
	type: 'Heading';
	level: number;
	children: Array<Node>;
}

export interface SubtextNode extends BaseNode {
	type: 'Subtext';
	children: Array<Node>;
}

export interface ListNode extends BaseNode {
	type: 'List';
	ordered: boolean;
	items: Array<ListItem>;
}

export interface ListItem {
	children: Array<Node>;
	ordinal?: number;
}

export interface CodeBlockNode extends BaseNode {
	type: 'CodeBlock';
	language?: string;
	content: string;
}

export interface InlineCodeNode extends BaseNode {
	type: 'InlineCode';
	content: string;
}

export interface LinkNode extends BaseNode {
	type: 'Link';
	text?: Node;
	url: string;
	escaped: boolean;
}

export interface MentionNode extends BaseNode {
	type: 'Mention';
	kind: MentionType;
}

export interface TimestampNode extends BaseNode {
	type: 'Timestamp';
	timestamp: number;
	style: TimestampStyle;
}

export interface EmojiNode extends BaseNode {
	type: 'Emoji';
	kind: EmojiType;
}

export interface SequenceNode extends BaseNode {
	type: 'Sequence';
	children: Array<Node>;
}

export interface TableNode extends BaseNode {
	type: 'Table';
	header: TableRowNode;
	alignments: Array<TableAlignment>;
	rows: Array<TableRowNode>;
}

export interface TableRowNode extends BaseNode {
	type: 'TableRow';
	cells: Array<TableCellNode>;
}

export interface TableCellNode extends BaseNode {
	type: 'TableCell';
	children: Array<Node>;
}

export interface AlertNode extends BaseNode {
	type: 'Alert';
	alertType: AlertType;
	children: Array<Node>;
}

export interface SpoilerNode extends BaseNode {
	type: 'Spoiler';
	children: Array<Node>;
	isBlock: boolean;
}

export type Node =
	| TextNode
	| BlockquoteNode
	| FormattingNode
	| HeadingNode
	| SubtextNode
	| ListNode
	| CodeBlockNode
	| InlineCodeNode
	| LinkNode
	| MentionNode
	| TimestampNode
	| EmojiNode
	| SequenceNode
	| TableNode
	| TableRowNode
	| TableCellNode
	| AlertNode
	| SpoilerNode;

export type MentionType =
	| {kind: 'User'; id: string}
	| {kind: 'Channel'; id: string}
	| {kind: 'Role'; id: string}
	| {kind: 'Command'; name: string; subcommandGroup?: string; subcommand?: string; id: string}
	| {kind: 'GuildNavigation'; navigationType: 'Customize' | 'Browse' | 'Guide'}
	| {kind: 'GuildNavigation'; navigationType: 'LinkedRoles'; id?: string}
	| {kind: 'Everyone'}
	| {kind: 'Here'};

export type EmojiType =
	| {kind: 'Standard'; raw: string; codepoints: string; name: string}
	| {kind: 'Custom'; name: string; id: string; animated: boolean};

export interface ParserResult {
	node: Node;
	advance: number;
}
