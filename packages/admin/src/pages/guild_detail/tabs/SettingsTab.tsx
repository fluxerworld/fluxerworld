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
import {FormFieldGroup} from '@fluxer/admin/src/components/ui/Form/FormFieldGroup';
import {Grid} from '@fluxer/admin/src/components/ui/Grid';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Select} from '@fluxer/admin/src/components/ui/Select';
import {Heading, Text} from '@fluxer/admin/src/components/ui/Typography';
import {RenderDisabledOperationsForm} from '@fluxer/admin/src/pages/guild_detail/Forms';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import {Button} from '@fluxer/ui/src/components/Button';
import {Card} from '@fluxer/ui/src/components/Card';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import {Checkbox} from '@fluxer/ui/src/components/Form';
import {InfoGrid, InfoItem} from '@fluxer/ui/src/components/Layout';

interface SettingsTabProps {
	config: Config;
	guild: GuildLookupResult;
	guildId: string;
	adminAcls: Array<string>;
	csrfToken: string;
}

function verificationLevelToString(level: number): string {
	switch (level) {
		case 0:
			return 'None';
		case 1:
			return 'Low (verified email)';
		case 2:
			return 'Medium (registered for 5 minutes)';
		case 3:
			return 'High (member for 10 minutes)';
		case 4:
			return 'Very High (verified phone)';
		default:
			return `Unknown (${level})`;
	}
}

function mfaLevelToString(level: number): string {
	switch (level) {
		case 0:
			return 'None';
		case 1:
			return 'Elevated';
		default:
			return `Unknown (${level})`;
	}
}

function nsfwLevelToString(level: number): string {
	switch (level) {
		case 0:
			return 'Default';
		case 1:
			return 'Explicit';
		case 2:
			return 'Safe';
		case 3:
			return 'Age Restricted';
		default:
			return `Unknown (${level})`;
	}
}

function contentFilterToString(level: number): string {
	switch (level) {
		case 0:
			return 'Disabled';
		case 1:
			return 'Members without roles';
		case 2:
			return 'All members';
		default:
			return `Unknown (${level})`;
	}
}

function notificationLevelToString(level: number): string {
	switch (level) {
		case 0:
			return 'All messages';
		case 1:
			return 'Only mentions';
		default:
			return `Unknown (${level})`;
	}
}

export function SettingsTab({config, guild, guildId, adminAcls, csrfToken}: SettingsTabProps) {
	const canUpdateSettings = hasPermission(adminAcls, AdminACLs.GUILD_UPDATE_SETTINGS);

	return (
		<VStack gap={6}>
			{canUpdateSettings ? (
				<Card padding="md">
					<VStack gap={4}>
						<Heading level={3} size="base">
							Guild Settings
						</Heading>
						<form method="post" action={`${config.basePath}/guilds/${guildId}?action=update_settings&tab=settings`}>
							<CsrfInput token={csrfToken} />
							<Grid cols={2} gap="md">
								<FormFieldGroup label="Verification Level" htmlFor="guild-verification-level">
									<Select
										id="guild-verification-level"
										name="verification_level"
										value={String(guild.verification_level)}
										options={[
											{value: '0', label: 'None'},
											{value: '1', label: 'Low (verified email)'},
											{value: '2', label: 'Medium (5+ minutes)'},
											{value: '3', label: 'High (10+ minutes)'},
											{value: '4', label: 'Very High (verified phone)'},
										]}
										size="sm"
										fullWidth
									/>
								</FormFieldGroup>
								<FormFieldGroup label="MFA Level" htmlFor="guild-mfa-level">
									<Select
										id="guild-mfa-level"
										name="mfa_level"
										value={String(guild.mfa_level)}
										options={[
											{value: '0', label: 'None'},
											{value: '1', label: 'Elevated'},
										]}
										size="sm"
										fullWidth
									/>
								</FormFieldGroup>
								<FormFieldGroup label="NSFW Level" htmlFor="guild-nsfw-level">
									<Select
										id="guild-nsfw-level"
										name="nsfw_level"
										value={String(guild.nsfw_level)}
										options={[
											{value: '0', label: 'Default'},
											{value: '1', label: 'Explicit'},
											{value: '2', label: 'Safe'},
											{value: '3', label: 'Age Restricted'},
										]}
										size="sm"
										fullWidth
									/>
								</FormFieldGroup>
								<FormFieldGroup label="Explicit Content Filter" htmlFor="guild-explicit-content-filter">
									<Select
										id="guild-explicit-content-filter"
										name="explicit_content_filter"
										value={String(guild.explicit_content_filter)}
										options={[
											{value: '0', label: 'Disabled'},
											{value: '1', label: 'Members without roles'},
											{value: '2', label: 'All members'},
										]}
										size="sm"
										fullWidth
									/>
								</FormFieldGroup>
								<FormFieldGroup label="Default Notifications" htmlFor="guild-default-notifications">
									<Select
										id="guild-default-notifications"
										name="default_message_notifications"
										value={String(guild.default_message_notifications)}
										options={[
											{value: '0', label: 'All messages'},
											{value: '1', label: 'Only mentions'},
										]}
										size="sm"
										fullWidth
									/>
								</FormFieldGroup>
							</Grid>
							<VStack gap={0} class="mt-6 border-neutral-200 border-t pt-6">
								<Button type="submit" variant="primary">
									Save Settings
								</Button>
							</VStack>
						</form>
					</VStack>
				</Card>
			) : (
				<Card padding="md">
					<VStack gap={4}>
						<Text size="base" weight="semibold">
							Guild Settings
						</Text>
						<InfoGrid>
							<InfoItem label="Verification Level" value={verificationLevelToString(guild.verification_level)} />
							<InfoItem label="MFA Level" value={mfaLevelToString(guild.mfa_level)} />
							<InfoItem label="NSFW Level" value={nsfwLevelToString(guild.nsfw_level)} />
							<InfoItem label="Explicit Content Filter" value={contentFilterToString(guild.explicit_content_filter)} />
							<InfoItem
								label="Default Notifications"
								value={notificationLevelToString(guild.default_message_notifications)}
							/>
							<InfoItem label="AFK Timeout" value={`${guild.afk_timeout} seconds`} />
						</InfoGrid>
					</VStack>
				</Card>
			)}

			{canUpdateSettings ? (
				<Card padding="md">
					<VStack gap={4}>
						<Heading level={3} size="base">
							Disabled Operations
						</Heading>
						<RenderDisabledOperationsForm
							config={config}
							currentDisabledOperations={guild.disabled_operations}
							guildId={guildId}
							csrfToken={csrfToken}
						/>
					</VStack>
				</Card>
			) : (
				<Card padding="md">
					<VStack gap={4}>
						<Heading level={3} size="base">
							Disabled Operations
						</Heading>
						<Text size="sm" color="muted">
							Bitfield value: {guild.disabled_operations}
						</Text>
					</VStack>
				</Card>
			)}

			{canUpdateSettings && (
				<Card padding="md">
					<VStack gap={4}>
						<Heading level={3} size="base">
							Clear Guild Fields
						</Heading>
						<form
							method="post"
							action={`${config.basePath}/guilds/${guildId}?action=clear_fields&tab=settings`}
							onsubmit="return confirm('Are you sure you want to clear these fields?')"
						>
							<CsrfInput token={csrfToken} />
							<VStack gap={3}>
								<VStack gap={2}>
									<Checkbox name="fields[]" value="icon" label="Icon" />
									<Checkbox name="fields[]" value="banner" label="Banner" />
									<Checkbox name="fields[]" value="splash" label="Splash" />
									<Checkbox name="fields[]" value="embed_splash" label="Embed Splash" />
								</VStack>
								<Button type="submit" variant="danger">
									Clear Selected Fields
								</Button>
							</VStack>
						</form>
					</VStack>
				</Card>
			)}
		</VStack>
	);
}
