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
import type {Archive} from '@fluxer/admin/src/api/Archives';
import {listArchives} from '@fluxer/admin/src/api/Archives';
import {getErrorMessage} from '@fluxer/admin/src/api/Errors';
import type {GuildLookupResult} from '@fluxer/admin/src/api/Guilds';
import {lookupGuild} from '@fluxer/admin/src/api/Guilds';
import {ErrorCard} from '@fluxer/admin/src/components/ErrorDisplay';
import {Layout} from '@fluxer/admin/src/components/Layout';
import {HStack} from '@fluxer/admin/src/components/ui/Layout/HStack';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Heading, Text} from '@fluxer/admin/src/components/ui/Typography';
import {EmojisTab} from '@fluxer/admin/src/pages/guild_detail/tabs/EmojisTab';
import {FeaturesTab} from '@fluxer/admin/src/pages/guild_detail/tabs/FeaturesTab';
import {MembersTab} from '@fluxer/admin/src/pages/guild_detail/tabs/MembersTab';
import {ModerationTab} from '@fluxer/admin/src/pages/guild_detail/tabs/ModerationTab';
import {OverviewTab} from '@fluxer/admin/src/pages/guild_detail/tabs/OverviewTab';
import {SettingsTab} from '@fluxer/admin/src/pages/guild_detail/tabs/SettingsTab';
import {StickersTab} from '@fluxer/admin/src/pages/guild_detail/tabs/StickersTab';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import {formatTimestamp} from '@fluxer/date_utils/src/DateFormatting';
import type {Flash} from '@fluxer/hono/src/Flash';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {Button} from '@fluxer/ui/src/components/Button';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import {EmptyState} from '@fluxer/ui/src/components/EmptyState';
import {getGuildIconUrl, getInitials as getInitialsFromName} from '@fluxer/ui/src/utils/FormatUser';
import type {Child, FC} from 'hono/jsx';

interface GuildDetailPageProps {
	config: Config;
	session: Session;
	currentAdmin: UserAdminResponse | undefined;
	flash: Flash | undefined;
	guildId: string;
	referrer?: string | undefined;
	tab?: string | undefined;
	page?: string | undefined;
	assetVersion: string;
	csrfToken: string;
}

interface Tab {
	label: string;
	path: string;
	active: boolean;
}

function canViewArchives(adminAcls: Array<string>): boolean {
	return adminAcls.some(
		(acl) =>
			acl === AdminACLs.ARCHIVE_VIEW_ALL || acl === AdminACLs.ARCHIVE_TRIGGER_GUILD || acl === AdminACLs.WILDCARD,
	);
}

function canManageAssets(adminAcls: Array<string>): boolean {
	return hasPermission(adminAcls, AdminACLs.ASSET_PURGE);
}

function getStatusText(archive: Archive): string {
	if (archive.failed_at) {
		return 'Failed';
	}
	if (archive.completed_at) {
		return 'Completed';
	}
	return archive.progress_step ?? 'In Progress';
}

const RenderTabs: FC<{config: Config; tabs: Array<Tab>}> = ({config, tabs}) => {
	return (
		<VStack gap={0} class="mb-6 border-neutral-200 border-b">
			<nav class="-mb-px flex flex-wrap gap-x-4 sm:gap-x-6">
				{tabs.map((tab) => (
					<a
						href={`${config.basePath}${tab.path}`}
						class={
							tab.active
								? 'border-neutral-900 border-b-2 px-1 py-3 font-medium text-neutral-900 text-sm'
								: 'px-1 py-3 font-medium text-neutral-500 text-sm hover:border-neutral-300 hover:border-b-2 hover:text-neutral-700'
						}
					>
						{tab.label}
					</a>
				))}
			</nav>
		</VStack>
	);
};

const RenderArchiveTable: FC<{config: Config; archives: Array<Archive>}> = ({config, archives}) => {
	if (archives.length === 0) {
		return (
			<VStack gap={0}>
				<EmptyState title="No archives yet for this guild." />
			</VStack>
		);
	}

	return (
		<VStack gap={0} class="overflow-hidden rounded-lg border border-neutral-200 bg-white">
			<table class="min-w-full divide-y divide-neutral-200">
				<thead class="bg-neutral-50">
					<tr>
						<th class="px-4 py-2 text-left font-medium text-neutral-700 text-xs uppercase tracking-wider">
							Requested At
						</th>
						<th class="px-4 py-2 text-left font-medium text-neutral-700 text-xs uppercase tracking-wider">Status</th>
						<th class="px-4 py-2 text-left font-medium text-neutral-700 text-xs uppercase tracking-wider">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-neutral-200">
					{archives.map((archive) => (
						<tr>
							<td class="px-4 py-3 text-neutral-900 text-sm">{formatTimestamp(archive.requested_at)}</td>
							<td class="px-4 py-3 text-neutral-900 text-sm">
								{getStatusText(archive)} ({archive.progress_percent}%)
							</td>
							<td class="px-4 py-3 text-sm">
								{archive.completed_at ? (
									<Button
										variant="primary"
										size="small"
										href={`${config.basePath}/archives/download?subject_type=guild&subject_id=${archive.subject_id}&archive_id=${archive.archive_id}`}
									>
										Download
									</Button>
								) : (
									<Text size="sm" color="muted">
										Pending
									</Text>
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</VStack>
	);
};

const ArchivesTab: FC<{
	config: Config;
	session: Session;
	guildId: string;
	csrfToken: string;
}> = async ({config, session, guildId, csrfToken}) => {
	const result = await listArchives(config, session, 'guild', guildId, false);

	return (
		<VStack gap={6}>
			<HStack gap={3} class="flex-wrap items-center justify-between">
				<Heading level={2}>Guild Archives</Heading>
				<form method="post" action={`${config.basePath}/guilds/${guildId}?tab=archives&action=trigger_archive`}>
					<CsrfInput token={csrfToken} />
					<Button type="submit" variant="primary">
						Trigger Archive
					</Button>
				</form>
			</HStack>
			{result.ok ? (
				<RenderArchiveTable config={config} archives={result.data.archives} />
			) : (
				<ErrorCard title="Failed to load archives" message={getErrorMessage(result.error)} />
			)}
		</VStack>
	);
};

const RenderGuildHeader: FC<{
	config: Config;
	guild: GuildLookupResult;
}> = ({config, guild}) => {
	const iconUrl = getGuildIconUrl(config.mediaEndpoint, guild.id, guild.icon, true);

	return (
		<VStack gap={0} class="mb-6 rounded-lg border border-neutral-200 bg-white p-6">
			<HStack gap={6} class="flex-col items-start sm:flex-row">
				{iconUrl ? (
					<VStack gap={0} class="flex flex-shrink-0 items-center justify-center sm:block">
						<img src={iconUrl} alt={guild.name} class="h-24 w-24 rounded-full" />
					</VStack>
				) : (
					<VStack gap={0} class="flex flex-shrink-0 items-center justify-center sm:block">
						<VStack
							gap={0}
							align="center"
							class="h-24 w-24 justify-center rounded-full bg-neutral-200 text-center font-semibold text-base text-neutral-600"
						>
							{getInitialsFromName(guild.name)}
						</VStack>
					</VStack>
				)}
				<VStack gap={3} class="min-w-0 flex-1">
					<Heading level={1} size="xl">
						{guild.name}
					</Heading>
					<VStack gap={2} class="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
						<VStack gap={1}>
							<Text size="sm" class="font-medium" color="muted">
								Guild ID:
							</Text>
							<Text size="sm" class="break-all">
								{guild.id}
							</Text>
						</VStack>
						<VStack gap={1}>
							<Text size="sm" class="font-medium" color="muted">
								Owner ID:
							</Text>
							<a
								href={`${config.basePath}/users/${guild.owner_id}`}
								class="block text-neutral-900 text-sm hover:text-blue-600 hover:underline"
							>
								{guild.owner_id}
							</a>
						</VStack>
					</VStack>
				</VStack>
			</HStack>
		</VStack>
	);
};

interface RenderTabContentProps {
	config: Config;
	session: Session;
	guild: GuildLookupResult;
	adminAcls: Array<string>;
	guildId: string;
	activeTab: string;
	currentPage: number;
	assetVersion: string;
	csrfToken: string;
}

async function renderTabContent({
	config,
	session,
	guild,
	adminAcls,
	guildId,
	activeTab,
	currentPage,
	assetVersion,
	csrfToken,
}: RenderTabContentProps) {
	switch (activeTab) {
		case 'members':
			return await MembersTab({
				config,
				session,
				guildId,
				adminAcls,
				page: currentPage,
				assetVersion,
				csrfToken,
			});
		case 'settings':
			return (
				<SettingsTab config={config} guild={guild} guildId={guildId} adminAcls={adminAcls} csrfToken={csrfToken} />
			);
		case 'features':
			return (
				<FeaturesTab config={config} guild={guild} guildId={guildId} adminAcls={adminAcls} csrfToken={csrfToken} />
			);
		case 'moderation':
			return (
				<ModerationTab config={config} guild={guild} guildId={guildId} adminAcls={adminAcls} csrfToken={csrfToken} />
			);
		case 'archives':
			return <ArchivesTab config={config} session={session} guildId={guildId} csrfToken={csrfToken} />;
		case 'emojis':
			return await EmojisTab({config, session, guildId, adminAcls, csrfToken});
		case 'stickers':
			return await StickersTab({config, session, guildId, adminAcls, csrfToken});
		default:
			return <OverviewTab config={config} guild={guild} csrfToken={csrfToken} />;
	}
}

const RenderGuildContent: FC<{
	config: Config;
	guild: GuildLookupResult;
	adminAcls: Array<string>;
	guildId: string;
	referrer: string | undefined;
	activeTab: string;
	tabContent: Child | null;
}> = ({config, guild, adminAcls, guildId, referrer, activeTab, tabContent}) => {
	const tabList: Array<Tab> = [
		{
			label: 'Overview',
			path: `/guilds/${guildId}?tab=overview`,
			active: activeTab === 'overview',
		},
		{
			label: 'Members',
			path: `/guilds/${guildId}?tab=members`,
			active: activeTab === 'members',
		},
		{
			label: 'Settings',
			path: `/guilds/${guildId}?tab=settings`,
			active: activeTab === 'settings',
		},
		{
			label: 'Features',
			path: `/guilds/${guildId}?tab=features`,
			active: activeTab === 'features',
		},
		{
			label: 'Moderation',
			path: `/guilds/${guildId}?tab=moderation`,
			active: activeTab === 'moderation',
		},
	];

	if (canViewArchives(adminAcls)) {
		tabList.push({
			label: 'Archives',
			path: `/guilds/${guildId}?tab=archives`,
			active: activeTab === 'archives',
		});
	}

	if (canManageAssets(adminAcls)) {
		tabList.push({
			label: 'Emojis',
			path: `/guilds/${guildId}?tab=emojis`,
			active: activeTab === 'emojis',
		});
		tabList.push({
			label: 'Stickers',
			path: `/guilds/${guildId}?tab=stickers`,
			active: activeTab === 'stickers',
		});
	}

	return (
		<VStack gap={6} class="mx-auto max-w-7xl">
			<VStack gap={0} class="mb-6">
				<a
					href={`${config.basePath}${referrer ?? '/guilds'}`}
					class="inline-flex items-center gap-2 text-neutral-600 transition-colors hover:text-neutral-900"
				>
					<span class="text-lg">&larr;</span>
					Back to Guilds
				</a>
			</VStack>
			<RenderGuildHeader config={config} guild={guild} />
			<RenderTabs config={config} tabs={tabList} />
			{tabContent}
		</VStack>
	);
};

const RenderNotFoundContent: FC<{config: Config}> = ({config}) => {
	return (
		<VStack gap={0} class="mx-auto max-w-4xl">
			<VStack gap={6} class="rounded-lg border border-neutral-200 bg-white p-12 text-center">
				<Heading level={2} size="base">
					Guild Not Found
				</Heading>
				<Text color="muted">The requested guild could not be found.</Text>
				<Button variant="primary" size="small" href={`${config.basePath}/guilds`}>
					<span class="text-lg">&larr;</span>
					Back to Guilds
				</Button>
			</VStack>
		</VStack>
	);
};

const RenderApiError: FC<{config: Config; errorMessage: string}> = ({config, errorMessage}) => {
	return (
		<VStack gap={0} class="mx-auto max-w-4xl">
			<VStack gap={6} class="rounded-lg border border-neutral-200 bg-white p-12 text-center">
				<Heading level={2} size="base">
					Error
				</Heading>
				<Text color="muted">{errorMessage}</Text>
				<Button variant="primary" size="small" href={`${config.basePath}/guilds`}>
					<span class="text-lg">&larr;</span>
					Back to Guilds
				</Button>
			</VStack>
		</VStack>
	);
};

export async function GuildDetailPage({
	config,
	session,
	currentAdmin,
	flash,
	guildId,
	referrer,
	tab,
	page,
	assetVersion,
	csrfToken,
}: GuildDetailPageProps) {
	const result = await lookupGuild(config, session, guildId);

	const adminAcls = currentAdmin?.acls ?? [];

	let activeTab = tab ?? 'overview';
	const validTabs = ['overview', 'settings', 'features', 'moderation', 'members', 'archives', 'emojis', 'stickers'];
	if (!validTabs.includes(activeTab)) {
		activeTab = 'overview';
	}

	if (activeTab === 'archives' && !canViewArchives(adminAcls)) {
		activeTab = 'overview';
	}
	if ((activeTab === 'emojis' || activeTab === 'stickers') && !canManageAssets(adminAcls)) {
		activeTab = 'overview';
	}

	let currentPage = 0;
	if (page) {
		const parsed = parseInt(page, 10);
		if (!Number.isNaN(parsed) && parsed >= 0) {
			currentPage = parsed;
		}
	}

	if (!result.ok) {
		return (
			<Layout
				csrfToken={csrfToken}
				title="Guild Details"
				activePage="guilds"
				config={config}
				session={session}
				currentAdmin={currentAdmin}
				flash={flash}
				assetVersion={assetVersion}
			>
				<RenderApiError config={config} errorMessage={getErrorMessage(result.error)} />
			</Layout>
		);
	}

	if (!result.data) {
		return (
			<Layout
				csrfToken={csrfToken}
				title="Guild Not Found"
				activePage="guilds"
				config={config}
				session={session}
				currentAdmin={currentAdmin}
				flash={flash}
				assetVersion={assetVersion}
			>
				<RenderNotFoundContent config={config} />
			</Layout>
		);
	}

	const guild = result.data;
	const tabContent = await renderTabContent({
		config,
		session,
		guild,
		adminAcls,
		guildId,
		activeTab,
		currentPage,
		assetVersion,
		csrfToken,
	});

	return (
		<Layout
			csrfToken={csrfToken}
			title="Guild Details"
			activePage="guilds"
			config={config}
			session={session}
			currentAdmin={currentAdmin}
			flash={flash}
			assetVersion={assetVersion}
		>
			<RenderGuildContent
				config={config}
				guild={guild}
				adminAcls={adminAcls}
				guildId={guildId}
				referrer={referrer}
				activeTab={activeTab}
				tabContent={tabContent}
			/>
		</Layout>
	);
}
