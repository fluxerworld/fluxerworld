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

import {type ApiError, getErrorMessage} from '@fluxer/admin/src/api/Errors';
import {Grid} from '@fluxer/admin/src/components/ui/Grid';
import {Stack} from '@fluxer/admin/src/components/ui/Stack';
import {Heading, Text} from '@fluxer/admin/src/components/ui/Typography';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import type {ListUserDmChannelsResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {Button} from '@fluxer/ui/src/components/Button';
import {Card} from '@fluxer/ui/src/components/Card';
import type {FC} from 'hono/jsx';

interface DmHistoryTabProps {
	config: Config;
	userId: string;
	dmChannelsResult: {ok: true; data: ListUserDmChannelsResponse} | {ok: false; error: ApiError} | null;
	before: string | null;
	after: string | null;
	limit: number;
}

export function DmHistoryTab({config, userId, dmChannelsResult, before, after, limit}: DmHistoryTabProps) {
	if (!dmChannelsResult) {
		return null;
	}

	if (!dmChannelsResult.ok) {
		return (
			<Card padding="md">
				<Stack gap="sm">
					<Heading level={2} size="base">
						DM History
					</Heading>
					<Text size="sm" color="muted">
						Failed to load DM history: {getErrorMessage(dmChannelsResult.error)}
					</Text>
				</Stack>
			</Card>
		);
	}

	const channels = dmChannelsResult.data.channels;

	return (
		<Stack gap="lg">
			<Card padding="md">
				<Stack gap="md">
					<Heading level={2} size="base">{`DM History (${channels.length})`}</Heading>
					<Text size="sm" color="muted">
						Historical one-to-one DMs for this user. Group DMs are not included in this dataset.
					</Text>
					{channels.length === 0 ? (
						<Text size="sm" color="muted">
							No historical DM channels found.
						</Text>
					) : (
						<DmChannelsGrid config={config} userId={userId} channels={channels} />
					)}
				</Stack>
			</Card>
			<DmHistoryPagination
				config={config}
				userId={userId}
				channels={channels}
				limit={limit}
				before={before}
				after={after}
			/>
		</Stack>
	);
}

const DmChannelsGrid: FC<{
	config: Config;
	userId: string;
	channels: ListUserDmChannelsResponse['channels'];
}> = ({config, userId, channels}) => {
	return (
		<Grid cols={1} gap="md">
			{channels.map((channel) => (
				<div
					key={channel.channel_id}
					class="overflow-hidden rounded-lg border border-neutral-200 bg-white transition-colors hover:border-neutral-300"
				>
					<div class="p-5">
						<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
							<div class="min-w-0 flex-1">
								<div class="mb-2 flex items-center gap-2">
									<Heading level={3} size="sm">
										DM {channel.channel_id}
									</Heading>
									<span class="rounded bg-neutral-100 px-2 py-0.5 text-neutral-700 text-xs uppercase">
										{formatChannelType(channel.channel_type)}
									</span>
								</div>
								<Stack gap="sm">
									<Text size="sm" color="muted">
										Status: {channel.is_open ? 'Open' : 'Closed'}
									</Text>
									<Text size="sm" color="muted">
										Last Message ID: {channel.last_message_id ?? 'None'}
									</Text>
									<CounterpartyRow config={config} userId={userId} recipientIds={channel.recipient_ids} />
								</Stack>
							</div>
							<div class="flex flex-wrap gap-2">
								<Button variant="primary" size="small" href={buildMessageLookupHref(config, channel.channel_id)}>
									View Channel
								</Button>
							</div>
						</div>
					</div>
				</div>
			))}
		</Grid>
	);
};

const CounterpartyRow: FC<{config: Config; userId: string; recipientIds: Array<string>}> = ({
	config,
	userId,
	recipientIds,
}) => {
	const counterpartyIds = recipientIds.filter((recipientId) => recipientId !== userId);

	if (counterpartyIds.length === 0) {
		return (
			<Text size="sm" color="muted">
				Counterparty: unavailable
			</Text>
		);
	}

	return (
		<div class="text-neutral-600 text-sm">
			Counterparty:{' '}
			{counterpartyIds.map((recipientId, index) => (
				<span key={recipientId}>
					<a
						href={`${config.basePath}/users/${recipientId}`}
						class="font-mono transition-colors hover:text-blue-600 hover:underline"
					>
						{recipientId}
					</a>
					{index < counterpartyIds.length - 1 ? ', ' : ''}
				</span>
			))}
		</div>
	);
};

interface DmHistoryPaginationProps {
	config: Config;
	userId: string;
	channels: ListUserDmChannelsResponse['channels'];
	limit: number;
	before: string | null;
	after: string | null;
}

const DmHistoryPagination: FC<DmHistoryPaginationProps> = ({config, userId, channels, limit, before, after}) => {
	const hasNext = channels.length === limit;
	const hasPrevious = before !== null || after !== null;
	const firstChannel = channels[0];
	const lastChannel = channels[channels.length - 1];
	const firstId = firstChannel ? firstChannel.channel_id : null;
	const lastId = lastChannel ? lastChannel.channel_id : null;

	const prevPath = hasPrevious && firstId ? buildPaginationPath(config, userId, null, firstId, limit) : null;
	const nextPath = hasNext && lastId ? buildPaginationPath(config, userId, lastId, null, limit) : null;

	if (!prevPath && !nextPath) {
		return null;
	}

	return (
		<div class="flex items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2">
			{prevPath && (
				<a
					href={prevPath}
					class="rounded px-3 py-1 font-medium text-neutral-600 text-sm transition-colors hover:bg-white hover:text-neutral-900"
				>
					Previous
				</a>
			)}
			{nextPath && (
				<a
					href={nextPath}
					class="rounded px-3 py-1 font-medium text-neutral-600 text-sm transition-colors hover:bg-white hover:text-neutral-900"
				>
					Next
				</a>
			)}
		</div>
	);
};

function buildPaginationPath(
	config: Config,
	userId: string,
	before: string | null,
	after: string | null,
	limit: number,
): string {
	const params = [`tab=dm_history`, `dm_limit=${limit}`];
	if (before) {
		params.push(`dm_before=${before}`);
	}
	if (after) {
		params.push(`dm_after=${after}`);
	}
	return `${config.basePath}/users/${userId}?${params.join('&')}`;
}

function buildMessageLookupHref(config: Config, channelId: string): string {
	const params = new URLSearchParams();
	params.set('channel_id', channelId);
	params.set('context_limit', '50');
	return `${config.basePath}/messages?${params.toString()}`;
}

function formatChannelType(channelType: number | null): string {
	if (channelType === 1) {
		return 'DM';
	}
	if (channelType === 3) {
		return 'Group DM';
	}
	return 'Unknown';
}
