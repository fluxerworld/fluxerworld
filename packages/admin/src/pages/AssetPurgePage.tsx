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

import {Layout} from '@fluxer/admin/src/components/Layout';
import {FormFieldGroup} from '@fluxer/admin/src/components/ui/Form/FormFieldGroup';
import {Input} from '@fluxer/admin/src/components/ui/Input';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Textarea} from '@fluxer/admin/src/components/ui/Textarea';
import {Heading, Text} from '@fluxer/admin/src/components/ui/Typography';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import type {Flash} from '@fluxer/hono/src/Flash';
import type {
	PurgeGuildAssetError,
	PurgeGuildAssetResult,
	PurgeGuildAssetsResponse,
} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {Button} from '@fluxer/ui/src/components/Button';
import {Card} from '@fluxer/ui/src/components/Card';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import type {FC} from 'hono/jsx';

export interface AssetPurgePageProps {
	config: Config;
	session: Session;
	currentAdmin: UserAdminResponse | undefined;
	flash: Flash | undefined;
	result?: PurgeGuildAssetsResponse;
	assetVersion: string;
	csrfToken: string;
}

function hasPermission(acls: Array<string>, permission: string): boolean {
	return acls.includes(permission) || acls.includes('*');
}

const PurgeForm: FC<{config: Config; csrfToken: string}> = ({config, csrfToken}) => {
	return (
		<Card padding="md">
			<Heading level={3} size="base" class="mb-4">
				Purge Assets
			</Heading>
			<Text color="muted" size="sm" class="mb-4">
				Enter the emoji or sticker IDs that should be removed from S3 and CDN caches.
			</Text>
			<form method="post" action={`${config.basePath}/asset-purge?action=purge-assets`}>
				<VStack gap={4}>
					<CsrfInput token={csrfToken} />
					<FormFieldGroup label="IDs" helper="Separate multiple IDs with commas or line breaks.">
						<Textarea
							id="asset-purge-ids"
							name="asset_ids"
							required
							placeholder={'123456789012345678\n876543210987654321'}
							rows={4}
							size="sm"
						/>
					</FormFieldGroup>
					<FormFieldGroup label="Audit Log Reason (optional)">
						<Input
							id="asset-purge-audit-log-reason"
							type="text"
							name="audit_log_reason"
							placeholder="DMCA takedown request"
							size="sm"
						/>
					</FormFieldGroup>
					<Button type="submit" variant="danger">
						Purge Assets
					</Button>
				</VStack>
			</form>
		</Card>
	);
};

const PermissionNotice: FC = () => {
	return (
		<Card padding="md">
			<Heading level={3} size="base" class="mb-4">
				Permission required
			</Heading>
			<Text color="muted" size="sm">
				You need the asset:purge ACL to use this tool.
			</Text>
		</Card>
	);
};

const ProcessedTable: FC<{items: Array<PurgeGuildAssetResult>}> = ({items}) => {
	return (
		<VStack gap={0} class="overflow-x-auto rounded-lg border border-neutral-200">
			<table class="min-w-full text-left text-neutral-700 text-sm">
				<thead class="bg-neutral-50 text-neutral-500 text-xs uppercase">
					<tr>
						<th class="px-4 py-2 font-medium">ID</th>
						<th class="px-4 py-2 font-medium">Type</th>
						<th class="px-4 py-2 font-medium">In DB</th>
						<th class="px-4 py-2 font-medium">Guild ID</th>
					</tr>
				</thead>
				<tbody>
					{items.map((item) => (
						<tr class="border-neutral-100 border-t">
							<td class="break-words px-4 py-3">{item.id}</td>
							<td class="px-4 py-3">{item.asset_type}</td>
							<td class="px-4 py-3">{item.found_in_db ? 'Yes' : 'No'}</td>
							<td class="px-4 py-3">{item.guild_id ?? '-'}</td>
						</tr>
					))}
				</tbody>
			</table>
		</VStack>
	);
};

const ErrorsList: FC<{errors: Array<PurgeGuildAssetError>}> = ({errors}) => {
	return (
		<VStack gap={2} class="mt-4">
			{errors.map((err) => (
				<Text color="danger" size="sm">
					{err.id}: {err.error}
				</Text>
			))}
		</VStack>
	);
};

const PurgeResult: FC<{result: PurgeGuildAssetsResponse}> = ({result}) => {
	return (
		<VStack gap={4}>
			<Card padding="md">
				<Heading level={3} size="base" class="mb-4">
					Purge Result
				</Heading>
				<Text color="muted" size="sm" class="mb-4">
					Processed {result.processed.length} ID(s); {result.errors.length} error(s).
				</Text>
				<ProcessedTable items={result.processed} />
				{result.errors.length > 0 && <ErrorsList errors={result.errors} />}
			</Card>
		</VStack>
	);
};

export async function AssetPurgePage({
	config,
	session,
	currentAdmin,
	flash,
	result,
	assetVersion,
	csrfToken,
}: AssetPurgePageProps) {
	const hasAssetPurgePermission = currentAdmin ? hasPermission(currentAdmin.acls, AdminACLs.ASSET_PURGE) : false;

	return (
		<Layout
			csrfToken={csrfToken}
			title="Asset Purge"
			activePage="asset-purge"
			config={config}
			session={session}
			currentAdmin={currentAdmin}
			flash={flash}
			assetVersion={assetVersion}
		>
			<VStack gap={6}>
				<VStack gap={2}>
					<Heading level={1}>Asset Purge</Heading>
					<Text color="muted" size="sm">
						Purge emojis or stickers from the storage and CDN. Provide one or more IDs. Separate multiple IDs with
						commas.
					</Text>
				</VStack>

				{result && <PurgeResult result={result} />}

				{hasAssetPurgePermission ? <PurgeForm config={config} csrfToken={csrfToken} /> : <PermissionNotice />}
			</VStack>
		</Layout>
	);
}

export function parseAssetIds(input: string): Array<string> {
	const normalized = input.replace(/\n/g, ',').replace(/\r/g, ',');
	return normalized
		.split(',')
		.map((id) => id.trim())
		.filter((id) => id.length > 0);
}
