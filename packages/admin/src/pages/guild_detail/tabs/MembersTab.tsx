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

import {hasPermission} from '@fluxer/admin/src/AccessControlList';
import {getErrorMessage, getErrorTitle} from '@fluxer/admin/src/api/Errors';
import {listGuildMembers} from '@fluxer/admin/src/api/Guilds';
import {ErrorCard} from '@fluxer/admin/src/components/ErrorDisplay';
import {Badge} from '@fluxer/admin/src/components/ui/Badge';
import {HStack} from '@fluxer/admin/src/components/ui/Layout/HStack';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Heading, Text} from '@fluxer/admin/src/components/ui/Typography';
import {buildPaginationUrl} from '@fluxer/admin/src/hooks/usePaginationUrl';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import type {ListGuildMembersResponse} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import type {GuildMemberResponse} from '@fluxer/schema/src/domains/guild/GuildMemberSchemas';
import {extractTimestampFromSnowflakeAsDate} from '@fluxer/snowflake/src/SnowflakeUtils';
import {Button} from '@fluxer/ui/src/components/Button';
import {Card} from '@fluxer/ui/src/components/Card';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import {formatDiscriminator, getUserAvatarUrl} from '@fluxer/ui/src/utils/FormatUser';
import type {FC} from 'hono/jsx';
import type {z} from 'zod';

interface MembersTabProps {
	config: Config;
	session: Session;
	guildId: string;
	adminAcls: Array<string>;
	page: number;
	assetVersion: string;
	csrfToken: string;
}

function formatDate(isoDate: string): string {
	const parts = isoDate.split('T');
	return parts[0] ?? isoDate;
}

function extractTimestamp(snowflakeId: string): string | null {
	try {
		const date = extractTimestampFromSnowflakeAsDate(snowflakeId);
		return date.toISOString().split('T')[0] ?? null;
	} catch {
		return null;
	}
}

const RenderPaginationInfo: FC<{offset: number; limit: number; total: number}> = ({offset, limit, total}) => {
	const start = offset + 1;
	const end = offset + limit > total ? total : offset + limit;
	return (
		<Text size="sm" color="muted">
			Showing {start}-{end} of {total}
		</Text>
	);
};

const RenderPagination: FC<{
	config: Config;
	guildId: string;
	currentPage: number;
	total: number;
	limit: number;
}> = ({config, guildId, currentPage, total, limit}) => {
	const totalPages = Math.ceil(total / limit);
	const hasPrevious = currentPage > 0;
	const hasNext = currentPage < totalPages - 1;

	if (totalPages <= 1) {
		return null;
	}

	return (
		<HStack gap={4} justify="between" align="center" class="mt-4 border-t pt-4">
			<Button
				variant={hasPrevious ? 'brand' : 'secondary'}
				size="small"
				disabled={!hasPrevious}
				href={
					hasPrevious
						? `${config.basePath}/guilds/${guildId}${buildPaginationUrl(currentPage - 1, {tab: 'members'})}`
						: undefined
				}
			>
				&larr; Previous
			</Button>
			<Text size="sm" color="muted">
				Page {currentPage + 1} of {totalPages}
			</Text>
			<Button
				variant={hasNext ? 'brand' : 'secondary'}
				size="small"
				disabled={!hasNext}
				href={
					hasNext
						? `${config.basePath}/guilds/${guildId}${buildPaginationUrl(currentPage + 1, {tab: 'members'})}`
						: undefined
				}
			>
				Next &rarr;
			</Button>
		</HStack>
	);
};

const RenderMemberActions: FC<{
	config: Config;
	guildId: string;
	userId: string;
	canBanMember: boolean;
	canKickMember: boolean;
	csrfToken: string;
}> = ({config, guildId, userId, canBanMember, canKickMember, csrfToken}) => {
	if (!canBanMember && !canKickMember) {
		return null;
	}

	return (
		<HStack gap={2} justify="end" class="flex-wrap">
			{canBanMember && (
				<form
					method="post"
					action={`${config.basePath}/guilds/${guildId}?tab=members&action=ban_member`}
					onsubmit="return confirm('Are you sure you want to ban this member?')"
				>
					<CsrfInput token={csrfToken} />
					<input type="hidden" name="user_id" value={userId} />
					<Button type="submit" variant="danger" size="small">
						Ban Member
					</Button>
				</form>
			)}
			{canKickMember && (
				<form
					method="post"
					action={`${config.basePath}/guilds/${guildId}?tab=members&action=kick_member`}
					onsubmit="return confirm('Are you sure you want to kick this member from the guild?')"
				>
					<CsrfInput token={csrfToken} />
					<input type="hidden" name="user_id" value={userId} />
					<Button type="submit" variant="secondary" size="small">
						Kick Member
					</Button>
				</form>
			)}
		</HStack>
	);
};

const RenderMember: FC<{
	config: Config;
	guildId: string;
	adminAcls: Array<string>;
	member: GuildMemberResponse;
	assetVersion: string;
	csrfToken: string;
}> = ({config, guildId, adminAcls, member, assetVersion, csrfToken}) => {
	const canBan = hasPermission(adminAcls, AdminACLs.GUILD_BAN_MEMBER);
	const canKick = hasPermission(adminAcls, AdminACLs.GUILD_KICK_MEMBER);
	const createdAt = extractTimestamp(member.user.id);

	const discriminatorDisplay =
		typeof member.user.discriminator === 'number'
			? formatDiscriminator(member.user.discriminator)
			: member.user.discriminator;

	return (
		<Card padding="md" class="transition-colors hover:border-neutral-300">
			<HStack gap={4} align="center">
				<img
					src={getUserAvatarUrl(
						config.mediaEndpoint,
						config.staticCdnEndpoint,
						member.user.id,
						member.user.avatar,
						true,
						assetVersion,
					)}
					alt={member.user.username}
					class="h-16 w-16 flex-shrink-0 rounded-full"
				/>
				<VStack gap={1} class="min-w-0 flex-1">
					<HStack gap={2} align="center" class="mb-1">
						<Heading level={2} size="base">
							{member.user.username}#{discriminatorDisplay}
						</Heading>
						{member.user.bot && <Badge variant="info">Bot</Badge>}
						{member.nick && (
							<Text size="sm" color="muted" class="ml-2">
								({member.nick})
							</Text>
						)}
					</HStack>
					<VStack gap={0.5}>
						<Text size="sm" color="muted">
							ID: {member.user.id}
						</Text>
						{createdAt && (
							<Text size="sm" color="muted">
								Created: {createdAt}
							</Text>
						)}
						<Text size="sm" color="muted">
							Joined: {formatDate(member.joined_at)}
						</Text>
						{member.roles.length > 0 && (
							<Text size="sm" color="muted">
								{member.roles.length} roles
							</Text>
						)}
					</VStack>
				</VStack>
				<VStack gap={2} align="end">
					<Button variant="primary" size="small" href={`${config.basePath}/users/${member.user.id}`}>
						View Details
					</Button>
					<RenderMemberActions
						config={config}
						guildId={guildId}
						userId={member.user.id}
						canBanMember={canBan}
						canKickMember={canKick}
						csrfToken={csrfToken}
					/>
				</VStack>
			</HStack>
		</Card>
	);
};

const RenderMembersList: FC<{
	config: Config;
	guildId: string;
	adminAcls: Array<string>;
	response: z.infer<typeof ListGuildMembersResponse>;
	page: number;
	limit: number;
	assetVersion: string;
	csrfToken: string;
}> = ({config, guildId, adminAcls, response, page, limit, assetVersion, csrfToken}) => {
	return (
		<VStack gap={4}>
			<HStack gap={4} justify="between" align="center">
				<Heading level={3} size="base">
					Guild Members ({response.total})
				</Heading>
				<RenderPaginationInfo offset={response.offset} limit={response.limit} total={response.total} />
			</HStack>
			{response.members.length === 0 ? (
				<Text size="sm" color="muted">
					No members found.
				</Text>
			) : (
				<VStack gap={2}>
					{response.members.map((member) => (
						<RenderMember
							config={config}
							guildId={guildId}
							adminAcls={adminAcls}
							member={member}
							assetVersion={assetVersion}
							csrfToken={csrfToken}
						/>
					))}
				</VStack>
			)}
			<RenderPagination config={config} guildId={guildId} currentPage={page} total={response.total} limit={limit} />
		</VStack>
	);
};

export async function MembersTab({
	config,
	session,
	guildId,
	adminAcls,
	page,
	assetVersion,
	csrfToken,
}: MembersTabProps) {
	const limit = 50;
	const offset = page * limit;

	if (!hasPermission(adminAcls, AdminACLs.GUILD_LIST_MEMBERS)) {
		return <ErrorCard title="Permission Denied" message="You don't have permission to view guild members." />;
	}

	const result = await listGuildMembers(config, session, guildId, limit, offset);

	if (!result.ok) {
		return <ErrorCard title={getErrorTitle(result.error)} message={getErrorMessage(result.error)} />;
	}

	return (
		<RenderMembersList
			config={config}
			guildId={guildId}
			adminAcls={adminAcls}
			response={result.data}
			page={page}
			limit={limit}
			assetVersion={assetVersion}
			csrfToken={csrfToken}
		/>
	);
}
