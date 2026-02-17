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
import {searchUsers} from '@fluxer/admin/src/api/Users';
import {ErrorAlert} from '@fluxer/admin/src/components/ErrorDisplay';
import {Layout} from '@fluxer/admin/src/components/Layout';
import {UserProfileBadges} from '@fluxer/admin/src/components/UserProfileBadges';
import {PageHeader} from '@fluxer/admin/src/components/ui/Layout/PageHeader';
import {Stack} from '@fluxer/admin/src/components/ui/Stack';
import {TextLink} from '@fluxer/admin/src/components/ui/TextLink';
import {Text} from '@fluxer/admin/src/components/ui/Typography';
import {buildPaginationUrl} from '@fluxer/admin/src/hooks/usePaginationUrl';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import type {Flash} from '@fluxer/hono/src/Flash';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {Badge} from '@fluxer/ui/src/components/Badge';
import {EmptyState} from '@fluxer/ui/src/components/EmptyState';
import {SearchForm} from '@fluxer/ui/src/components/SearchForm';
import {
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableHeaderCell,
	TableRow,
} from '@fluxer/ui/src/components/Table';
import {formatDiscriminator, getUserAvatarUrl} from '@fluxer/ui/src/utils/FormatUser';
import type {Child, FC} from 'hono/jsx';

interface UsersPageProps {
	config: Config;
	session: Session;
	currentAdmin: UserAdminResponse | undefined;
	flash: Flash | undefined;
	searchQuery: string | undefined;
	page: number;
	assetVersion: string;
	csrfToken: string;
}

const InitialEmptyState: FC = () => {
	return (
		<Stack gap="md">
			<EmptyState title="Enter a search query to find users" />
		</Stack>
	);
};

const SearchResults: FC<{
	config: Config;
	users: Array<UserAdminResponse>;
	searchQuery: string;
	page: number;
	hasMore: boolean;
	assetVersion: string;
}> = ({config, users, searchQuery, page, hasMore, assetVersion}) => {
	return (
		<Stack gap="md">
			{users.length === 0 ? (
				<EmptyState title={`No users found matching "${searchQuery}"`} />
			) : (
				<UsersTable config={config} users={users} assetVersion={assetVersion} />
			)}
			{(page > 0 || hasMore) && (
				<PaginationControls config={config} searchQuery={searchQuery} page={page} hasMore={hasMore} />
			)}
		</Stack>
	);
};

const UsersTable: FC<{config: Config; users: Array<UserAdminResponse>; assetVersion: string}> = ({
	config,
	users,
	assetVersion,
}) => {
	return (
		<TableContainer>
			<Table>
				<TableHead>
					<tr>
						<TableHeaderCell label="User" />
						<TableHeaderCell label="ID" />
						<TableHeaderCell label="Email" />
						<TableHeaderCell label="Status" />
					</tr>
				</TableHead>
				<TableBody>
					{users.map((user) => (
						<UserRow config={config} user={user} assetVersion={assetVersion} />
					))}
				</TableBody>
			</Table>
		</TableContainer>
	);
};

const UserRow: FC<{config: Config; user: UserAdminResponse; assetVersion: string}> = ({config, user, assetVersion}) => {
	return (
		<TableRow>
			<TableCell>
				<UserLink config={config} user={user} assetVersion={assetVersion} />
			</TableCell>
			<TableCell muted>
				<UserIdCode userId={user.id} />
			</TableCell>
			<TableCell muted>{user.email ?? '-'}</TableCell>
			<TableCell>
				<UserStatusBadge user={user} />
			</TableCell>
		</TableRow>
	);
};

const UserIdCode: FC<{userId: string}> = ({userId}) => {
	return (
		<Text size="xs" class="font-mono">
			{userId}
		</Text>
	);
};

const UserLink: FC<{config: Config; user: UserAdminResponse; assetVersion: string}> = ({
	config,
	user,
	assetVersion,
}) => {
	return (
		<UserLinkContainer href={`${config.basePath}/users/${user.id}`}>
			<UserAvatar config={config} user={user} assetVersion={assetVersion} />
			<UserNameTag config={config} user={user} />
		</UserLinkContainer>
	);
};

const UserLinkContainer: FC<{href: string; children: Child}> = ({href, children}) => {
	return (
		<a href={href} class="flex items-center gap-3 hover:opacity-80">
			{children}
		</a>
	);
};

const UserAvatar: FC<{config: Config; user: UserAdminResponse; assetVersion: string}> = ({
	config,
	user,
	assetVersion,
}) => {
	return (
		<img
			src={getUserAvatarUrl(config.mediaEndpoint, config.staticCdnEndpoint, user.id, user.avatar, true, assetVersion)}
			alt=""
			class="h-8 w-8 rounded-full"
		/>
	);
};

const UserNameTag: FC<{config: Config; user: UserAdminResponse}> = ({config, user}) => {
	return (
		<div class="flex items-center gap-2">
			<Text size="sm" class="font-medium">
				{user.username}#{formatDiscriminator(user.discriminator)}
			</Text>
			<UserProfileBadges config={config} user={user} />
		</div>
	);
};

const UserStatusBadge: FC<{user: UserAdminResponse}> = ({user}) => {
	if (user.bot) {
		return <Badge text="Bot" variant="info" />;
	}
	if (user.system) {
		return <Badge text="System" variant="warning" />;
	}
	return <Badge text="User" variant="default" />;
};

const PaginationControls: FC<{config: Config; searchQuery: string; page: number; hasMore: boolean}> = ({
	config,
	searchQuery,
	page,
	hasMore,
}) => {
	return (
		<div class="mt-4 flex justify-between">
			{page > 0 ? <PreviousLink config={config} searchQuery={searchQuery} page={page} /> : <Text size="sm" />}
			{hasMore && <NextLink config={config} searchQuery={searchQuery} page={page} />}
		</div>
	);
};

const PreviousLink: FC<{config: Config; searchQuery: string; page: number}> = ({config, searchQuery, page}) => {
	return (
		<Text size="sm" color="muted">
			<TextLink
				href={`${config.basePath}/users${buildPaginationUrl(page - 1, {q: searchQuery})}`}
				class="hover:text-neutral-900"
			>
				← Previous
			</TextLink>
		</Text>
	);
};

const NextLink: FC<{config: Config; searchQuery: string; page: number}> = ({config, searchQuery, page}) => {
	return (
		<Text size="sm" color="muted">
			<TextLink
				href={`${config.basePath}/users${buildPaginationUrl(page + 1, {q: searchQuery})}`}
				class="hover:text-neutral-900"
			>
				Next →
			</TextLink>
		</Text>
	);
};

export const UsersPage: FC<UsersPageProps> = async ({
	config,
	session,
	currentAdmin,
	flash,
	searchQuery,
	page,
	assetVersion,
	csrfToken,
}) => {
	let users: Array<UserAdminResponse> = [];
	let hasMore = false;
	let error: string | undefined;

	if (searchQuery) {
		const result = await searchUsers(config, session, searchQuery, page, 25);
		if (result.ok) {
			users = result.data.users;
			hasMore = result.data.has_more;
		} else {
			error = getErrorMessage(result.error);
		}
	}

	return (
		<Layout
			csrfToken={csrfToken}
			title="Users"
			activePage="users"
			config={config}
			session={session}
			currentAdmin={currentAdmin}
			flash={flash}
			assetVersion={assetVersion}
		>
			<div class="mx-auto max-w-7xl space-y-6">
				<PageHeader title="Users" />

				<SearchForm
					action="/users"
					basePath={config.basePath}
					fields={[
						{
							name: 'q',
							type: 'text',
							value: searchQuery,
							placeholder: 'Search by user ID, username, email, or phone...',
						},
					]}
					layout="horizontal"
				/>

				{error && <ErrorAlert error={error} />}

				{searchQuery && !error && (
					<SearchResults
						config={config}
						users={users}
						searchQuery={searchQuery}
						page={page}
						hasMore={hasMore}
						assetVersion={assetVersion}
					/>
				)}

				{!searchQuery && <InitialEmptyState />}
			</div>
		</Layout>
	);
};
