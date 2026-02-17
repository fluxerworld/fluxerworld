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
import {listGuildStickers} from '@fluxer/admin/src/api/GuildAssets';
import {ErrorCard} from '@fluxer/admin/src/components/ErrorDisplay';
import {Badge} from '@fluxer/admin/src/components/ui/Badge';
import {HStack} from '@fluxer/admin/src/components/ui/Layout/HStack';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Stack} from '@fluxer/admin/src/components/ui/Stack';
import {Caption, Heading, Text} from '@fluxer/admin/src/components/ui/Typography';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import type {GuildStickerAsset} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import {Button} from '@fluxer/ui/src/components/Button';
import {Card} from '@fluxer/ui/src/components/Card';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import type {FC} from 'hono/jsx';

interface StickersTabProps {
	config: Config;
	session: Session;
	guildId: string;
	adminAcls: Array<string>;
	csrfToken: string;
}

function stickerAnimatedLabel(animated: boolean): string {
	return animated ? 'Animated' : 'Static';
}

const RenderPermissionNotice: FC = () => (
	<Card padding="md">
		<Stack gap="md">
			<Heading level={2} size="base">
				Permission required
			</Heading>
			<Text size="sm" color="muted">
				You need the {AdminACLs.ASSET_PURGE} ACL to manage guild stickers.
			</Text>
		</Stack>
	</Card>
);

const RenderStickerCard: FC<{config: Config; guildId: string; sticker: GuildStickerAsset; csrfToken: string}> = ({
	config,
	guildId,
	sticker,
	csrfToken,
}) => {
	return (
		<Card padding="none" class="overflow-hidden shadow-sm">
			<VStack gap={0}>
				<VStack gap={0} class="h-32 items-center justify-center bg-neutral-100 p-6">
					<img src={sticker.media_url} alt={sticker.name} class="max-h-full max-w-full object-contain" loading="lazy" />
				</VStack>
				<VStack gap={1} class="flex-1 px-4 py-3">
					<HStack gap={2} justify="between" align="center">
						<Text size="sm" weight="semibold">
							{sticker.name}
						</Text>
						<Badge size="sm" variant="neutral">
							{stickerAnimatedLabel(sticker.animated)}
						</Badge>
					</HStack>
					<Caption class="break-words">ID: {sticker.id}</Caption>
					<a href={`${config.basePath}/users/${sticker.creator_id}`} class="text-blue-600 text-xs hover:underline">
						Uploader: {sticker.creator_id}
					</a>
					<form
						action={`${config.basePath}/guilds/${guildId}?tab=stickers&action=delete_sticker`}
						method="post"
						class="mt-4"
					>
						<CsrfInput token={csrfToken} />
						<input type="hidden" name="sticker_id" value={sticker.id} />
						<Button type="submit" variant="danger" size="small" fullWidth>
							Delete Sticker
						</Button>
					</form>
				</VStack>
			</VStack>
		</Card>
	);
};

const RenderStickers: FC<{config: Config; guildId: string; stickers: Array<GuildStickerAsset>; csrfToken: string}> = ({
	config,
	guildId,
	stickers,
	csrfToken,
}) => {
	return (
		<Card padding="md">
			<Stack gap="md">
				<Heading level={2} size="base">
					Stickers ({stickers.length})
				</Heading>
				{stickers.length === 0 ? (
					<Text size="sm" color="muted">
						No stickers found for this guild.
					</Text>
				) : (
					<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						{stickers.map((sticker) => (
							<RenderStickerCard config={config} guildId={guildId} sticker={sticker} csrfToken={csrfToken} />
						))}
					</div>
				)}
			</Stack>
		</Card>
	);
};

export async function StickersTab({config, session, guildId, adminAcls, csrfToken}: StickersTabProps) {
	const hasAssetPurge = hasPermission(adminAcls, AdminACLs.ASSET_PURGE);

	if (!hasAssetPurge) {
		return <RenderPermissionNotice />;
	}

	const result = await listGuildStickers(config, session, guildId);

	if (!result.ok) {
		return (
			<VStack gap={4}>
				<ErrorCard title="Error" message={getErrorMessage(result.error)} />
				<a
					href={`${config.basePath}/guilds/${guildId}?tab=stickers`}
					class="inline-block rounded bg-neutral-900 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-neutral-800"
				>
					Back to Guild
				</a>
			</VStack>
		);
	}

	return <RenderStickers config={config} guildId={guildId} stickers={result.data.stickers} csrfToken={csrfToken} />;
}
