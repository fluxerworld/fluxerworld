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

import {DebugModal, type DebugTab, SummaryItem} from '@app/components/debug/DebugModal';
import {parse} from '@app/lib/markdown/renderers';
import {MarkdownContext} from '@app/lib/markdown/renderers/RendererTypes';
import type {MessageRecord} from '@app/records/MessageRecord';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useMemo} from 'react';

interface MessageDebugModalProps {
	title: string;
	message: MessageRecord;
}

export const MessageDebugModal: React.FC<MessageDebugModalProps> = observer(({title, message}) => {
	const {t} = useLingui();
	const recordJsonData = useMemo(() => message.toJSON(), [message]);

	const astData = useMemo(() => {
		const results: Record<string, unknown> = {};
		let totalParseTime = 0;

		if (message.content) {
			const startTime = performance.now();
			const nodes = parse({
				content: message.content,
				context: MarkdownContext.STANDARD_WITH_JUMBO,
			});
			const endTime = performance.now();
			const parseTime = endTime - startTime;

			results.message_content = {
				content: message.content,
				ast: nodes,
				parseTime,
			};
			totalParseTime += parseTime;
		}

		if (message.embeds.length > 0) {
			const embedResults: Array<Record<string, unknown>> = [];

			for (const [index, embed] of message.embeds.entries()) {
				const embedResult: Record<string, unknown> = {
					embed_index: index,
					embed_type: embed.type,
				};

				if (embed.title) {
					const startTime = performance.now();
					const nodes = parse({
						content: embed.title,
						context: MarkdownContext.STANDARD_WITH_JUMBO,
					});
					const endTime = performance.now();
					const parseTime = endTime - startTime;

					embedResult.title = {
						content: embed.title,
						ast: nodes,
						parseTime,
					};
					totalParseTime += parseTime;
				}

				if (embed.description) {
					const startTime = performance.now();
					const nodes = parse({
						content: embed.description,
						context: MarkdownContext.STANDARD_WITH_JUMBO,
					});
					const endTime = performance.now();
					const parseTime = endTime - startTime;

					embedResult.description = {
						content: embed.description,
						ast: nodes,
						parseTime,
					};
					totalParseTime += parseTime;
				}

				if (embed.fields && embed.fields.length > 0) {
					const fieldResults: Array<Record<string, unknown>> = [];

					for (const [fieldIndex, field] of embed.fields.entries()) {
						const fieldResult: Record<string, unknown> = {
							field_index: fieldIndex,
							inline: field.inline,
						};

						if (field.name) {
							const startTime = performance.now();
							const nodes = parse({
								content: field.name,
								context: MarkdownContext.STANDARD_WITH_JUMBO,
							});
							const endTime = performance.now();
							const parseTime = endTime - startTime;

							fieldResult.name = {
								content: field.name,
								ast: nodes,
								parseTime,
							};
							totalParseTime += parseTime;
						}

						if (field.value) {
							const startTime = performance.now();
							const nodes = parse({
								content: field.value,
								context: MarkdownContext.STANDARD_WITH_JUMBO,
							});
							const endTime = performance.now();
							const parseTime = endTime - startTime;

							fieldResult.value = {
								content: field.value,
								ast: nodes,
								parseTime,
							};
							totalParseTime += parseTime;
						}

						fieldResults.push(fieldResult);
					}

					embedResult.fields = fieldResults;
				}

				embedResults.push(embedResult);
			}

			results.embeds = embedResults;
		}

		if (Object.keys(results).length === 0) {
			return null;
		}

		return {
			results,
			totalParseTime,
		};
	}, [message.content, message.embeds]);

	const tabs: Array<DebugTab> = [
		{
			id: 'record',
			label: t`Message Record`,
			data: recordJsonData,
		},
		{
			id: 'ast',
			label: t`Message AST`,
			data: astData?.results ?? null,
			summary: astData ? (
				<SummaryItem label={t`Total Parsing Time:`} value={`${astData.totalParseTime.toFixed(2)} ms`} />
			) : null,
		},
	];

	return <DebugModal title={title} tabs={tabs} />;
});
