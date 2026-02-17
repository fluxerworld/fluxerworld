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
import {type ApiError, getErrorMessage} from '@fluxer/admin/src/api/Errors';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Heading} from '@fluxer/admin/src/components/ui/Typography';
import {AclsForm, FlagsForm, SuspiciousFlagsForm, TraitsForm} from '@fluxer/admin/src/pages/user_detail/Forms';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import type {LimitConfigGetResponse} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import type {
	ListUserChangeLogResponse,
	UserAdminResponse,
	UserContactChangeLogEntry,
} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {Card} from '@fluxer/ui/src/components/Card';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import {extractTimestampFromSnowflake, formatDiscriminator} from '@fluxer/ui/src/utils/FormatUser';
import type {FC, PropsWithChildren} from 'hono/jsx';
import type {z} from 'zod';

type LimitConfigResponse = z.infer<typeof LimitConfigGetResponse>;

interface OverviewTabProps {
	config: Config;
	user: UserAdminResponse;
	adminAcls: Array<string>;
	changeLogResult: {ok: true; data: ListUserChangeLogResponse} | {ok: false; error: ApiError} | null;
	limitConfigResult: {ok: true; data: LimitConfigResponse} | {ok: false; error: ApiError} | null;
	csrfToken: string;
}

function buildUserSearchHref(config: Config, value: string): string {
	return `${config.basePath}/users?q=${encodeURIComponent(value)}`;
}

export function OverviewTab({
	config,
	user,
	adminAcls,
	changeLogResult,
	limitConfigResult,
	csrfToken,
}: OverviewTabProps) {
	return (
		<div class="space-y-6">
			{user.temp_banned_until && (
				<div class="rounded-lg border border-red-200 bg-red-50 p-4">
					<div class="flex items-center gap-2 font-medium text-red-900 text-sm">
						Temporarily Banned Until: {user.temp_banned_until}
					</div>
				</div>
			)}

			{!user.temp_banned_until && user.pending_deletion_at && (
				<div class="rounded-lg border border-orange-200 bg-orange-50 p-4">
					<div class="font-medium text-orange-900 text-sm">Scheduled for Deletion: {user.pending_deletion_at}</div>
					{user.deletion_reason_code !== null && user.deletion_public_reason !== null && (
						<div class="mt-1 text-orange-700 text-sm">
							Reason: {user.deletion_public_reason} (code: {user.deletion_reason_code})
						</div>
					)}
					{user.deletion_reason_code !== null && user.deletion_public_reason === null && (
						<div class="mt-1 text-orange-700 text-sm">Reason code: {user.deletion_reason_code}</div>
					)}
					{user.deletion_reason_code === null && user.deletion_public_reason !== null && (
						<div class="mt-1 text-orange-700 text-sm">Reason: {user.deletion_public_reason}</div>
					)}
				</div>
			)}

			{user.pending_bulk_message_deletion_at && (
				<div class="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
					<div class="font-medium text-neutral-700 text-sm">
						Bulk message deletion scheduled for: {user.pending_bulk_message_deletion_at}
					</div>
					{hasPermission(adminAcls, AdminACLs.USER_CANCEL_BULK_MESSAGE_DELETION) && (
						<form
							method="post"
							action="?action=cancel_bulk_message_deletion&tab=overview"
							onsubmit="return confirm('Are you sure you want to cancel the scheduled bulk message deletion for this user?')"
						>
							<CsrfInput token={csrfToken} />
							<button
								type="submit"
								class="mt-3 w-full rounded bg-neutral-900 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-neutral-800"
							>
								Cancel Bulk Message Deletion
							</button>
						</form>
					)}
				</div>
			)}

			<div class="grid grid-cols-1 items-start gap-6 md:grid-cols-3">
				<div class="space-y-6 md:col-span-2">
					<Card padding="md">
						<VStack gap={4}>
							<Heading level={3} size="base">
								Account Information
							</Heading>
							<div class="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
								<CompactInfoMono label="User ID" value={user.id} />
								<CompactInfo label="Created" value={extractTimestampFromSnowflake(user.id)} />
								<CompactInfo label="Username" value={`${user.username}#${formatDiscriminator(user.discriminator)}`} />
								<CompactInfoWithElement label="Email">
									{user.email ? (
										<span>
											<span>{user.email}</span>{' '}
											{user.email_verified ? <CheckmarkIcon class="text-green-600" /> : <XIcon class="text-red-600" />}
											{user.email_bounced && <span class="ml-1 text-orange-600">(bounced)</span>}
											<a
												href={buildUserSearchHref(config, user.email)}
												class="ml-2 text-blue-600 text-xs no-underline hover:underline"
											>
												Search
											</a>
										</span>
									) : (
										<span class="text-neutral-500">Not set</span>
									)}
								</CompactInfoWithElement>
								<CompactInfoWithElement label="Phone">
									{user.phone ? (
										<span>
											<span class="font-mono">{user.phone}</span>
											<a
												href={buildUserSearchHref(config, user.phone)}
												class="ml-2 text-blue-600 text-xs no-underline hover:underline"
											>
												Search
											</a>
										</span>
									) : (
										<span class="text-neutral-500">Not set</span>
									)}
								</CompactInfoWithElement>
								<CompactInfo label="Date of Birth" value={user.date_of_birth ?? 'Not set'} />
								<CompactInfo label="Locale" value={user.locale ?? 'Not set'} />
								{user.bio && (
									<div class="md:col-span-2">
										<CompactInfo label="Bio" value={user.bio} />
									</div>
								)}
								{user.pronouns && <CompactInfo label="Pronouns" value={user.pronouns} />}
								<CompactInfo label="Bot" value={user.bot ? 'Yes' : 'No'} />
								<CompactInfo label="System" value={user.system ? 'Yes' : 'No'} />
								<CompactInfo label="Last Active" value={user.last_active_at ?? 'Never'} />
								<CompactInfoWithElement label="Last Active IP">
									{user.last_active_ip ? (
										<span>
											<span class="font-mono">{user.last_active_ip}</span>
											{user.last_active_ip_reverse && (
												<span class="ml-2 text-neutral-500">({user.last_active_ip_reverse})</span>
											)}
											<a
												href={buildUserSearchHref(config, user.last_active_ip)}
												class="ml-2 text-blue-600 text-xs no-underline hover:underline"
											>
												Search
											</a>
										</span>
									) : (
										<span class="text-neutral-500">Not recorded</span>
									)}
								</CompactInfoWithElement>
								<CompactInfo label="Location" value={user.last_active_location ?? 'Unknown Location'} />
							</div>
						</VStack>
					</Card>

					<Card padding="md">
						<VStack gap={4}>
							<Heading level={3} size="base">
								Security &amp; Premium
							</Heading>
							<div class="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
								<CompactInfo
									label="Authenticators"
									value={
										user.authenticator_types.length === 0
											? 'None'
											: user.authenticator_types
													.map((t: number) => {
														switch (t) {
															case 0:
																return 'TOTP';
															case 1:
																return 'SMS';
															case 2:
																return 'WebAuthn';
															default:
																return 'Unknown';
														}
													})
													.join(', ')
									}
								/>
								<CompactInfo
									label="Premium Type"
									value={
										user.premium_type === null || user.premium_type === 0
											? 'None'
											: user.premium_type === 1
												? 'Subscription'
												: user.premium_type === 2
													? 'Lifetime'
													: 'Unknown'
									}
								/>
								{user.premium_since && <CompactInfo label="Premium Since" value={user.premium_since} />}
								{user.premium_until && <CompactInfo label="Premium Until" value={user.premium_until} />}
							</div>
						</VStack>
					</Card>

					<TraitsCard
						config={config}
						user={user}
						adminAcls={adminAcls}
						limitConfigResult={limitConfigResult}
						csrfToken={csrfToken}
					/>

					<Card padding="md">
						<VStack gap={4}>
							<Heading level={3} size="base">
								User Flags
							</Heading>
							<FlagsForm currentFlags={user.flags} csrfToken={csrfToken} selfHosted={config.selfHosted} />
						</VStack>
					</Card>

					<Card padding="md">
						<VStack gap={4}>
							<Heading level={3} size="base">
								Suspicious Activity Flags
							</Heading>
							<SuspiciousFlagsForm currentFlags={user.suspicious_activity_flags} csrfToken={csrfToken} />
						</VStack>
					</Card>

					<ChangeLogCard changeLogResult={changeLogResult} />
				</div>

				<Card padding="md">
					<VStack gap={4}>
						<Heading level={3} size="base">
							Admin ACLs
						</Heading>
						<AclsForm user={user} adminAcls={adminAcls} csrfToken={csrfToken} />
					</VStack>
				</Card>
			</div>
		</div>
	);
}

const CompactInfo: FC<{label: string; value: string}> = ({label, value}) => (
	<div>
		<span class="text-neutral-500 text-sm">{label}:</span> <span class="text-neutral-900">{value}</span>
	</div>
);

const CompactInfoMono: FC<{label: string; value: string}> = ({label, value}) => (
	<div>
		<span class="text-neutral-500 text-sm">{label}:</span> <span class="font-mono text-neutral-900">{value}</span>
	</div>
);

const CompactInfoWithElement: FC<PropsWithChildren<{label: string}>> = ({label, children}) => (
	<div>
		<span class="text-neutral-500 text-sm">{label}:</span> {children}
	</div>
);

const CheckmarkIcon: FC<{class?: string}> = ({class: className}) => (
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" class={`inline-block h-4 w-4 ${className ?? ''}`}>
		<polyline
			points="40 144 96 200 224 72"
			fill="none"
			stroke="currentColor"
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="24"
		/>
	</svg>
);

const XIcon: FC<{class?: string}> = ({class: className}) => (
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" class={`inline-block h-4 w-4 ${className ?? ''}`}>
		<line
			x1="200"
			y1="56"
			x2="56"
			y2="200"
			fill="none"
			stroke="currentColor"
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="24"
		/>
		<line
			x1="200"
			y1="200"
			x2="56"
			y2="56"
			fill="none"
			stroke="currentColor"
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="24"
		/>
	</svg>
);

interface TraitsCardProps {
	config: Config;
	user: UserAdminResponse;
	adminAcls: Array<string>;
	limitConfigResult: {ok: true; data: LimitConfigResponse} | {ok: false; error: ApiError} | null;
	csrfToken: string;
}

const TraitsCard: FC<TraitsCardProps> = ({config, user, adminAcls, limitConfigResult, csrfToken}) => {
	const traitDefinitions = parseTraitDefinitions(limitConfigResult);
	const customTraits = user.traits.filter((trait: string) => !traitDefinitions.includes(trait));
	const canEdit = hasPermission(adminAcls, AdminACLs.USER_UPDATE_TRAITS);

	return (
		<Card padding="md">
			<VStack gap={4}>
				<VStack gap={1}>
					<Heading level={3} size="base">
						Traits
					</Heading>
					<p class="text-neutral-600 text-sm">
						Assign traits to a user so the runtime limit rules and guild features can unlock alternate limits.
					</p>
				</VStack>
				<AssignedTraits traits={user.traits} />
				{limitConfigResult?.ok ? (
					canEdit ? (
						<TraitsForm
							definitions={traitDefinitions}
							currentTraits={user.traits}
							customTraits={customTraits}
							csrfToken={csrfToken}
						/>
					) : (
						<div class="text-neutral-500 text-sm">You need the trait update ACL to make changes.</div>
					)
				) : (
					<div class="text-red-700 text-sm">
						Failed to load limit configuration: {formatError(limitConfigResult?.error)}
					</div>
				)}
				{traitDefinitions.length === 0 && (
					<p class="text-neutral-500 text-xs">
						No trait definitions are declared yet. Add entries to the limit configuration so they can be assigned here.{' '}
						<a href={`${config.basePath}/instance-config`} class="text-blue-600 underline">
							Open Instance Configuration
						</a>
					</p>
				)}
			</VStack>
		</Card>
	);
};

const AssignedTraits: FC<{traits: Array<string>}> = ({traits}) => {
	if (traits.length === 0) {
		return <p class="text-neutral-500 text-sm">No traits assigned to this user.</p>;
	}

	return (
		<div>
			<div class="mb-2 text-neutral-500 text-xs uppercase tracking-wider">Assigned Traits</div>
			<div class="flex flex-wrap gap-2">
				{traits.map((trait) => (
					<span class="rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1 font-medium text-neutral-900 text-sm">
						{trait}
					</span>
				))}
			</div>
		</div>
	);
};

function parseTraitDefinitions(
	limitConfigResult: {ok: true; data: LimitConfigResponse} | {ok: false; error: ApiError} | null,
): Array<string> {
	if (!limitConfigResult?.ok) {
		return [];
	}
	return limitConfigResult.data.limit_config.traitDefinitions
		.map((value: string) => value.trim())
		.filter((value: string) => value !== '');
}

interface ChangeLogCardProps {
	changeLogResult: {ok: true; data: ListUserChangeLogResponse} | {ok: false; error: ApiError} | null;
}

const ChangeLogCard: FC<ChangeLogCardProps> = ({changeLogResult}) => {
	return (
		<Card padding="md">
			<VStack gap={4}>
				<Heading level={3} size="base">
					Contact Change Log
				</Heading>
				{changeLogResult?.ok ? (
					<ChangeLogEntries entries={changeLogResult.data.entries} />
				) : (
					<div class="text-red-700 text-sm">Failed to load change log: {formatError(changeLogResult?.error)}</div>
				)}
			</VStack>
		</Card>
	);
};

const ChangeLogEntries: FC<{entries: Array<UserContactChangeLogEntry>}> = ({entries}) => {
	if (entries.length === 0) {
		return <div class="text-neutral-600 text-sm">No contact changes recorded.</div>;
	}

	return (
		<ul class="divide-y divide-neutral-200">
			{entries.map((entry) => (
				<ChangeLogEntry entry={entry} />
			))}
		</ul>
	);
};

const ChangeLogEntry: FC<{entry: UserContactChangeLogEntry}> = ({entry}) => {
	return (
		<li class="flex flex-col gap-1 py-3">
			<div class="flex items-center gap-2 text-sm">
				<span class="font-medium text-neutral-900">{labelForField(entry.field)}</span>
				<span class="text-neutral-500">{entry.event_at}</span>
			</div>
			<div class="text-neutral-800 text-sm">{oldNewText(entry.old_value, entry.new_value)}</div>
			<div class="text-neutral-600 text-xs">
				Reason: {entry.reason ?? 'Unknown'}
				{entry.actor_user_id && ` \u2022 Actor: ${entry.actor_user_id}`}
			</div>
		</li>
	);
};

function labelForField(field: string): string {
	switch (field) {
		case 'email':
			return 'Email';
		case 'phone':
			return 'Phone';
		case 'fluxer_tag':
			return 'FluxerTag';
		default:
			return field;
	}
}

function oldNewText(old_value: string | null, new_value: string | null): string {
	const oldDisplay = old_value ?? 'null';
	const newDisplay = new_value ?? 'null';
	return `${oldDisplay} \u2192 ${newDisplay}`;
}

function formatError(err: ApiError | undefined | null): string {
	if (!err) {
		return 'An error occurred';
	}
	return getErrorMessage(err);
}
