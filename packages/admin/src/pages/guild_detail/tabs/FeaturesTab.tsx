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
import {Badge} from '@fluxer/admin/src/components/ui/Badge';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Stack} from '@fluxer/admin/src/components/ui/Stack';
import {Heading, Text} from '@fluxer/admin/src/components/ui/Typography';
import {RenderFeaturesForm} from '@fluxer/admin/src/pages/guild_detail/Forms';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import {Card} from '@fluxer/ui/src/components/Card';

interface FeaturesTabProps {
	config: Config;
	guild: GuildLookupResult;
	guildId: string;
	adminAcls: Array<string>;
	csrfToken: string;
}

export function FeaturesTab({config, guild, guildId, adminAcls, csrfToken}: FeaturesTabProps) {
	return (
		<Stack gap="lg">
			{hasPermission(adminAcls, AdminACLs.GUILD_UPDATE_FEATURES) ? (
				<Card padding="md">
					<Stack gap="md">
						<VStack gap={1}>
							<Heading level={2} size="base">
								Guild Features
							</Heading>
							<Text size="sm" color="muted">
								Select which features are enabled for this guild.
							</Text>
						</VStack>
						<RenderFeaturesForm
							config={config}
							currentFeatures={guild.features}
							guildId={guildId}
							csrfToken={csrfToken}
							selfHosted={config.selfHosted}
						/>
					</Stack>
				</Card>
			) : (
				<Card padding="md">
					<Stack gap="md">
						<Heading level={2} size="base">
							Guild Features
						</Heading>
						{guild.features.length === 0 ? (
							<Text size="sm" color="muted">
								No features enabled
							</Text>
						) : (
							<div class="flex flex-wrap gap-2">
								{guild.features.map((feature) => (
									<Badge variant="info">{feature}</Badge>
								))}
							</div>
						)}
					</Stack>
				</Card>
			)}
		</Stack>
	);
}
