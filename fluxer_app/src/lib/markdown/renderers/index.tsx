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

import {Logger} from '@app/lib/Logger';
import {TABLE_PARSING_FLAG} from '@app/lib/markdown/MarkdownTableParsingConfig';
import {
	AlertRenderer,
	BlockquoteRenderer,
	HeadingRenderer,
	ListRenderer,
	SequenceRenderer,
	SubtextRenderer,
	TableRenderer,
} from '@app/lib/markdown/renderers/common/BlockElements';
import {CodeBlockRenderer, InlineCodeRenderer} from '@app/lib/markdown/renderers/common/CodeElements';
import {
	EmphasisRenderer,
	SpoilerRenderer,
	StrikethroughRenderer,
	StrongRenderer,
	UnderlineRenderer,
} from '@app/lib/markdown/renderers/common/FormattingElements';
import {EmojiRenderer} from '@app/lib/markdown/renderers/EmojiRenderer';
import {LinkRenderer} from '@app/lib/markdown/renderers/LinkRenderer';
import {MentionRenderer} from '@app/lib/markdown/renderers/MentionRenderer';
import {
	MarkdownContext,
	type MarkdownParseOptions,
	type MarkdownRenderOptions,
	type RendererProps,
} from '@app/lib/markdown/renderers/RendererTypes';
import {TextRenderer} from '@app/lib/markdown/renderers/TextRenderer';
import {TimestampRenderer} from '@app/lib/markdown/renderers/TimestampRenderer';
import {shouldRenderAsJumboEmojis} from '@app/lib/markdown/utils/JumboDetector';
import markupStyles from '@app/styles/Markup.module.css';
import {Parser} from '@fluxer/markdown_parser/src/parser/Parser';
import {NodeType, ParserFlags} from '@fluxer/markdown_parser/src/types/Enums';
import type {Node} from '@fluxer/markdown_parser/src/types/Nodes';
import {i18n} from '@lingui/core';
import React from 'react';

const logger = new Logger('MarkdownRenderers');

const STANDARD_FLAGS =
	ParserFlags.ALLOW_SPOILERS |
	ParserFlags.ALLOW_HEADINGS |
	ParserFlags.ALLOW_LISTS |
	ParserFlags.ALLOW_CODE_BLOCKS |
	ParserFlags.ALLOW_MASKED_LINKS |
	ParserFlags.ALLOW_COMMAND_MENTIONS |
	ParserFlags.ALLOW_GUILD_NAVIGATIONS |
	ParserFlags.ALLOW_USER_MENTIONS |
	ParserFlags.ALLOW_ROLE_MENTIONS |
	ParserFlags.ALLOW_CHANNEL_MENTIONS |
	ParserFlags.ALLOW_EVERYONE_MENTIONS |
	ParserFlags.ALLOW_BLOCKQUOTES |
	ParserFlags.ALLOW_MULTILINE_BLOCKQUOTES |
	ParserFlags.ALLOW_SUBTEXT |
	TABLE_PARSING_FLAG |
	ParserFlags.ALLOW_ALERTS |
	ParserFlags.ALLOW_AUTOLINKS;

const RESTRICTED_INLINE_REPLY_FLAGS =
	STANDARD_FLAGS &
	~(
		ParserFlags.ALLOW_BLOCKQUOTES |
		ParserFlags.ALLOW_MULTILINE_BLOCKQUOTES |
		ParserFlags.ALLOW_SUBTEXT |
		ParserFlags.ALLOW_TABLES |
		ParserFlags.ALLOW_ALERTS |
		ParserFlags.ALLOW_CODE_BLOCKS |
		ParserFlags.ALLOW_HEADINGS |
		ParserFlags.ALLOW_LISTS
	);

const RESTRICTED_USER_BIO_FLAGS =
	STANDARD_FLAGS &
	~(
		ParserFlags.ALLOW_HEADINGS |
		ParserFlags.ALLOW_CODE_BLOCKS |
		ParserFlags.ALLOW_ROLE_MENTIONS |
		ParserFlags.ALLOW_EVERYONE_MENTIONS |
		ParserFlags.ALLOW_SUBTEXT |
		ParserFlags.ALLOW_TABLES |
		ParserFlags.ALLOW_ALERTS
	);

const RESTRICTED_EMBED_DESCRIPTION_FLAGS =
	STANDARD_FLAGS &
	~(ParserFlags.ALLOW_HEADINGS | ParserFlags.ALLOW_TABLES | ParserFlags.ALLOW_ALERTS | ParserFlags.ALLOW_AUTOLINKS);

export function getParserFlagsForContext(context: MarkdownContext): number {
	switch (context) {
		case MarkdownContext.RESTRICTED_INLINE_REPLY:
			return RESTRICTED_INLINE_REPLY_FLAGS;
		case MarkdownContext.RESTRICTED_USER_BIO:
			return RESTRICTED_USER_BIO_FLAGS;
		case MarkdownContext.RESTRICTED_EMBED_DESCRIPTION:
			return RESTRICTED_EMBED_DESCRIPTION_FLAGS;
		default:
			return STANDARD_FLAGS;
	}
}

export function parse({content, context}: {content: string; context: MarkdownContext}) {
	const flags = getParserFlagsForContext(context);
	const parser = new Parser(content, flags);
	return parser.parse();
}

const renderers = {
	[NodeType.Sequence]: SequenceRenderer,
	[NodeType.Text]: TextRenderer,
	[NodeType.Strong]: StrongRenderer,
	[NodeType.Emphasis]: EmphasisRenderer,
	[NodeType.Underline]: UnderlineRenderer,
	[NodeType.Strikethrough]: StrikethroughRenderer,
	[NodeType.Spoiler]: SpoilerRenderer,
	[NodeType.Timestamp]: TimestampRenderer,
	[NodeType.Blockquote]: BlockquoteRenderer,
	[NodeType.CodeBlock]: CodeBlockRenderer,
	[NodeType.InlineCode]: InlineCodeRenderer,
	[NodeType.Link]: LinkRenderer,
	[NodeType.Mention]: MentionRenderer,
	[NodeType.Emoji]: EmojiRenderer,
	[NodeType.List]: ListRenderer,
	[NodeType.Heading]: HeadingRenderer,
	[NodeType.Subtext]: SubtextRenderer,
	[NodeType.Table]: TableRenderer,
	[NodeType.TableRow]: () => null,
	[NodeType.TableCell]: () => null,
	[NodeType.Alert]: AlertRenderer,
} as Record<NodeType, React.ComponentType<RendererProps>>;

function renderNode(node: Node, id: string, options: MarkdownRenderOptions): React.ReactNode {
	const renderer = renderers[node.type];
	if (!renderer) {
		logger.warn(`No renderer found for node type: ${node.type}`);
		return null;
	}

	const renderChildrenFn = (children: Array<Node>) =>
		children.map((child, i) => renderNode(child, `${id}-${i}`, options));

	return React.createElement(renderer, {
		node,
		id,
		renderChildren: renderChildrenFn,
		options,
		key: id,
	});
}

export function render(nodes: Array<Node>, options: MarkdownParseOptions): React.ReactNode {
	const shouldJumboEmojis = options.context === MarkdownContext.STANDARD_WITH_JUMBO && shouldRenderAsJumboEmojis(nodes);

	const renderOptions: MarkdownRenderOptions = {
		...options,
		shouldJumboEmojis,
		i18n,
	};

	return nodes.map((node, i) => renderNode(node, `${options.context}-${i}`, renderOptions));
}

export function wrapRenderedContent(content: React.ReactNode, context: MarkdownContext): React.ReactNode {
	if (context === MarkdownContext.RESTRICTED_INLINE_REPLY) {
		return <div className={markupStyles.inlineFormat}>{content}</div>;
	}

	return content;
}
