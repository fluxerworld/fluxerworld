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
import type {GuildLookupResult} from '@fluxer/admin/src/api/Guilds';
import {Input} from '@fluxer/admin/src/components/ui/Input';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Stack} from '@fluxer/admin/src/components/ui/Stack';
import {Heading, Text} from '@fluxer/admin/src/components/ui/Typography';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import {Button} from '@fluxer/ui/src/components/Button';
import {Card} from '@fluxer/ui/src/components/Card';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';

interface ModerationTabProps {
	config: Config;
	guild: GuildLookupResult;
	guildId: string;
	adminAcls: Array<string>;
	csrfToken: string;
}

export function ModerationTab({config, guild: _guild, guildId, adminAcls, csrfToken}: ModerationTabProps) {
	const canUpdateName = hasPermission(adminAcls, AdminACLs.GUILD_UPDATE_NAME);
	const canUpdateVanity = hasPermission(adminAcls, AdminACLs.GUILD_UPDATE_VANITY);
	const canTransferOwnership = hasPermission(adminAcls, AdminACLs.GUILD_TRANSFER_OWNERSHIP);
	const canForceAddUser = hasPermission(adminAcls, AdminACLs.GUILD_FORCE_ADD_MEMBER);
	const canReload = hasPermission(adminAcls, AdminACLs.GUILD_RELOAD);
	const canShutdown = hasPermission(adminAcls, AdminACLs.GUILD_SHUTDOWN);
	const canDelete = hasPermission(adminAcls, AdminACLs.GUILD_DELETE);

	return (
		<Stack gap="lg">
			{canUpdateName && (
				<Card padding="md">
					<Stack gap="md">
						<Heading level={2} size="base">
							Update Guild Name
						</Heading>
						<form
							method="post"
							action={`${config.basePath}/guilds/${guildId}?action=update_name&tab=moderation`}
							onsubmit="return confirm('Are you sure you want to change this guild\\'s name?')"
						>
							<CsrfInput token={csrfToken} />
							<Stack gap="sm">
								<Input type="text" name="name" placeholder="New guild name" required fullWidth />
								<Button type="submit" variant="primary">
									Update Name
								</Button>
							</Stack>
						</form>
					</Stack>
				</Card>
			)}

			{canUpdateVanity && (
				<Card padding="md">
					<Stack gap="md">
						<Heading level={2} size="base">
							Update Vanity URL
						</Heading>
						<form
							method="post"
							action={`${config.basePath}/guilds/${guildId}?action=update_vanity&tab=moderation`}
							onsubmit="return confirm('Are you sure you want to change this guild\\'s vanity URL?')"
						>
							<CsrfInput token={csrfToken} />
							<Stack gap="sm">
								<Input type="text" name="vanity_url_code" placeholder="vanity-code (leave empty to remove)" fullWidth />
								<Button type="submit" variant="primary">
									Update Vanity URL
								</Button>
							</Stack>
						</form>
					</Stack>
				</Card>
			)}

			{canTransferOwnership && (
				<Card padding="md">
					<Stack gap="md">
						<Heading level={2} size="base">
							Transfer Ownership
						</Heading>
						<form
							method="post"
							action={`${config.basePath}/guilds/${guildId}?action=transfer_ownership&tab=moderation`}
							onsubmit="return confirm('Are you sure you want to transfer ownership of this guild? This action cannot be easily undone.')"
						>
							<CsrfInput token={csrfToken} />
							<Stack gap="sm">
								<Input type="text" name="new_owner_id" placeholder="New owner user ID" required fullWidth />
								<Button type="submit" variant="danger">
									Transfer Ownership
								</Button>
							</Stack>
						</form>
					</Stack>
				</Card>
			)}

			{canForceAddUser && (
				<Card padding="md">
					<Stack gap="md">
						<Heading level={2} size="base">
							Force Add User to Guild
						</Heading>
						<form
							method="post"
							action={`${config.basePath}/guilds/${guildId}?action=force_add_user&tab=moderation`}
							onsubmit="return confirm('Are you sure you want to force add this user to the guild?')"
						>
							<CsrfInput token={csrfToken} />
							<Stack gap="sm">
								<Input type="text" name="user_id" placeholder="User ID to add" required fullWidth />
								<Button type="submit" variant="primary">
									Add User
								</Button>
							</Stack>
						</form>
					</Stack>
				</Card>
			)}

			{(canReload || canShutdown) && (
				<Card padding="md">
					<Stack gap="md">
						<Heading level={2} size="base">
							Guild Process Controls
						</Heading>
						<div class="flex flex-wrap gap-3">
							{canReload && (
								<form
									method="post"
									action={`${config.basePath}/guilds/${guildId}?action=reload&tab=moderation`}
									onsubmit="return confirm('Are you sure you want to reload this guild process?')"
								>
									<CsrfInput token={csrfToken} />
									<Button type="submit" variant="success">
										Reload Guild
									</Button>
								</form>
							)}
							{canShutdown && (
								<form
									method="post"
									action={`${config.basePath}/guilds/${guildId}?action=shutdown&tab=moderation`}
									onsubmit="return confirm('Are you sure you want to shutdown this guild process?')"
								>
									<CsrfInput token={csrfToken} />
									<Button type="submit" variant="danger">
										Shutdown Guild
									</Button>
								</form>
							)}
						</div>
					</Stack>
				</Card>
			)}

			{canDelete && (
				<Card padding="md">
					<Stack gap="md">
						<VStack gap={1}>
							<Heading level={2} size="base">
								Delete Guild
							</Heading>
							<Text size="sm" color="muted">
								Deleting a guild permanently removes it and all associated data. This action cannot be undone.
							</Text>
						</VStack>
						<form
							method="post"
							action={`${config.basePath}/guilds/${guildId}?action=delete_guild&tab=moderation`}
							onsubmit="return confirm('Are you sure you want to permanently delete this guild? This action cannot be undone.')"
						>
							<CsrfInput token={csrfToken} />
							<Button type="submit" variant="danger">
								Delete Guild
							</Button>
						</form>
					</Stack>
				</Card>
			)}
		</Stack>
	);
}
