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
import {getParserFlagsForContext, render, wrapRenderedContent} from '@app/lib/markdown/renderers';
import {MarkdownContext, type MarkdownParseOptions} from '@app/lib/markdown/renderers/RendererTypes';
import markupStyles from '@app/styles/Markup.module.css';
import {Parser} from '@fluxer/markdown_parser/src/parser/Parser';
import {Trans} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import React from 'react';

const logger = new Logger('SafeMarkdown');

const MarkdownErrorBoundary = class MarkdownErrorBoundary extends React.Component<
	{children: React.ReactNode},
	{hasError: boolean; error: Error | null}
> {
	constructor(props: {children: React.ReactNode}) {
		super(props);
		this.state = {hasError: false, error: null};
	}

	static getDerivedStateFromError(error: Error) {
		return {hasError: true, error};
	}

	override componentDidCatch(error: Error, info: React.ErrorInfo) {
		logger.error('Error rendering markdown:', error, info);
	}

	override render() {
		if (this.state.hasError) {
			return (
				<span className={markupStyles.error}>
					<Trans>Error rendering content</Trans>
				</span>
			);
		}

		return this.props.children;
	}
};

function parseMarkdown(
	content: string,
	options: MarkdownParseOptions = {context: MarkdownContext.STANDARD_WITHOUT_JUMBO},
): React.ReactNode {
	try {
		const flags = getParserFlagsForContext(options.context);

		const parser = new Parser(content, flags);
		const {nodes} = parser.parse();

		const renderedContent = render(nodes, options);

		return wrapRenderedContent(renderedContent, options.context);
	} catch (error) {
		logger.error(`Error parsing markdown (${options.context}):`, error);
		return <span>{content}</span>;
	}
}

export const SafeMarkdown = observer(function SafeMarkdown({
	content,
	options = {context: MarkdownContext.STANDARD_WITHOUT_JUMBO},
}: {
	content: string;
	options?: MarkdownParseOptions;
}): React.ReactElement {
	return <MarkdownErrorBoundary>{parseMarkdown(content, options)}</MarkdownErrorBoundary>;
});
