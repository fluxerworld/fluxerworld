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
import {getGuildMemoryStats, getNodeStats} from '@fluxer/admin/src/api/System';
import {ErrorAlert} from '@fluxer/admin/src/components/ErrorDisplay';
import {Layout} from '@fluxer/admin/src/components/Layout';
import {PageHeader} from '@fluxer/admin/src/components/ui/Layout/PageHeader';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Heading, Text} from '@fluxer/admin/src/components/ui/Typography';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {MEDIA_PROXY_ICON_SIZE_DEFAULT} from '@fluxer/constants/src/MediaProxyAssetSizes';
import type {Flash} from '@fluxer/hono/src/Flash';
import {formatNumber} from '@fluxer/number_utils/src/NumberFormatting';
import type {GuildMemoryStatsResponse, NodeStatsResponse} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {Alert} from '@fluxer/ui/src/components/Alert';
import {Button} from '@fluxer/ui/src/components/Button';
import {CardElevated} from '@fluxer/ui/src/components/Card';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import type {FC} from 'hono/jsx';

interface GatewayPageProps {
	config: Config;
	session: Session;
	currentAdmin: UserAdminResponse | undefined;
	flash: Flash | undefined;
	adminAcls: Array<string>;
	reloadResult?: number | undefined;
	assetVersion: string;
	csrfToken: string;
}

function formatNumberLocal(n: number): string {
	return formatNumber(n, {locale: 'en-US'});
}

function formatMemory(memoryMb: number): string {
	if (memoryMb < 1.0) {
		const kb = memoryMb * 1024.0;
		return `${kb.toFixed(2)} KB`;
	}
	if (memoryMb < 1024.0) {
		return `${memoryMb.toFixed(2)} MB`;
	}
	const gb = memoryMb / 1024.0;
	return `${gb.toFixed(2)} GB`;
}

function formatMemoryFromBytes(bytesStr: string): string {
	const bytes = BigInt(bytesStr);
	const mbWith2Decimals = Number((bytes * 100n) / 1_048_576n) / 100;
	return formatMemory(mbWith2Decimals);
}

function getFirstChar(s: string): string {
	if (s === '') return '?';
	return s.charAt(0);
}

function getGuildIconUrl(
	mediaEndpoint: string,
	guildId: string,
	guildIcon: string | null,
	forceStatic: boolean,
): string | null {
	if (!guildIcon) return null;
	const isAnimated = guildIcon.startsWith('a_');
	const extension = isAnimated && !forceStatic ? 'gif' : 'webp';
	return `${mediaEndpoint}/icons/${guildId}/${guildIcon}.${extension}?size=${MEDIA_PROXY_ICON_SIZE_DEFAULT}`;
}

const StatCard: FC<{label: string; value: string}> = ({label, value}) => (
	<div class="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
		<div class="mb-1 text-neutral-600 text-xs uppercase tracking-wider">{label}</div>
		<div class="font-semibold text-base text-neutral-900">{value}</div>
	</div>
);

type ProcessMemoryStats = GuildMemoryStatsResponse['guilds'][number];

const NodeStatsSection: FC<{stats: NodeStatsResponse}> = ({stats}) => (
	<CardElevated padding="md">
		<VStack gap={4}>
			<Heading level={2}>Gateway Statistics</Heading>
			<div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
				<StatCard label="Sessions" value={formatNumberLocal(stats.sessions)} />
				<StatCard label="Guilds" value={formatNumberLocal(stats.guilds)} />
				<StatCard label="Presences" value={formatNumberLocal(stats.presences)} />
				<StatCard label="Calls" value={formatNumberLocal(stats.calls)} />
				<StatCard label="Total RAM" value={formatMemoryFromBytes(stats.memory.total)} />
			</div>
		</VStack>
	</CardElevated>
);

const GuildRow: FC<{config: Config; guild: ProcessMemoryStats; rank: number}> = ({config, guild, rank}) => {
	const iconUrl = guild.guild_id ? getGuildIconUrl(config.mediaEndpoint, guild.guild_id, guild.guild_icon, true) : null;

	return (
		<tr class="transition-colors hover:bg-neutral-50">
			<td class="whitespace-nowrap px-6 py-4 font-medium text-neutral-900 text-sm">#{rank}</td>
			<td class="whitespace-nowrap px-6 py-4">
				{guild.guild_id ? (
					<a href={`${config.basePath}/guilds/${guild.guild_id}`} class="flex items-center gap-2">
						{iconUrl ? (
							<img src={iconUrl} alt={guild.guild_name} class="h-10 w-10 rounded-full" />
						) : (
							<div class="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 font-medium text-neutral-600 text-sm">
								{getFirstChar(guild.guild_name)}
							</div>
						)}
						<div>
							<div class="font-medium text-neutral-900 text-sm">{guild.guild_name}</div>
							<div class="text-neutral-500 text-xs">{guild.guild_id}</div>
						</div>
					</a>
				) : (
					<div class="flex items-center gap-2">
						<div class="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 font-medium text-neutral-600 text-sm">
							?
						</div>
						<span class="text-neutral-600 text-sm">{guild.guild_name}</span>
					</div>
				)}
			</td>
			<td class="whitespace-nowrap px-6 py-4 text-right font-medium text-neutral-900 text-sm">
				{formatMemoryFromBytes(guild.memory)}
			</td>
			<td class="whitespace-nowrap px-6 py-4 text-right text-neutral-900 text-sm">
				{formatNumberLocal(guild.member_count)}
			</td>
			<td class="whitespace-nowrap px-6 py-4 text-right text-neutral-900 text-sm">
				{formatNumberLocal(guild.session_count)}
			</td>
			<td class="whitespace-nowrap px-6 py-4 text-right text-neutral-900 text-sm">
				{formatNumberLocal(guild.presence_count)}
			</td>
		</tr>
	);
};

const GuildTable: FC<{config: Config; guilds: Array<ProcessMemoryStats>}> = ({config, guilds}) => {
	if (guilds.length === 0) {
		return <div class="p-6 text-center text-neutral-600">No guilds in memory</div>;
	}

	return (
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead class="border-neutral-200 border-b bg-neutral-50">
					<tr>
						<th class="px-6 py-3 text-left text-neutral-600 text-xs uppercase tracking-wider">Rank</th>
						<th class="px-6 py-3 text-left text-neutral-600 text-xs uppercase tracking-wider">Guild</th>
						<th class="px-6 py-3 text-right text-neutral-600 text-xs uppercase tracking-wider">RAM Usage</th>
						<th class="px-6 py-3 text-right text-neutral-600 text-xs uppercase tracking-wider">Members</th>
						<th class="px-6 py-3 text-right text-neutral-600 text-xs uppercase tracking-wider">Sessions</th>
						<th class="px-6 py-3 text-right text-neutral-600 text-xs uppercase tracking-wider">Presences</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-neutral-200">
					{guilds.map((guild, index) => (
						<GuildRow config={config} guild={guild} rank={index + 1} />
					))}
				</tbody>
			</table>
		</div>
	);
};

const SuccessView: FC<{
	config: Config;
	adminAcls: Array<string>;
	nodeStats: NodeStatsResponse | null;
	guilds: Array<ProcessMemoryStats>;
	reloadResult: number | undefined;
	csrfToken: string;
}> = ({config, adminAcls, nodeStats, guilds, reloadResult, csrfToken}) => {
	const canReloadAll = adminAcls.includes('gateway:reload_all') || adminAcls.includes('*');

	return (
		<VStack gap={6}>
			<PageHeader
				title="Gateway"
				actions={
					canReloadAll && (
						<form method="post" action={`${config.basePath}/gateway?action=reload_all`}>
							<CsrfInput token={csrfToken} />
							<Button
								type="submit"
								variant="primary"
								onclick="return confirm('Are you sure you want to reload all guilds in memory? This may take several minutes.');"
							>
								Reload All Guilds
							</Button>
						</form>
					)
				}
			/>

			{reloadResult !== undefined && <Alert variant="success">Successfully reloaded {reloadResult} guilds!</Alert>}

			{nodeStats && <NodeStatsSection stats={nodeStats} />}

			<div class="rounded-lg border border-neutral-200 bg-white shadow-sm">
				<VStack gap={2} class="border-neutral-200 border-b p-6">
					<Heading level={2}>Guild Memory Leaderboard (Top 100)</Heading>
					<Text size="sm" color="muted">
						Guilds ranked by memory usage, showing the top 100 consumers
					</Text>
				</VStack>
				<GuildTable config={config} guilds={guilds} />
			</div>
		</VStack>
	);
};

export async function GatewayPage({
	config,
	session,
	currentAdmin,
	flash,
	adminAcls,
	reloadResult,
	assetVersion,
	csrfToken,
}: GatewayPageProps) {
	const nodeStatsResult = await getNodeStats(config, session);
	const guildStatsResult = await getGuildMemoryStats(config, session, 100);

	const content = guildStatsResult.ok ? (
		<SuccessView
			config={config}
			adminAcls={adminAcls}
			nodeStats={nodeStatsResult.ok ? nodeStatsResult.data : null}
			guilds={guildStatsResult.data.guilds}
			reloadResult={reloadResult}
			csrfToken={csrfToken}
		/>
	) : (
		<>
			<Heading level={1}>Gateway</Heading>
			<ErrorAlert error={getErrorMessage(guildStatsResult.error)} />
		</>
	);

	return (
		<Layout
			csrfToken={csrfToken}
			title="Gateway"
			activePage="gateway"
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
