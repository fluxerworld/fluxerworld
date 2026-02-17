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

import type {GuildChannel, GuildLookupResult, GuildRole} from '@fluxer/admin/src/api/Guilds';
import {Badge} from '@fluxer/admin/src/components/ui/Badge';
import {EmptyState} from '@fluxer/admin/src/components/ui/EmptyState';
import {HStack} from '@fluxer/admin/src/components/ui/Layout/HStack';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Heading, Text} from '@fluxer/admin/src/components/ui/Typography';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {FLUXER_EPOCH} from '@fluxer/constants/src/Core';
import {Button} from '@fluxer/ui/src/components/Button';
import {Card} from '@fluxer/ui/src/components/Card';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import {InfoGrid, InfoItem} from '@fluxer/ui/src/components/Layout';
import {
	getGuildBannerUrl,
	getGuildEmbedSplashUrl,
	getGuildIconUrl,
	getGuildSplashUrl,
} from '@fluxer/ui/src/utils/FormatUser';
import type {FC} from 'hono/jsx';

function getCurrentSnowflake(): string {
	const now = Date.now();
	const timestampOffset = now - FLUXER_EPOCH;
	const snowflake = BigInt(timestampOffset) * 4_194_304n;
	return snowflake.toString();
}

function channelTypeToString(type: number): string {
	switch (type) {
		case 0:
			return 'Text';
		case 2:
			return 'Voice';
		case 4:
			return 'Category';
		default:
			return `Unknown (${type})`;
	}
}

function intToHex(i: number): string {
	if (i === 0) return '000000';
	const r = Math.floor(i / 65536) % 256;
	const g = Math.floor(i / 256) % 256;
	const b = i % 256;
	return byteToHex(r) + byteToHex(g) + byteToHex(b);
}

function byteToHex(byte: number): string {
	const hexDigits = '0123456789ABCDEF';
	const high = Math.floor(byte / 16);
	const low = byte % 16;
	return (hexDigits[high] ?? '0') + (hexDigits[low] ?? '0');
}

interface OverviewTabProps {
	config: Config;
	guild: GuildLookupResult;
	csrfToken: string;
}

const RenderChannel: FC<{config: Config; channel: GuildChannel}> = ({config, channel}) => {
	const currentSnowflake = getCurrentSnowflake();
	return (
		<a
			href={`${config.basePath}/messages?channel_id=${channel.id}&message_id=${currentSnowflake}&context_limit=50`}
			class="flex items-center gap-3 rounded border border-neutral-200 bg-neutral-50 p-3 transition-colors hover:bg-neutral-100"
		>
			<VStack gap={0} class="flex-1">
				<Text size="sm" weight="semibold">
					{channel.name}
				</Text>
				<Text size="sm" color="muted">
					{channel.id}
				</Text>
			</VStack>
			<Text size="sm" color="muted">
				{channelTypeToString(channel.type)}
			</Text>
		</a>
	);
};

const RenderRole: FC<{role: GuildRole}> = ({role}) => {
	const colorHex = intToHex(role.color);
	return (
		<HStack gap={3} align="center" class="rounded border border-neutral-200 bg-neutral-50 p-3">
			<div class="h-4 w-4 rounded" style={`background-color: #${colorHex}`} />
			<VStack gap={0} class="flex-1">
				<Text size="sm" weight="semibold">
					{role.name}
				</Text>
				<Text size="sm" color="muted">
					{role.id}
				</Text>
			</VStack>
			<HStack gap={2}>
				{role.hoist && <Badge variant="info">Hoisted</Badge>}
				{role.mentionable && <Badge variant="success">Mentionable</Badge>}
			</HStack>
		</HStack>
	);
};

const RenderSearchIndexButton: FC<{
	config: Config;
	guildId: string;
	title: string;
	indexType: string;
	csrfToken: string;
}> = ({config, guildId, title, indexType, csrfToken}) => {
	return (
		<form method="post" action={`${config.basePath}/guilds/${guildId}?action=refresh_search_index`} class="w-full">
			<CsrfInput token={csrfToken} />
			<input type="hidden" name="index_type" value={indexType} />
			<input type="hidden" name="guild_id" value={guildId} />
			<Button type="submit" variant="secondary" fullWidth>
				Refresh {title}
			</Button>
		</form>
	);
};

const AssetPreview: FC<{
	label: string;
	url: string | null;
	hash: string | null;
	variant: 'square' | 'wide';
}> = ({label, url, hash, variant}) => {
	const imageClass =
		variant === 'square'
			? 'h-24 w-24 rounded bg-neutral-100 object-cover'
			: 'h-36 w-full rounded bg-neutral-100 object-cover';

	return (
		<VStack gap={2} class="rounded-lg border border-neutral-200 bg-white p-3">
			<Text size="sm" weight="semibold">
				{label}
			</Text>
			{url ? (
				<a href={url} target="_blank" rel="noreferrer noopener" class="block">
					<img src={url} alt={`${label} preview`} class={imageClass} loading="lazy" />
				</a>
			) : (
				<div
					class={`flex items-center justify-center rounded bg-neutral-100 text-neutral-500 text-sm ${
						variant === 'square' ? 'h-24 w-24' : 'h-36 w-full'
					}`}
				>
					Not set
				</div>
			)}
			<Text size="xs" color="muted" class="break-all font-mono">
				Hash: {hash ?? 'null'}
			</Text>
		</VStack>
	);
};

export function OverviewTab({config, guild, csrfToken}: OverviewTabProps) {
	const sortedChannels = [...guild.channels].sort((a, b) => a.position - b.position);
	const sortedRoles = [...guild.roles].sort((a, b) => b.position - a.position);
	const iconUrl = getGuildIconUrl(config.mediaEndpoint, guild.id, guild.icon, true);
	const bannerUrl = getGuildBannerUrl(config.mediaEndpoint, guild.id, guild.banner, true);
	const splashUrl = getGuildSplashUrl(config.mediaEndpoint, guild.id, guild.splash);
	const embedSplashUrl = getGuildEmbedSplashUrl(config.mediaEndpoint, guild.id, guild.embed_splash);

	return (
		<VStack gap={6}>
			<Card padding="md">
				<VStack gap={4}>
					<Heading level={3} size="base">
						Assets
					</Heading>
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<AssetPreview label="Icon" url={iconUrl} hash={guild.icon} variant="square" />
						<AssetPreview label="Banner" url={bannerUrl} hash={guild.banner} variant="wide" />
						<AssetPreview label="Splash" url={splashUrl} hash={guild.splash} variant="wide" />
						<AssetPreview label="Embed Splash" url={embedSplashUrl} hash={guild.embed_splash} variant="wide" />
					</div>
				</VStack>
			</Card>

			<Card padding="md">
				<VStack gap={4}>
					<Heading level={3} size="base">
						Guild Information
					</Heading>
					<InfoGrid>
						<InfoItem label="Guild ID" value={guild.id} />
						<InfoItem label="Name" value={guild.name} />
						<InfoItem label="Member Count" value={String(guild.member_count)} />
						<InfoItem label="Vanity URL" value={guild.vanity_url_code ?? 'None'} />
						<VStack gap={1}>
							<Text size="sm" weight="semibold" color="muted">
								Owner ID
							</Text>
							<a
								href={`${config.basePath}/users/${guild.owner_id}`}
								class="text-neutral-900 text-sm hover:text-blue-600 hover:underline"
							>
								{guild.owner_id}
							</a>
						</VStack>
					</InfoGrid>
				</VStack>
			</Card>

			<Card padding="md">
				<VStack gap={4}>
					<Heading level={3} size="base">
						Features
					</Heading>
					{guild.features.length === 0 ? (
						<EmptyState variant="empty">No features enabled</EmptyState>
					) : (
						<HStack gap={2} class="flex-wrap">
							{guild.features.map((feature) => (
								<Badge variant="info">{feature}</Badge>
							))}
						</HStack>
					)}
				</VStack>
			</Card>

			<Card padding="md">
				<VStack gap={4}>
					<Heading level={3} size="base">
						Channels ({guild.channels.length})
					</Heading>
					{guild.channels.length === 0 ? (
						<EmptyState variant="empty">No channels</EmptyState>
					) : (
						<VStack gap={2}>
							{sortedChannels.map((channel) => (
								<RenderChannel config={config} channel={channel} />
							))}
						</VStack>
					)}
				</VStack>
			</Card>

			<Card padding="md">
				<VStack gap={4}>
					<Heading level={3} size="base">
						Roles ({guild.roles.length})
					</Heading>
					{guild.roles.length === 0 ? (
						<EmptyState variant="empty">No roles</EmptyState>
					) : (
						<VStack gap={2}>
							{sortedRoles.map((role) => (
								<RenderRole role={role} />
							))}
						</VStack>
					)}
				</VStack>
			</Card>

			<Card padding="md">
				<VStack gap={4}>
					<VStack gap={1}>
						<Heading level={3} size="base">
							Search Index Management
						</Heading>
						<Text size="sm" color="muted">
							Refresh search indexes for this guild.
						</Text>
					</VStack>
					<RenderSearchIndexButton
						config={config}
						guildId={guild.id}
						title="Channel Messages"
						indexType="channel_messages"
						csrfToken={csrfToken}
					/>
					<RenderSearchIndexButton
						config={config}
						guildId={guild.id}
						title="Guild Members"
						indexType="guild_members"
						csrfToken={csrfToken}
					/>
				</VStack>
			</Card>
		</VStack>
	);
}
