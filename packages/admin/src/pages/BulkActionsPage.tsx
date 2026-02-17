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

import {PATCHABLE_FLAGS} from '@fluxer/admin/src/AdminPackageConstants';
import {Layout} from '@fluxer/admin/src/components/Layout';
import {FormFieldGroup} from '@fluxer/admin/src/components/ui/Form/FormFieldGroup';
import {Input} from '@fluxer/admin/src/components/ui/Input';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Select} from '@fluxer/admin/src/components/ui/Select';
import {Textarea} from '@fluxer/admin/src/components/ui/Textarea';
import {Heading, Text} from '@fluxer/admin/src/components/ui/Typography';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import type {Flash} from '@fluxer/hono/src/Flash';
import type {BulkOperationResponse} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {Button} from '@fluxer/ui/src/components/Button';
import {Card} from '@fluxer/ui/src/components/Card';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import {Checkbox} from '@fluxer/ui/src/components/Form';
import type {FC} from 'hono/jsx';
import type {z} from 'zod';

type BulkOperationResponseType = z.infer<typeof BulkOperationResponse>;

interface GuildFeature {
	value: string;
}

const GUILD_FEATURES: Array<GuildFeature> = [
	{value: 'ANIMATED_ICON'},
	{value: 'ANIMATED_BANNER'},
	{value: 'BANNER'},
	{value: 'INVITE_SPLASH'},
	{value: 'INVITES_DISABLED'},
	{value: 'MORE_EMOJI'},
	{value: 'MORE_STICKERS'},
	{value: 'UNLIMITED_EMOJI'},
	{value: 'UNLIMITED_STICKERS'},
	{value: 'TEXT_CHANNEL_FLEXIBLE_NAMES'},
	{value: 'UNAVAILABLE_FOR_EVERYONE'},
	{value: 'UNAVAILABLE_FOR_EVERYONE_BUT_STAFF'},
	{value: 'VANITY_URL'},
	{value: 'VERIFIED'},
	{value: 'VIP_VOICE'},
	{value: 'DETACHED_BANNER'},
	{value: 'EXPRESSION_PURGE_ALLOWED'},
	{value: 'LARGE_GUILD_OVERRIDE'},
	{value: 'VERY_LARGE_GUILD'},
];

const DELETION_REASONS: Array<[number, string]> = [
	[1, 'User requested'],
	[2, 'Other'],
	[3, 'Spam'],
	[4, 'Cheating or exploitation'],
	[5, 'Coordinated raiding or manipulation'],
	[6, 'Automation or self-bot usage'],
	[7, 'Nonconsensual sexual content'],
	[8, 'Scam or social engineering'],
	[9, 'Child sexual content'],
	[10, 'Privacy violation or doxxing'],
	[11, 'Harassment or bullying'],
	[12, 'Payment fraud'],
	[13, 'Child safety violation'],
	[14, 'Billing dispute or abuse'],
	[15, 'Unsolicited explicit content'],
	[16, 'Graphic violence'],
	[17, 'Ban evasion'],
	[18, 'Token or credential scam'],
	[19, 'Inactivity'],
	[20, 'Hate speech or extremist content'],
	[21, 'Malicious links or malware distribution'],
	[22, 'Impersonation or fake identity'],
];

export interface BulkActionsPageProps {
	config: Config;
	session: Session;
	currentAdmin: UserAdminResponse | undefined;
	flash: Flash | undefined;
	assetVersion: string;
	adminAcls: Array<string>;
	result?: BulkOperationResponseType;
	csrfToken: string;
}

function hasPermission(acls: Array<string>, permission: string): boolean {
	return acls.includes('*') || acls.includes(permission);
}

const OperationResult: FC<{response: BulkOperationResponseType}> = ({response}) => {
	const successCount = response.successful.length;
	const failCount = response.failed.length;

	return (
		<div class="mb-6 rounded-lg border border-neutral-200 bg-white p-6">
			<Heading level={3} size="base" class="mb-4">
				Operation Result
			</Heading>
			<VStack gap={3}>
				<Text size="sm">
					<span class="font-medium text-green-600 text-sm">Successful: </span>
					{successCount}
				</Text>
				<Text size="sm">
					<span class="font-medium text-red-600 text-sm">Failed: </span>
					{failCount}
				</Text>
				{response.failed.length > 0 && (
					<div class="mt-4">
						<Heading level={3} size="sm" class="mb-2">
							Errors:
						</Heading>
						<ul>
							<VStack gap={1}>
								{response.failed.map((error) => (
									<li>
										<Text color="danger" size="sm">
											{error.id}: {error.error}
										</Text>
									</li>
								))}
							</VStack>
						</ul>
					</div>
				)}
			</VStack>
		</div>
	);
};

const BulkUpdateUserFlags: FC<{basePath: string; csrfToken: string}> = ({basePath, csrfToken}) => (
	<Card padding="md">
		<Heading level={3} size="base" class="mb-4">
			Bulk Update User Flags
		</Heading>
		<form method="post" action={`${basePath}/bulk-actions?action=bulk-update-user-flags`}>
			<VStack gap={4}>
				<CsrfInput token={csrfToken} />
				<FormFieldGroup label="User IDs (one per line)">
					<Textarea
						id="bulk-user-flags-user-ids"
						name="user_ids"
						placeholder={'123456789\n987654321'}
						required
						rows={5}
					/>
				</FormFieldGroup>
				<div>
					<Text weight="medium" size="sm" class="mb-2 block text-neutral-700">
						Flags to Add
					</Text>
					<div class="grid grid-cols-2 gap-3">
						{PATCHABLE_FLAGS.map((flag) => (
							<Checkbox name="add_flags[]" value={flag.value.toString()} label={flag.name} />
						))}
					</div>
				</div>
				<div>
					<Text weight="medium" size="sm" class="mb-2 block text-neutral-700">
						Flags to Remove
					</Text>
					<div class="grid grid-cols-2 gap-3">
						{PATCHABLE_FLAGS.map((flag) => (
							<Checkbox name="remove_flags[]" value={flag.value.toString()} label={flag.name} />
						))}
					</div>
				</div>
				<FormFieldGroup label="Audit Log Reason (optional)">
					<Input
						id="bulk-user-flags-audit-log-reason"
						type="text"
						name="audit_log_reason"
						placeholder="Reason for this bulk operation"
					/>
				</FormFieldGroup>
				<Button type="submit" variant="primary" size="medium">
					Update User Flags
				</Button>
			</VStack>
		</form>
	</Card>
);

const BulkUpdateGuildFeatures: FC<{basePath: string; csrfToken: string}> = ({basePath, csrfToken}) => (
	<Card padding="md">
		<Heading level={3} size="base" class="mb-4">
			Bulk Update Guild Features
		</Heading>
		<form method="post" action={`${basePath}/bulk-actions?action=bulk-update-guild-features`}>
			<VStack gap={4}>
				<CsrfInput token={csrfToken} />
				<FormFieldGroup label="Guild IDs (one per line)">
					<Textarea
						id="bulk-guild-features-guild-ids"
						name="guild_ids"
						placeholder={'123456789\n987654321'}
						required
						rows={5}
					/>
				</FormFieldGroup>
				<div>
					<Text weight="medium" size="sm" class="mb-2 block text-neutral-700">
						Features to Add
					</Text>
					<div class="grid grid-cols-2 gap-3">
						{GUILD_FEATURES.map((feature) => (
							<Checkbox name="add_features[]" value={feature.value} label={feature.value} />
						))}
					</div>
					<FormFieldGroup label="Custom features" htmlFor="bulk-guild-features-custom-add-features" class="mt-3">
						<Input
							id="bulk-guild-features-custom-add-features"
							type="text"
							name="custom_add_features"
							placeholder="CUSTOM_FEATURE_1, CUSTOM_FEATURE_2"
						/>
					</FormFieldGroup>
				</div>
				<div>
					<Text weight="medium" size="sm" class="mb-2 block text-neutral-700">
						Features to Remove
					</Text>
					<div class="grid grid-cols-2 gap-3">
						{GUILD_FEATURES.map((feature) => (
							<Checkbox name="remove_features[]" value={feature.value} label={feature.value} />
						))}
					</div>
					<FormFieldGroup label="Custom features" htmlFor="bulk-guild-features-custom-remove-features" class="mt-3">
						<Input
							id="bulk-guild-features-custom-remove-features"
							type="text"
							name="custom_remove_features"
							placeholder="CUSTOM_FEATURE_1, CUSTOM_FEATURE_2"
						/>
					</FormFieldGroup>
				</div>
				<FormFieldGroup label="Audit Log Reason (optional)">
					<Input
						id="bulk-guild-features-audit-log-reason"
						type="text"
						name="audit_log_reason"
						placeholder="Reason for this bulk operation"
					/>
				</FormFieldGroup>
				<Button type="submit" variant="primary" size="medium">
					Update Guild Features
				</Button>
			</VStack>
		</form>
	</Card>
);

const BulkAddGuildMembers: FC<{basePath: string; csrfToken: string}> = ({basePath, csrfToken}) => (
	<Card padding="md">
		<Heading level={3} size="base" class="mb-4">
			Bulk Add Guild Members
		</Heading>
		<form method="post" action={`${basePath}/bulk-actions?action=bulk-add-guild-members`}>
			<VStack gap={4}>
				<CsrfInput token={csrfToken} />
				<FormFieldGroup label="Guild ID">
					<Input id="bulk-add-guild-members-guild-id" type="text" name="guild_id" placeholder="123456789" required />
				</FormFieldGroup>
				<FormFieldGroup label="User IDs (one per line)">
					<Textarea
						id="bulk-add-guild-members-user-ids"
						name="user_ids"
						placeholder={'123456789\n987654321'}
						required
						rows={5}
					/>
				</FormFieldGroup>
				<FormFieldGroup label="Audit Log Reason (optional)">
					<Input
						id="bulk-add-guild-members-audit-log-reason"
						type="text"
						name="audit_log_reason"
						placeholder="Reason for this bulk operation"
					/>
				</FormFieldGroup>
				<Button type="submit" variant="primary" size="medium">
					Add Members
				</Button>
			</VStack>
		</form>
	</Card>
);

const BULK_DELETION_DAYS_SCRIPT = `
(function () {
	var reasonSelect = document.getElementById('bulk-deletion-reason');
	var daysInput = document.getElementById('bulk-deletion-days');
	if (!reasonSelect || !daysInput) return;

	reasonSelect.addEventListener('change', function () {
		var reason = parseInt(this.value, 10);
		if (reason === 9 || reason === 13) {
			daysInput.value = '0';
			daysInput.min = '0';
		} else {
			if (parseInt(daysInput.value, 10) < 14) {
				daysInput.value = '14';
			}
			daysInput.min = '14';
		}
	});
})();
`;

const BulkScheduleUserDeletion: FC<{basePath: string; csrfToken: string}> = ({basePath, csrfToken}) => (
	<Card padding="md">
		<Heading level={3} size="base" class="mb-4">
			Bulk Schedule User Deletion
		</Heading>
		<form
			method="post"
			action={`${basePath}/bulk-actions?action=bulk-schedule-user-deletion`}
			onsubmit="return confirm('Are you sure you want to schedule these users for deletion?')"
		>
			<VStack gap={4}>
				<CsrfInput token={csrfToken} />
				<FormFieldGroup label="User IDs (one per line)">
					<Textarea
						id="bulk-user-deletion-user-ids"
						name="user_ids"
						placeholder={'123456789\n987654321'}
						required
						rows={5}
					/>
				</FormFieldGroup>
				<FormFieldGroup label="Deletion Reason">
					<Select
						id="bulk-deletion-reason"
						name="reason_code"
						required
						options={DELETION_REASONS.map(([code, label]) => ({value: String(code), label}))}
					/>
				</FormFieldGroup>
				<FormFieldGroup label="Public Reason (optional)">
					<Input
						id="bulk-user-deletion-public-reason"
						type="text"
						name="public_reason"
						placeholder="Terms of service violation"
					/>
				</FormFieldGroup>
				<FormFieldGroup label="Days Until Deletion">
					<Input type="number" id="bulk-deletion-days" name="days_until_deletion" value="14" min="14" required />
				</FormFieldGroup>
				<FormFieldGroup label="Audit Log Reason (optional)">
					<Input
						id="bulk-user-deletion-audit-log-reason"
						type="text"
						name="audit_log_reason"
						placeholder="Reason for this bulk operation"
					/>
				</FormFieldGroup>
				<Button type="submit" variant="danger" size="medium">
					Schedule Deletion
				</Button>
				<script defer dangerouslySetInnerHTML={{__html: BULK_DELETION_DAYS_SCRIPT}} />
			</VStack>
		</form>
	</Card>
);

export function BulkActionsPage({
	config,
	session,
	currentAdmin,
	flash,
	assetVersion,
	adminAcls,
	result,
	csrfToken,
}: BulkActionsPageProps) {
	const canUpdateUserFlags = hasPermission(adminAcls, 'bulk:update_user_flags');
	const canUpdateGuildFeatures = hasPermission(adminAcls, 'bulk:update_guild_features');
	const canAddGuildMembers = hasPermission(adminAcls, 'bulk:add_guild_members');
	const canDeleteUsers = hasPermission(adminAcls, 'bulk:delete_users');

	return (
		<Layout
			csrfToken={csrfToken}
			title="Bulk Actions"
			activePage="bulk-actions"
			config={config}
			session={session}
			currentAdmin={currentAdmin}
			flash={flash}
			assetVersion={assetVersion}
		>
			<VStack gap={6}>
				<Heading level={1}>Bulk Actions</Heading>

				{result && <OperationResult response={result} />}

				{canUpdateUserFlags && <BulkUpdateUserFlags basePath={config.basePath} csrfToken={csrfToken} />}
				{canUpdateGuildFeatures && <BulkUpdateGuildFeatures basePath={config.basePath} csrfToken={csrfToken} />}
				{canAddGuildMembers && <BulkAddGuildMembers basePath={config.basePath} csrfToken={csrfToken} />}
				{canDeleteUsers && <BulkScheduleUserDeletion basePath={config.basePath} csrfToken={csrfToken} />}
			</VStack>
		</Layout>
	);
}
