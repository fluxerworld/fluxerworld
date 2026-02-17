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

import {getErrorMessage} from '@fluxer/admin/src/api/Errors';
import {searchGuilds} from '@fluxer/admin/src/api/Guilds';
import {ErrorAlert} from '@fluxer/admin/src/components/ErrorDisplay';
import {Layout} from '@fluxer/admin/src/components/Layout';
import {Grid} from '@fluxer/admin/src/components/ui/Grid';
import {PageHeader} from '@fluxer/admin/src/components/ui/Layout/PageHeader';
import {Heading, Text} from '@fluxer/admin/src/components/ui/Typography';
import {buildPaginationUrl} from '@fluxer/admin/src/hooks/usePaginationUrl';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import type {Flash} from '@fluxer/hono/src/Flash';
import type {GuildAdminResponse} from '@fluxer/schema/src/domains/admin/AdminGuildSchemas';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {Button} from '@fluxer/ui/src/components/Button';
import {EmptyState} from '@fluxer/ui/src/components/EmptyState';
import {Pagination} from '@fluxer/ui/src/components/Pagination';
import {SearchForm} from '@fluxer/ui/src/components/SearchForm';
import {getGuildIconUrl, getInitials as getInitialsFromName} from '@fluxer/ui/src/utils/FormatUser';
import type {FC} from 'hono/jsx';
import type {z} from 'zod';

interface GuildsPageProps {
	config: Config;
	session: Session;
	currentAdmin: UserAdminResponse | undefined;
	flash: Flash | undefined;
	csrfToken: string;
	searchQuery: string | undefined;
	page: number;
	assetVersion: string;
}

const GuildCard: FC<{config: Config; guild: z.infer<typeof GuildAdminResponse>}> = ({config, guild}) => {
	const iconUrl = getGuildIconUrl(config.mediaEndpoint, guild.id, guild.icon, true);

	return (
		<div class="overflow-hidden rounded-lg border border-neutral-200 bg-white transition-colors hover:border-neutral-300">
			<div class="p-5">
				<div class="flex flex-col gap-4 sm:flex-row sm:items-center">
					{iconUrl ? (
						<div class="flex flex-shrink-0 items-center justify-center sm:block">
							<img src={iconUrl} alt={guild.name} class="h-16 w-16 rounded-full" />
						</div>
					) : (
						<div class="flex flex-shrink-0 items-center justify-center sm:block">
							<div class="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-200 font-medium text-base text-neutral-600">
								{getInitialsFromName(guild.name)}
							</div>
						</div>
					)}
					<div class="min-w-0 flex-1">
						<div class="mb-2 flex flex-wrap items-center gap-2">
							<Heading level={2} size="base">
								{guild.name}
							</Heading>
							{guild.features.length > 0 && (
								<span class="rounded bg-purple-100 px-2 py-0.5 text-purple-700 text-xs uppercase">Featured</span>
							)}
						</div>
						<div class="space-y-0.5">
							<Text size="sm" color="muted" class="break-all">
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
						</div>
					</div>
					<Button variant="primary" size="small" href={`${config.basePath}/guilds/${guild.id}`}>
						View Details
					</Button>
				</div>
			</div>
		</div>
	);
};

const GuildsGrid: FC<{config: Config; guilds: Array<z.infer<typeof GuildAdminResponse>>}> = ({config, guilds}) => {
	return (
		<Grid cols={1} gap="md">
			{guilds.map((guild) => (
				<GuildCard config={config} guild={guild} />
			))}
		</Grid>
	);
};

const GuildsEmptyState: FC = () => {
	return (
		<EmptyState
			title="Enter a search query to find guilds"
			message="Search by Guild ID, Guild Name, Vanity URL, or other attributes"
		/>
	);
};

const EmptySearchResults: FC = () => {
	return <EmptyState title="No guilds found" message="Try adjusting your search query" />;
};

export async function GuildsPage({
	config,
	session,
	currentAdmin,
	flash,
	csrfToken,
	searchQuery,
	page,
	assetVersion,
}: GuildsPageProps) {
	const limit = 50;
	const offset = page * limit;

	let content = <div />;

	if (searchQuery && searchQuery.trim() !== '') {
		const result = await searchGuilds(config, session, searchQuery.trim(), limit, offset);

		if (result.ok) {
			const {guilds, total} = result.data;

			content = (
				<div class="mx-auto max-w-7xl space-y-6">
					<PageHeader
						title="Guilds"
						actions={
							<Text size="sm" color="muted">
								Found {total} results (showing {guilds.length})
							</Text>
						}
					/>
					<SearchForm
						action="/guilds"
						basePath={config.basePath}
						fields={[
							{
								name: 'q',
								type: 'text',
								value: searchQuery,
								placeholder: 'Search by ID, guild name, or vanity URL...',
								autocomplete: 'off',
							},
						]}
						layout="horizontal"
					/>
					{guilds.length === 0 ? (
						<EmptySearchResults />
					) : (
						<>
							<GuildsGrid config={config} guilds={guilds} />
							<Pagination
								basePath={config.basePath}
								currentPage={page}
								totalPages={Math.ceil(total / limit)}
								buildUrlFn={(p) => `/guilds${buildPaginationUrl(p, {q: searchQuery})}`}
							/>
						</>
					)}
				</div>
			);
		} else {
			content = (
				<div class="mx-auto max-w-7xl space-y-6">
					<PageHeader title="Guilds" />
					<SearchForm
						action="/guilds"
						basePath={config.basePath}
						fields={[
							{
								name: 'q',
								type: 'text',
								value: searchQuery,
								placeholder: 'Search by ID, guild name, or vanity URL...',
								autocomplete: 'off',
							},
						]}
						layout="horizontal"
					/>
					<ErrorAlert error={getErrorMessage(result.error)} />
				</div>
			);
		}
	} else {
		content = (
			<div class="mx-auto max-w-7xl space-y-6">
				<PageHeader title="Guilds" />
				<SearchForm
					action="/guilds"
					basePath={config.basePath}
					fields={[
						{
							name: 'q',
							type: 'text',
							value: searchQuery,
							placeholder: 'Search by ID, guild name, or vanity URL...',
							autocomplete: 'off',
						},
					]}
					layout="horizontal"
				/>
				<GuildsEmptyState />
			</div>
		);
	}

	return (
		<Layout
			csrfToken={csrfToken}
			title="Guilds"
			activePage="guilds"
			config={config}
			session={session}
			currentAdmin={currentAdmin}
			flash={flash}
			assetVersion={assetVersion}
		>
			{content}
		</Layout>
	);
}
