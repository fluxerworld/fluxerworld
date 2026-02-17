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

import type {ApiError} from '@fluxer/admin/src/api/Errors';
import {Grid} from '@fluxer/admin/src/components/ui/Grid';
import {Stack} from '@fluxer/admin/src/components/ui/Stack';
import {Heading, Text} from '@fluxer/admin/src/components/ui/Typography';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import type {GuildAdminResponse, ListUserGuildsResponse} from '@fluxer/schema/src/domains/admin/AdminGuildSchemas';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {Button} from '@fluxer/ui/src/components/Button';
import {Card} from '@fluxer/ui/src/components/Card';
import {getGuildIconUrl, getInitials as getInitialsFromName} from '@fluxer/ui/src/utils/FormatUser';
import type {FC} from 'hono/jsx';

interface GuildsTabProps {
	config: Config;
	user: UserAdminResponse;
	userId: string;
	guildsResult: {ok: true; data: ListUserGuildsResponse} | {ok: false; error: ApiError} | null;
	before: string | null;
	after: string | null;
	limit: number;
	withCounts: boolean;
}

export function GuildsTab({
	config,
	user: _user,
	userId,
	guildsResult,
	before,
	after,
	limit,
	withCounts,
}: GuildsTabProps) {
	if (!guildsResult?.ok) {
		return null;
	}

	const guilds = guildsResult.data.guilds;

	return (
		<Stack gap="lg">
			<Card padding="md">
				<Stack gap="md">
					<Heading level={2} size="base">{`Guilds (${guilds.length})`}</Heading>
					{guilds.length === 0 ? (
						<Text size="sm" color="muted">
							No guilds
						</Text>
					) : (
						<GuildsGrid config={config} guilds={guilds} />
					)}
				</Stack>
			</Card>
			<GuildsPagination
				config={config}
				userId={userId}
				guilds={guilds}
				limit={limit}
				withCounts={withCounts}
				before={before}
				after={after}
			/>
		</Stack>
	);
}

const GuildsGrid: FC<{config: Config; guilds: Array<GuildAdminResponse>}> = ({config, guilds}) => {
	return (
		<Grid cols={1} gap="md">
			{guilds.map((guild) => (
				<GuildCard config={config} guild={guild} />
			))}
		</Grid>
	);
};

const GuildCard: FC<{config: Config; guild: GuildAdminResponse}> = ({config, guild}) => {
	const iconUrl = getGuildIconUrl(config.mediaEndpoint, guild.id, guild.icon, true);

	return (
		<div class="overflow-hidden rounded-lg border border-neutral-200 bg-white transition-colors hover:border-neutral-300">
			<div class="p-5">
				<div class="flex items-center gap-4">
					{iconUrl ? (
						<div class="flex-shrink-0">
							<img src={iconUrl} alt={guild.name} class="h-16 w-16 rounded-full" />
						</div>
					) : (
						<div class="flex-shrink-0">
							<div class="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-200 font-medium text-base text-neutral-600">
								{getInitialsFromName(guild.name)}
							</div>
						</div>
					)}
					<div class="min-w-0 flex-1">
						<div class="mb-2 flex items-center gap-2">
							<Heading level={2} size="base">
								{guild.name}
							</Heading>
							{guild.features.length > 0 && (
								<span class="rounded bg-purple-100 px-2 py-0.5 text-purple-700 text-xs uppercase">Featured</span>
							)}
						</div>
						<Stack gap="sm">
							<Text size="sm" color="muted">
								ID: {guild.id}
							</Text>
							<Text size="sm" color="muted">
								Members: {guild.member_count}
							</Text>
							<Text size="sm" color="muted">
								Owner:{' '}
								<a
									href={`${config.basePath}/users/${guild.owner_id}`}
									class="transition-colors hover:text-blue-600 hover:underline"
								>
									{guild.owner_id}
								</a>
							</Text>
						</Stack>
					</div>
					<Button variant="primary" size="small" href={`${config.basePath}/guilds/${guild.id}`}>
						View Details
					</Button>
				</div>
			</div>
		</div>
	);
};

interface GuildsPaginationProps {
	config: Config;
	userId: string;
	guilds: Array<GuildAdminResponse>;
	limit: number;
	withCounts: boolean;
	before: string | null;
	after: string | null;
}

const GuildsPagination: FC<GuildsPaginationProps> = ({config, userId, guilds, limit, withCounts, before, after}) => {
	const hasNext = guilds.length === limit;
	const hasPrevious = before !== null || after !== null;
	const firstGuild = guilds[0];
	const lastGuild = guilds[guilds.length - 1];
	const firstId = firstGuild ? firstGuild.id : null;
	const lastId = lastGuild ? lastGuild.id : null;

	const prevPath =
		hasPrevious && firstId ? buildGuildsPaginationPath(config, userId, firstId, null, limit, withCounts) : null;

	const nextPath =
		hasNext && lastId ? buildGuildsPaginationPath(config, userId, null, lastId, limit, withCounts) : null;

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

function buildGuildsPaginationPath(
	config: Config,
	userId: string,
	before: string | null,
	after: string | null,
	limit: number,
	withCounts: boolean,
): string {
	return `${config.basePath}/users/${userId}?${buildGuildsPaginationQuery(before, after, limit, withCounts)}`;
}

function buildGuildsPaginationQuery(
	before: string | null,
	after: string | null,
	limit: number,
	withCounts: boolean,
): string {
	const params = [`tab=guilds`, `guilds_limit=${limit}`, `guilds_with_counts=${boolToFlag(withCounts)}`];

	if (before) {
		params.push(`guilds_before=${before}`);
	}

	if (after) {
		params.push(`guilds_after=${after}`);
	}

	return params.join('&');
}

function boolToFlag(value: boolean): string {
	return value ? '1' : '0';
}
