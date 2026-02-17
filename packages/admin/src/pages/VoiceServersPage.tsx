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
import {getVoiceRegion, listVoiceServers} from '@fluxer/admin/src/api/Voice';
import {ErrorAlert} from '@fluxer/admin/src/components/ErrorDisplay';
import {Layout} from '@fluxer/admin/src/components/Layout';
import {FormFieldGroup} from '@fluxer/admin/src/components/ui/Form/FormFieldGroup';
import {HStack} from '@fluxer/admin/src/components/ui/Layout/HStack';
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
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import type {Flash} from '@fluxer/hono/src/Flash';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import type {VoiceServerAdminResponse} from '@fluxer/schema/src/domains/admin/AdminVoiceSchemas';
import {UnifiedBadge as Badge} from '@fluxer/ui/src/components/Badge';
import {Button} from '@fluxer/ui/src/components/Button';
import {CardElevated} from '@fluxer/ui/src/components/Card';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import {EmptyState} from '@fluxer/ui/src/components/EmptyState';
import {Checkbox, Input} from '@fluxer/ui/src/components/Form';
import {FlexRowBetween, InfoItem} from '@fluxer/ui/src/components/Layout';
import type {FC} from 'hono/jsx';

export interface VoiceServersPageProps {
	config: Config;
	session: Session;
	currentAdmin: UserAdminResponse | undefined;
	regionId: string | undefined;
	flash: Flash | undefined;
	assetVersion: string;
	csrfToken: string;
}

const EditServerForm: FC<{config: Config; region_id: string; server: VoiceServerAdminResponse; csrfToken: string}> = ({
	config,
	region_id,
	server,
	csrfToken,
}) => {
	const idPrefix = `voice-server-${region_id}-${server.server_id}`.replace(/[^a-zA-Z0-9_-]/g, '_');

	return (
		<VStack gap={0} class="rounded-lg bg-neutral-50 p-4">
			<form method="post" action={`${config.basePath}/voice-servers?action=update`} class="space-y-3">
				<CsrfInput token={csrfToken} />
				<input type="hidden" name="region_id" value={region_id} />
				<input type="hidden" name="server_id" value={server.server_id} />
				<FormFieldGroup label="Endpoint" htmlFor="server-endpoint">
					<Input
						id="server-endpoint"
						name="endpoint"
						type="url"
						value={server.endpoint}
						placeholder="wss://livekit.example.com"
					/>
				</FormFieldGroup>
				<FormFieldGroup
					label="API Key"
					htmlFor={`${idPrefix}-api-key`}
					helper="LiveKit API key (leave blank to keep unchanged)"
				>
					<Input name="api_key" type="text" placeholder="Leave blank to keep current" id={`${idPrefix}-api-key`} />
				</FormFieldGroup>
				<FormFieldGroup
					label="API Secret"
					htmlFor={`${idPrefix}-api-secret`}
					helper="LiveKit API secret (leave blank to keep unchanged)"
				>
					<Input
						name="api_secret"
						type="password"
						placeholder="Leave blank to keep current"
						id={`${idPrefix}-api-secret`}
					/>
				</FormFieldGroup>
				<div class="space-y-2">
					<Checkbox name="is_active" value="true" label="Server is active" checked={server.is_active} />
				</div>
				<VoiceRestrictionFields
					id_prefix={idPrefix}
					restrictions={{
						vip_only: server.vip_only,
						required_guild_features: server.required_guild_features,
						allowed_guild_ids: server.allowed_guild_ids,
					}}
				/>
				<Button type="submit" variant="success" fullWidth>
					Update Server
				</Button>
			</form>
		</VStack>
	);
};

const ServerCard: FC<{config: Config; region_id: string; server: VoiceServerAdminResponse; csrfToken: string}> = ({
	config,
	region_id,
	server,
	csrfToken,
}) => (
	<CardElevated padding="md">
		<HStack gap={4} align="start" class="mb-4">
			<VStack gap={1}>
				<Heading level={3} size="base">
					{server.server_id}
				</Heading>
				<Text size="sm" color="muted">
					{server.endpoint}
				</Text>
			</VStack>
			<HStack gap={2} class="flex-wrap">
				{server.is_active ? (
					<Badge label="ACTIVE" tone="success" intensity="subtle" rounded="default" />
				) : (
					<Badge label="INACTIVE" tone="neutral" intensity="subtle" rounded="default" />
				)}
				<VoiceStatusBadges
					vip_only={server.vip_only}
					has_features={server.required_guild_features.length > 0}
					has_guild_ids={server.allowed_guild_ids.length > 0}
				/>
			</HStack>
		</HStack>
		<div class="mb-4 grid grid-cols-2 gap-4 md:grid-cols-2">
			<InfoItem label="Region" value={server.region_id} />
			<InfoItem label="Status" value={server.is_active ? 'Active' : 'Inactive'} />
		</div>
		<VoiceFeaturesList features={server.required_guild_features} />
		<VoiceGuildIdsList guild_ids={server.allowed_guild_ids} />
		<HStack gap={2} class="flex-wrap">
			<form method="post" action={`${config.basePath}/voice-servers?action=update`}>
				<CsrfInput token={csrfToken} />
				<input type="hidden" name="region_id" value={region_id} />
				<input type="hidden" name="server_id" value={server.server_id} />
				<input type="hidden" name="endpoint" value={server.endpoint} />
				<input type="hidden" name="is_active" value={server.is_active ? 'false' : 'true'} />
				<input type="hidden" name="vip_only" value={server.vip_only ? 'true' : 'false'} />
				<Button type="submit" variant={server.is_active ? 'danger' : 'success'} size="small">
					{server.is_active ? 'Deactivate' : 'Activate'}
				</Button>
			</form>
			<form method="post" action={`${config.basePath}/voice-servers?action=delete`}>
				<CsrfInput token={csrfToken} />
				<input type="hidden" name="region_id" value={region_id} />
				<input type="hidden" name="server_id" value={server.server_id} />
				<Button
					type="submit"
					variant="danger"
					size="small"
					onclick="return confirm('Are you sure you want to delete this server?')"
				>
					Delete
				</Button>
			</form>
		</HStack>
		<details class="mt-6">
			<summary class="cursor-pointer rounded bg-blue-50 px-4 py-2 font-medium text-blue-700 text-sm transition-colors hover:bg-blue-100">
				Edit Server
			</summary>
			<VStack gap={0} class="mt-3 border-neutral-200 border-t pt-3">
				<EditServerForm config={config} region_id={region_id} server={server} csrfToken={csrfToken} />
			</VStack>
		</details>
	</CardElevated>
);

const ServersList: FC<{
	config: Config;
	region_id: string;
	servers: Array<VoiceServerAdminResponse>;
	csrfToken: string;
}> = ({config, region_id, servers, csrfToken}) =>
	servers.length === 0 ? (
		<EmptyState title="No servers configured for this region yet." message="Add your first server to get started." />
	) : (
		<VStack gap={4}>
			{servers.map((server) => (
				<ServerCard config={config} region_id={region_id} server={server} csrfToken={csrfToken} />
			))}
		</VStack>
	);

const CreateForm: FC<{config: Config; region_id: string; csrfToken: string}> = ({config, region_id, csrfToken}) => (
	<CardElevated padding="md">
		<Heading level={2} size="base" class="mb-4">
			Add Voice Server
		</Heading>
		<form method="post" action={`${config.basePath}/voice-servers?action=create`} class="space-y-4">
			<CsrfInput token={csrfToken} />
			<input type="hidden" name="region_id" value={region_id} />
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<FormFieldGroup label="Server ID" htmlFor="new-server-id" required>
					<Input id="new-server-id" name="server_id" type="text" placeholder="livekit-us-east-1" required />
				</FormFieldGroup>
				<FormFieldGroup label="Endpoint" htmlFor="new-server-endpoint" required>
					<Input id="new-server-endpoint" name="endpoint" type="url" placeholder="wss://livekit.example.com" required />
				</FormFieldGroup>
				<FormFieldGroup label="API Key" htmlFor="new-server-api-key" required>
					<Input id="new-server-api-key" name="api_key" type="text" placeholder="LiveKit API key" required />
				</FormFieldGroup>
				<FormFieldGroup label="API Secret" htmlFor="new-server-api-secret" required>
					<Input
						id="new-server-api-secret"
						name="api_secret"
						type="password"
						placeholder="LiveKit API secret"
						required
					/>
				</FormFieldGroup>
			</div>
			<div class="space-y-3">
				<Checkbox name="is_active" value="true" label="Server is active" checked />
			</div>
			<VoiceRestrictionFields
				id_prefix="create"
				restrictions={{
					vip_only: false,
					required_guild_features: [],
					allowed_guild_ids: [],
				}}
			/>
			<Button type="submit" variant="primary" fullWidth>
				Add Server
			</Button>
		</form>
	</CardElevated>
);

const NoRegionView: FC<{config: Config}> = ({config}) => (
	<VStack gap={6}>
		<Heading level={1}>Voice Servers</Heading>
		<ErrorAlert error="Please select a region first." />
		<a href={`${config.basePath}/voice-regions`}>
			<Button type="button">Go to Voice Regions</Button>
		</a>
	</VStack>
);

export async function VoiceServersPage({
	config,
	session,
	currentAdmin,
	regionId,
	flash,
	assetVersion,
	csrfToken,
}: VoiceServersPageProps) {
	if (!regionId) {
		return (
			<Layout
				csrfToken={csrfToken}
				title="Voice Servers"
				activePage="voice-servers"
				config={config}
				session={session}
				currentAdmin={currentAdmin}
				flash={undefined}
				assetVersion={assetVersion}
				inspectedVoiceRegionId={regionId}
			>
				<NoRegionView config={config} />
			</Layout>
		);
	}

	const serversResult = await listVoiceServers(config, session, regionId);
	const adminAcls = currentAdmin?.acls ?? [];
	const canViewRegion = hasPermission(adminAcls, AdminACLs.VOICE_REGION_LIST);
	const regionResult = canViewRegion ? await getVoiceRegion(config, session, regionId, false) : null;

	if (!serversResult.ok) {
		return (
			<Layout
				csrfToken={csrfToken}
				title="Voice Servers"
				activePage="voice-servers"
				config={config}
				session={session}
				currentAdmin={currentAdmin}
				flash={flash}
				assetVersion={assetVersion}
				inspectedVoiceRegionId={regionId}
			>
				<ErrorAlert error={getErrorMessage(serversResult.error)} />
			</Layout>
		);
	}

	const regionError = regionResult && !regionResult.ok ? getErrorMessage(regionResult.error) : null;
	const regionName = regionResult?.ok ? (regionResult.data.region?.name ?? regionId) : regionId;

	return (
		<Layout
			csrfToken={csrfToken}
			title="Voice Servers"
			activePage="voice-servers"
			config={config}
			session={session}
			currentAdmin={currentAdmin}
			flash={flash}
			assetVersion={assetVersion}
			inspectedVoiceRegionId={regionId}
		>
			<VStack gap={6}>
				{regionError ? <ErrorAlert error={regionError} /> : null}
				<FlexRowBetween>
					<VStack gap={2}>
						<a
							href={`${config.basePath}/voice-regions`}
							class="body-sm inline-block text-neutral-600 hover:text-neutral-900"
						>
							&larr; Back to Regions
						</a>
						<Heading level={1}>Servers: {regionName}</Heading>
					</VStack>
					<a href="#create">
						<Button type="button">Add Server</Button>
					</a>
				</FlexRowBetween>
				<ServersList config={config} region_id={regionId} servers={serversResult.data.servers} csrfToken={csrfToken} />
				<div id="create" class="mt-8">
					<CreateForm config={config} region_id={regionId} csrfToken={csrfToken} />
				</div>
			</VStack>
		</Layout>
	);
}
