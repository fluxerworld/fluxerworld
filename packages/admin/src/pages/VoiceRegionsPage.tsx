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
import {listVoiceRegions} from '@fluxer/admin/src/api/Voice';
import {ErrorAlert} from '@fluxer/admin/src/components/ErrorDisplay';
import {Layout} from '@fluxer/admin/src/components/Layout';
import {FormFieldGroup} from '@fluxer/admin/src/components/ui/Form/FormFieldGroup';
import {HStack} from '@fluxer/admin/src/components/ui/Layout/HStack';
import {PageHeader} from '@fluxer/admin/src/components/ui/Layout/PageHeader';
import {PageLayout} from '@fluxer/admin/src/components/ui/Layout/PageLayout';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Heading, Text} from '@fluxer/admin/src/components/ui/Typography';
import {
	VoiceFeaturesList,
	VoiceGuildIdsList,
	VoiceRestrictionFields,
	VoiceStatusBadges,
} from '@fluxer/admin/src/components/VoiceComponents';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import type {Flash} from '@fluxer/hono/src/Flash';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import type {
	VoiceRegionWithServersResponse,
	VoiceServerAdminResponse,
} from '@fluxer/schema/src/domains/admin/AdminVoiceSchemas';
import {UnifiedBadge as Badge} from '@fluxer/ui/src/components/Badge';
import {Button} from '@fluxer/ui/src/components/Button';
import {CardElevated} from '@fluxer/ui/src/components/Card';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import {EmptyState} from '@fluxer/ui/src/components/EmptyState';
import {Checkbox, Input} from '@fluxer/ui/src/components/Form';
import {InfoItem} from '@fluxer/ui/src/components/Layout';
import type {FC} from 'hono/jsx';

export interface VoiceRegionsPageProps {
	config: Config;
	session: Session;
	currentAdmin: UserAdminResponse | undefined;
	flash: Flash | undefined;
	assetVersion: string;
	csrfToken: string;
}

const ServerRow: FC<{server: VoiceServerAdminResponse}> = ({server}) => (
	<HStack gap={3} class="justify-between rounded bg-neutral-50 p-3">
		<VStack gap={1} class="flex-1">
			<Text size="sm">{server.server_id}</Text>
			<Text size="xs" color="muted">
				{server.endpoint}
			</Text>
		</VStack>
		<HStack gap={2}>
			{server.is_active ? (
				<Badge label="ACTIVE" tone="success" intensity="subtle" rounded="default" />
			) : (
				<Badge label="INACTIVE" tone="neutral" intensity="subtle" rounded="default" />
			)}
		</HStack>
	</HStack>
);

const EditForm: FC<{config: Config; region: VoiceRegionWithServersResponse; csrfToken: string}> = ({
	config,
	region,
	csrfToken,
}) => (
	<VStack gap={4} class="rounded-lg bg-neutral-50 p-4">
		<form method="post" action={`${config.basePath}/voice-regions?action=update`}>
			<CsrfInput token={csrfToken} />
			<input type="hidden" name="id" value={region.id} />
			<VStack gap={4}>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<FormFieldGroup label="Region Name" htmlFor="region-name">
						<Input
							id="region-name"
							name="name"
							type="text"
							value={region.name}
							placeholder="Display name for the region"
						/>
					</FormFieldGroup>
					<FormFieldGroup label="Emoji" htmlFor="region-emoji">
						<Input
							id="region-emoji"
							name="emoji"
							type="text"
							value={region.emoji}
							placeholder="Flag or emoji for the region"
						/>
					</FormFieldGroup>
					<FormFieldGroup label="Latitude" htmlFor="region-latitude">
						<Input
							id="region-latitude"
							name="latitude"
							type="number"
							step="any"
							value={String(region.latitude)}
							placeholder="Geographic latitude"
						/>
					</FormFieldGroup>
					<FormFieldGroup label="Longitude" htmlFor="region-longitude">
						<Input
							id="region-longitude"
							name="longitude"
							type="number"
							step="any"
							value={String(region.longitude)}
							placeholder="Geographic longitude"
						/>
					</FormFieldGroup>
				</div>
				<Checkbox name="is_default" value="true" label="Set as default region" checked={region.is_default} />
				<VoiceRestrictionFields
					restrictions={{
						vip_only: region.vip_only,
						required_guild_features: region.required_guild_features,
						allowed_guild_ids: region.allowed_guild_ids,
					}}
				/>
				<Button type="submit" variant="success">
					Update Region
				</Button>
			</VStack>
		</form>
	</VStack>
);

const RegionCard: FC<{config: Config; region: VoiceRegionWithServersResponse; csrfToken: string}> = ({
	config,
	region,
	csrfToken,
}) => (
	<CardElevated padding="md">
		<VStack gap={4}>
			<HStack gap={3}>
				<Text class="text-3xl">{region.emoji}</Text>
				<VStack gap={1}>
					<HStack gap={2} align="center" class="flex-wrap">
						<Heading level={3} size="base">
							{region.name}
						</Heading>
						{region.is_default && <Badge label="DEFAULT" tone="info" intensity="subtle" rounded="default" />}
						<VoiceStatusBadges
							vip_only={region.vip_only}
							has_features={region.required_guild_features.length > 0}
							has_guild_ids={region.allowed_guild_ids.length > 0}
						/>
					</HStack>
					<Text size="sm" color="muted">
						Region ID: {region.id}
					</Text>
				</VStack>
			</HStack>
			<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
				<InfoItem label="Latitude" value={String(region.latitude)} />
				<InfoItem label="Longitude" value={String(region.longitude)} />
				<InfoItem label="Servers" value={String(region.servers?.length ?? 0)} />
			</div>
			<VoiceFeaturesList features={region.required_guild_features} />
			<VoiceGuildIdsList guild_ids={region.allowed_guild_ids} />
			{region.servers && region.servers.length > 0 && (
				<VStack gap={2} class="border-neutral-200 border-t pt-4">
					<Heading level={4} size="sm">
						Servers
					</Heading>
					<VStack gap={2}>
						{region.servers.map((server) => (
							<ServerRow server={server} />
						))}
					</VStack>
				</VStack>
			)}
			<HStack gap={2}>
				<form method="post" action={`${config.basePath}/voice-regions?action=delete`}>
					<CsrfInput token={csrfToken} />
					<input type="hidden" name="id" value={region.id} />
					<Button
						type="submit"
						variant="danger"
						size="small"
						onclick="return confirm('Are you sure? This will delete all servers in this region.')"
					>
						Delete Region
					</Button>
				</form>
				<a href={`${config.basePath}/voice-servers?region_id=${region.id}`}>
					<Button variant="secondary" size="small" type="button">
						Manage Servers
					</Button>
				</a>
			</HStack>
			<details>
				<summary class="cursor-pointer rounded bg-blue-50 px-4 py-2 font-medium text-blue-700 text-sm transition-colors hover:bg-blue-100">
					Edit Region
				</summary>
				<VStack gap={3} class="border-neutral-200 border-t pt-3">
					<EditForm config={config} region={region} csrfToken={csrfToken} />
				</VStack>
			</details>
		</VStack>
	</CardElevated>
);

const RegionsList: FC<{config: Config; regions: Array<VoiceRegionWithServersResponse>; csrfToken: string}> = ({
	config,
	regions,
	csrfToken,
}) =>
	regions.length === 0 ? (
		<EmptyState title="No voice regions configured yet." message="Create your first region to get started." />
	) : (
		<VStack gap={6}>
			{regions.map((region) => (
				<RegionCard config={config} region={region} csrfToken={csrfToken} />
			))}
		</VStack>
	);

const CreateForm: FC<{config: Config; csrfToken: string}> = ({config, csrfToken}) => (
	<CardElevated padding="md">
		<VStack gap={4}>
			<Heading level={2} size="base">
				Create Voice Region
			</Heading>
			<form method="post" action={`${config.basePath}/voice-regions?action=create`}>
				<CsrfInput token={csrfToken} />
				<VStack gap={4}>
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<FormFieldGroup label="Region ID" htmlFor="new-region-id" required>
							<Input id="new-region-id" name="id" type="text" placeholder="us-east" required />
						</FormFieldGroup>
						<FormFieldGroup label="Region Name" htmlFor="new-region-name" required>
							<Input id="new-region-name" name="name" type="text" placeholder="US East" required />
						</FormFieldGroup>
						<FormFieldGroup label="Emoji" htmlFor="new-region-emoji" required>
							<Input id="new-region-emoji" name="emoji" type="text" placeholder="Flag emoji" required />
						</FormFieldGroup>
						<FormFieldGroup label="Latitude" htmlFor="new-region-latitude" required>
							<Input id="new-region-latitude" name="latitude" type="number" step="any" placeholder="40.7128" required />
						</FormFieldGroup>
						<FormFieldGroup label="Longitude" htmlFor="new-region-longitude" required>
							<Input
								id="new-region-longitude"
								name="longitude"
								type="number"
								step="any"
								placeholder="-74.0060"
								required
							/>
						</FormFieldGroup>
					</div>
					<Checkbox name="is_default" value="true" label="Set as default region" />
					<VoiceRestrictionFields
						restrictions={{
							vip_only: false,
							required_guild_features: [],
							allowed_guild_ids: [],
						}}
					/>
					<Button type="submit" variant="primary">
						Create Region
					</Button>
				</VStack>
			</form>
		</VStack>
	</CardElevated>
);

export async function VoiceRegionsPage({
	config,
	session,
	currentAdmin,
	flash,
	assetVersion,
	csrfToken,
}: VoiceRegionsPageProps) {
	const result = await listVoiceRegions(config, session, true);

	return (
		<Layout
			csrfToken={csrfToken}
			title="Voice Regions"
			activePage="voice-regions"
			config={config}
			session={session}
			currentAdmin={currentAdmin}
			flash={flash}
			assetVersion={assetVersion}
		>
			<PageLayout maxWidth="7xl">
				{result.ok ? (
					<VStack gap={6}>
						<PageHeader
							title="Voice Regions"
							actions={
								<a href="#create">
									<Button type="button">Create Region</Button>
								</a>
							}
						/>
						<RegionsList config={config} regions={result.data.regions} csrfToken={csrfToken} />
						<div id="create">
							<CreateForm config={config} csrfToken={csrfToken} />
						</div>
					</VStack>
				) : (
					<ErrorAlert error={getErrorMessage(result.error)} />
				)}
			</PageLayout>
		</Layout>
	);
}
