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
import {ALL_ACLS} from '@fluxer/admin/src/AdminPackageConstants';
import {listApiKeys} from '@fluxer/admin/src/api/AdminApiKeys';
import {Layout} from '@fluxer/admin/src/components/Layout';
import {Badge} from '@fluxer/admin/src/components/ui/Badge';
import {FormFieldGroup} from '@fluxer/admin/src/components/ui/Form/FormFieldGroup';
import {Input} from '@fluxer/admin/src/components/ui/Input';
import {HStack} from '@fluxer/admin/src/components/ui/Layout/HStack';
import {PageLayout} from '@fluxer/admin/src/components/ui/Layout/PageLayout';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Caption, Heading, Label, Text} from '@fluxer/admin/src/components/ui/Typography';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import type {Flash} from '@fluxer/hono/src/Flash';
import type {CreateAdminApiKeyResponse, ListAdminApiKeyResponse} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {Alert} from '@fluxer/ui/src/components/Alert';
import {Button} from '@fluxer/ui/src/components/Button';
import {Card} from '@fluxer/ui/src/components/Card';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import {EmptyState} from '@fluxer/ui/src/components/EmptyState';
import {FlashMessage} from '@fluxer/ui/src/components/Flash';
import {Checkbox} from '@fluxer/ui/src/components/Form';
import type {FC} from 'hono/jsx';

export interface AdminApiKeysPageProps {
	config: Config;
	session: Session;
	currentAdmin: UserAdminResponse | undefined;
	flash: Flash | undefined;
	assetVersion: string;
	createdKey: CreateAdminApiKeyResponse | undefined;
	flashAfterAction: Flash | undefined;
	csrfToken: string;
}

export async function AdminApiKeysPage({
	config,
	session,
	currentAdmin,
	flash,
	assetVersion,
	createdKey,
	flashAfterAction,
	csrfToken,
}: AdminApiKeysPageProps) {
	const adminAcls = currentAdmin?.acls ?? [];
	const hasPermissionToManage = hasPermission(adminAcls, AdminACLs.ADMIN_API_KEY_MANAGE);

	if (!hasPermissionToManage) {
		return (
			<Layout
				csrfToken={csrfToken}
				title="Admin API Keys"
				activePage="admin-api-keys"
				config={config}
				session={session}
				currentAdmin={currentAdmin}
				flash={flash}
				assetVersion={assetVersion}
			>
				<RenderAccessDenied />
			</Layout>
		);
	}

	const apiKeysResult = await listApiKeys(config, session);
	const apiKeys = apiKeysResult.ok ? apiKeysResult.data : undefined;

	return (
		<Layout
			csrfToken={csrfToken}
			title="Admin API Keys"
			activePage="admin-api-keys"
			config={config}
			session={session}
			currentAdmin={currentAdmin}
			flash={flash}
			assetVersion={assetVersion}
		>
			<RenderKeyManagement
				config={config}
				createdKey={createdKey}
				flashAfterAction={flashAfterAction}
				apiKeys={apiKeys}
				adminAcls={adminAcls}
				csrfToken={csrfToken}
			/>
		</Layout>
	);
}

const RenderKeyManagement: FC<{
	config: Config;
	createdKey: CreateAdminApiKeyResponse | undefined;
	flashAfterAction: Flash | undefined;
	apiKeys: Array<ListAdminApiKeyResponse> | undefined;
	adminAcls: Array<string>;
	csrfToken: string;
}> = ({config, createdKey, flashAfterAction, apiKeys, adminAcls, csrfToken}) => {
	return (
		<PageLayout maxWidth="7xl">
			<VStack gap={6}>
				<RenderCreateForm config={config} createdKey={createdKey} adminAcls={adminAcls} csrfToken={csrfToken} />
				<RenderFlashAfterAction flash={flashAfterAction} />
				<RenderKeyListSection config={config} apiKeys={apiKeys} csrfToken={csrfToken} />
			</VStack>
		</PageLayout>
	);
};

const RenderCreateForm: FC<{
	config: Config;
	createdKey: CreateAdminApiKeyResponse | undefined;
	adminAcls: Array<string>;
	csrfToken: string;
}> = ({config, createdKey, adminAcls, csrfToken}) => {
	const createdKeyView = createdKey ? <RenderCreatedKey createdKey={createdKey} /> : null;
	const availableAcls = ALL_ACLS.filter((acl) => hasPermission(adminAcls, acl));

	return (
		<Card padding="md">
			<VStack gap={4}>
				<Heading level={1} size="2xl">
					Create Admin API Key
				</Heading>
				{createdKeyView}
				<form id="create-key-form" method="post" action={`${config.basePath}/admin-api-keys?action=create`}>
					<VStack gap={4}>
						<CsrfInput token={csrfToken} />
						<FormFieldGroup label="Key Name" helper="A descriptive name to help you identify this API key.">
							<Input id="api-key-name" type="text" name="name" required placeholder="Enter a descriptive name" />
						</FormFieldGroup>
						<VStack gap={3}>
							<VStack gap={1}>
								<Label>Permissions (ACLs)</Label>
								<Caption>
									Select the permissions to grant this API key. You can only grant permissions you have.
								</Caption>
							</VStack>
							<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
								{availableAcls.map((acl) => (
									<Checkbox name="acls[]" value={acl} label={acl} checked />
								))}
							</div>
						</VStack>
						<Button type="submit" variant="primary">
							Create API Key
						</Button>
					</VStack>
				</form>
			</VStack>
		</Card>
	);
};

const RenderCreatedKey: FC<{createdKey: CreateAdminApiKeyResponse}> = ({createdKey}) => {
	return (
		<Alert variant="success">
			<VStack gap={2}>
				<HStack justify="between" align="center">
					<Heading level={3} size="lg">
						API Key Created Successfully
					</Heading>
					<Button type="button" variant="ghost" size="small" onclick="copyApiKey()">
						Copy Key
					</Button>
				</HStack>
				<Text size="sm" color="success">
					Save this key now. You won't be able to see it again.
				</Text>
				<HStack gap={2} align="center" class="rounded-lg border border-green-200 bg-white p-3">
					<code id="api-key-value" class="flex-1 break-all font-mono text-green-900 text-sm">
						{createdKey.key}
					</code>
					<Caption variant="success">Key ID: {createdKey.key_id}</Caption>
				</HStack>
				<script
					dangerouslySetInnerHTML={{
						__html: `
          function copyApiKey() {
            const keyElement = document.getElementById('api-key-value');
            const text = keyElement.innerText;
            navigator.clipboard.writeText(text).then(() => {
              alert('API key copied to clipboard!');
            });
          }
        `,
					}}
				/>
			</VStack>
		</Alert>
	);
};

const RenderFlashAfterAction: FC<{flash: Flash | undefined}> = ({flash}) => {
	if (!flash) return null;
	return <FlashMessage flash={flash} />;
};

const RenderKeyListSection: FC<{
	config: Config;
	apiKeys: Array<ListAdminApiKeyResponse> | undefined;
	csrfToken: string;
}> = ({config, apiKeys, csrfToken}) => {
	if (apiKeys === undefined) {
		return (
			<VStack gap={3}>
				<EmptyState title="Loading API keys..." />
			</VStack>
		);
	}

	if (apiKeys.length === 0) {
		return <RenderEmptyState />;
	}

	return <RenderApiKeysList config={config} keys={apiKeys} csrfToken={csrfToken} />;
};

const RenderApiKeysList: FC<{config: Config; keys: Array<ListAdminApiKeyResponse>; csrfToken: string}> = ({
	config,
	keys,
	csrfToken,
}) => {
	return (
		<Card padding="md">
			<VStack gap={4}>
				<Heading level={2} size="xl">
					Existing API Keys
				</Heading>
				<VStack gap={3}>
					{keys.map((key) => (
						<RenderApiKeyItem config={config} apiKey={key} csrfToken={csrfToken} />
					))}
				</VStack>
			</VStack>
		</Card>
	);
};

const RenderApiKeyItem: FC<{config: Config; apiKey: ListAdminApiKeyResponse; csrfToken: string}> = ({
	config,
	apiKey,
	csrfToken,
}) => {
	const formattedCreated = formatTimestamp(apiKey.created_at);
	const formattedLastUsed = apiKey.last_used_at ? formatTimestamp(apiKey.last_used_at) : 'Never used';
	const formattedExpires = apiKey.expires_at ? formatTimestamp(apiKey.expires_at) : 'Never expires';

	return (
		<Card padding="sm" class="border border-neutral-200">
			<HStack justify="between" align="start">
				<VStack gap={1} class="flex-1">
					<Heading level={3} size="lg">
						{apiKey.name}
					</Heading>
					<Text size="sm" color="muted">
						Key ID: {apiKey.key_id}
					</Text>
					<Text size="sm" color="muted">
						Created: {formattedCreated}
					</Text>
					<Text size="sm" color="muted">
						Last used: {formattedLastUsed}
					</Text>
					<Text size="sm" color="muted">
						Expires: {formattedExpires}
					</Text>
					<RenderAclsList acls={apiKey.acls} />
				</VStack>
				<form method="post" action={`${config.basePath}/admin-api-keys?action=revoke`}>
					<CsrfInput token={csrfToken} />
					<input type="hidden" name="key_id" value={apiKey.key_id} />
					<Button type="submit" variant="danger" size="small">
						Revoke
					</Button>
				</form>
			</HStack>
		</Card>
	);
};

const RenderAclsList: FC<{acls: Array<string>}> = ({acls}) => {
	if (acls.length === 0) return null;

	return (
		<VStack gap={1} class="mt-2">
			<Text size="xs" weight="medium" color="muted">
				Permissions:
			</Text>
			<div class="flex flex-wrap gap-1">
				{acls.map((acl) => (
					<Badge size="sm" variant="neutral">
						{acl}
					</Badge>
				))}
			</div>
		</VStack>
	);
};

const RenderEmptyState: FC = () => {
	return (
		<Card padding="md">
			<VStack gap={4}>
				<Heading level={2} size="xl">
					Existing API Keys
				</Heading>
				<EmptyState title="No API keys found. Create one to get started." />
			</VStack>
		</Card>
	);
};

const RenderAccessDenied: FC = () => {
	return (
		<Card padding="md">
			<VStack gap={2}>
				<Heading level={1} size="2xl">
					Admin API Keys
				</Heading>
				<Text size="sm" color="muted">
					You do not have permission to manage admin API keys.
				</Text>
			</VStack>
		</Card>
	);
};

function formatTimestamp(timestamp: string): string {
	return timestamp;
}
