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
import {getErrorMessage} from '@fluxer/admin/src/api/Errors';
import {listGuildEmojis} from '@fluxer/admin/src/api/GuildAssets';
import {ErrorCard} from '@fluxer/admin/src/components/ErrorDisplay';
import {Badge} from '@fluxer/admin/src/components/ui/Badge';
import {HStack} from '@fluxer/admin/src/components/ui/Layout/HStack';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Heading, Text} from '@fluxer/admin/src/components/ui/Typography';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import type {GuildEmojiAsset} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import {Button} from '@fluxer/ui/src/components/Button';
import {Card} from '@fluxer/ui/src/components/Card';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import type {FC} from 'hono/jsx';

interface EmojisTabProps {
	config: Config;
	session: Session;
	guildId: string;
	adminAcls: Array<string>;
	csrfToken: string;
}

const RenderPermissionNotice: FC = () => (
	<Card padding="md">
		<VStack gap={2}>
			<Heading level={3} size="base">
				Permission required
			</Heading>
			<Text size="sm" color="muted">
				You need the {AdminACLs.ASSET_PURGE} ACL to manage guild emojis.
			</Text>
		</VStack>
	</Card>
);

const RenderEmojiCard: FC<{config: Config; guildId: string; emoji: GuildEmojiAsset; csrfToken: string}> = ({
	config,
	guildId,
	emoji,
	csrfToken,
}) => {
	return (
		<Card padding="none" class="overflow-hidden shadow-sm">
			<VStack gap={0}>
				<VStack gap={0} class="h-32 items-center justify-center bg-neutral-100 p-6">
					<img src={emoji.media_url} alt={emoji.name} class="max-h-full max-w-full object-contain" loading="lazy" />
				</VStack>
				<VStack gap={3} class="flex-1 px-4 py-3">
					<HStack gap={2} justify="between">
						<Text size="sm" weight="semibold">
							{emoji.name}
						</Text>
						{emoji.animated && (
							<Badge size="sm" variant="neutral">
								Animated
							</Badge>
						)}
					</HStack>
					<Text size="xs" color="muted" class="break-words">
						ID: {emoji.id}
					</Text>
					<a href={`${config.basePath}/users/${emoji.creator_id}`} class="text-blue-600 text-xs hover:underline">
						Uploader: {emoji.creator_id}
					</a>
					<form action={`${config.basePath}/guilds/${guildId}?tab=emojis&action=delete_emoji`} method="post">
						<CsrfInput token={csrfToken} />
						<input type="hidden" name="emoji_id" value={emoji.id} />
						<Button type="submit" variant="danger" size="small" fullWidth>
							Delete Emoji
						</Button>
					</form>
				</VStack>
			</VStack>
		</Card>
	);
};

const RenderEmojis: FC<{config: Config; guildId: string; emojis: Array<GuildEmojiAsset>; csrfToken: string}> = ({
	config,
	guildId,
	emojis,
	csrfToken,
}) => {
	return (
		<Card padding="md">
			<VStack gap={4}>
				<Heading level={3} size="base">
					Emojis ({emojis.length})
				</Heading>
				{emojis.length === 0 ? (
					<Text size="sm" color="muted">
						No custom emojis found for this guild.
					</Text>
				) : (
					<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						{emojis.map((emoji) => (
							<RenderEmojiCard config={config} guildId={guildId} emoji={emoji} csrfToken={csrfToken} />
						))}
					</div>
				)}
			</VStack>
		</Card>
	);
};

export async function EmojisTab({config, session, guildId, adminAcls, csrfToken}: EmojisTabProps) {
	const hasAssetPurge = hasPermission(adminAcls, AdminACLs.ASSET_PURGE);

	if (!hasAssetPurge) {
		return <RenderPermissionNotice />;
	}

	const result = await listGuildEmojis(config, session, guildId);

	if (!result.ok) {
		return (
			<VStack gap={4}>
				<ErrorCard title="Error" message={getErrorMessage(result.error)} />
				<a
					href={`${config.basePath}/guilds/${guildId}?tab=emojis`}
					class="inline-block rounded bg-neutral-900 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-neutral-800"
				>
					Back to Guild
				</a>
			</VStack>
		);
	}

	return <RenderEmojis config={config} guildId={guildId} emojis={result.data.emojis} csrfToken={csrfToken} />;
}
