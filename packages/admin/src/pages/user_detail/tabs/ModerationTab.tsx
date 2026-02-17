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

import {DELETION_REASONS, TEMP_BAN_DURATIONS} from '@fluxer/admin/src/AdminPackageConstants';
import {type ApiError, getErrorSubtitle, getErrorTitle} from '@fluxer/admin/src/api/Errors';
import type {MessageShredStatusResponse} from '@fluxer/admin/src/api/Messages';
import {ErrorCard} from '@fluxer/admin/src/components/ErrorDisplay';
import {FormFieldGroup} from '@fluxer/admin/src/components/ui/Form/FormFieldGroup';
import {Input} from '@fluxer/admin/src/components/ui/Input';
import {HStack} from '@fluxer/admin/src/components/ui/Layout/HStack';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Select} from '@fluxer/admin/src/components/ui/Select';
import {Caption, Heading, Text} from '@fluxer/admin/src/components/ui/Typography';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import {formatTimestamp} from '@fluxer/date_utils/src/DateFormatting';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {Button} from '@fluxer/ui/src/components/Button';
import {Card} from '@fluxer/ui/src/components/Card';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import type {FC} from 'hono/jsx';

interface ModerationTabProps {
	config: Config;
	user: UserAdminResponse;
	userId: string;
	adminAcls: Array<string>;
	messageShredJobId: string | null;
	messageShredStatusResult: {ok: true; data: MessageShredStatusResponse} | {ok: false; error: ApiError} | null;
	deleteAllMessagesDryRun: {channel_count: number; message_count: number} | null;
	csrfToken: string;
}

export function ModerationTab({
	config,
	user,
	userId,
	adminAcls,
	messageShredJobId,
	messageShredStatusResult,
	deleteAllMessagesDryRun,
	csrfToken,
}: ModerationTabProps) {
	const canShredMessages = adminAcls.includes(AdminACLs.MESSAGE_SHRED) || adminAcls.includes(AdminACLs.WILDCARD);
	const canDeleteAllMessages =
		adminAcls.includes(AdminACLs.MESSAGE_DELETE_ALL) || adminAcls.includes(AdminACLs.WILDCARD);

	return (
		<VStack gap={6}>
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
				<Card padding="md">
					<VStack gap={4}>
						<Heading level={2} size="base">
							Ban Actions
						</Heading>
						{user.temp_banned_until ? (
							<form
								method="post"
								action="?action=unban&tab=moderation"
								onsubmit="return confirm('Are you sure you want to unban this user?')"
							>
								<CsrfInput token={csrfToken} />
								<Button type="submit" variant="primary">
									Unban User
								</Button>
							</form>
						) : (
							<VStack gap={3} class="w-full">
								<form
									method="post"
									action="?action=temp_ban&tab=moderation"
									onsubmit="return confirm('Are you sure you want to ban/suspend this user?')"
									class="w-full"
								>
									<CsrfInput token={csrfToken} />
									<VStack gap={3}>
										<FormFieldGroup label="Duration">
											<Select
												id="temp-ban-duration"
												name="duration"
												options={TEMP_BAN_DURATIONS.map((dur) => ({value: String(dur.hours), label: dur.label}))}
											/>
										</FormFieldGroup>
										<FormFieldGroup label="Public Reason (optional)">
											<Input
												id="temp-ban-public-reason"
												type="text"
												name="reason"
												placeholder="Enter public ban reason..."
											/>
										</FormFieldGroup>
										<FormFieldGroup label="Private Reason (optional)">
											<Input
												id="temp-ban-private-reason"
												type="text"
												name="private_reason"
												placeholder="Enter private ban reason (audit log)..."
											/>
										</FormFieldGroup>
										<Button type="submit" variant="primary">
											Ban/Suspend User
										</Button>
									</VStack>
								</form>
							</VStack>
						)}
					</VStack>
				</Card>

				<Card padding="md">
					<VStack gap={4}>
						<Heading level={2} size="base">
							Account Deletion
						</Heading>
						{user.pending_deletion_at ? (
							<form
								method="post"
								action="?action=cancel_deletion&tab=moderation"
								onsubmit="return confirm('Are you sure you want to cancel the scheduled deletion for this user?')"
							>
								<CsrfInput token={csrfToken} />
								<Button type="submit" variant="primary">
									Cancel Deletion
								</Button>
							</form>
						) : (
							<VStack gap={3} class="w-full">
								<form
									method="post"
									action="?action=schedule_deletion&tab=moderation"
									onsubmit="return confirm('Are you sure you want to schedule this user account for deletion? This action will permanently delete the account after the specified number of days.')"
									class="w-full"
								>
									<CsrfInput token={csrfToken} />
									<VStack gap={3}>
										<FormFieldGroup label="Days until deletion">
											<Input type="number" id="user-deletion-days" name="days" value="60" min="60" max="365" />
										</FormFieldGroup>
										<FormFieldGroup label="Reason">
											<Select
												id="user-deletion-reason"
												name="reason_code"
												options={DELETION_REASONS.map((reason) => ({value: String(reason.id), label: reason.label}))}
											/>
										</FormFieldGroup>
										<FormFieldGroup label="Public Reason (optional)">
											<Input
												id="user-deletion-public-reason"
												type="text"
												name="public_reason"
												placeholder="Enter public reason..."
											/>
										</FormFieldGroup>
										<FormFieldGroup label="Private Reason (optional)">
											<Input
												id="user-deletion-private-reason"
												type="text"
												name="private_reason"
												placeholder="Enter private reason (audit log)..."
											/>
										</FormFieldGroup>
										<Button type="submit" variant="primary">
											Schedule Deletion
										</Button>
									</VStack>
								</form>
							</VStack>
						)}
					</VStack>
					<DeletionDaysScript />
				</Card>
			</div>

			{canDeleteAllMessages && (
				<DeleteAllMessagesSection
					config={config}
					userId={userId}
					dryRunData={deleteAllMessagesDryRun}
					csrfToken={csrfToken}
				/>
			)}

			{canShredMessages && (
				<MessageShredSection
					config={config}
					userId={userId}
					jobId={messageShredJobId}
					statusResult={messageShredStatusResult}
					csrfToken={csrfToken}
				/>
			)}
		</VStack>
	);
}

const DELETION_DAYS_SCRIPT = `
(function () {
	var daysInput = document.getElementById('user-deletion-days');
	var reasonSelect = document.getElementById('user-deletion-reason');
	if (!daysInput || !reasonSelect) return;

	function toInt(value) {
		var n = parseInt(value, 10);
		return Number.isFinite(n) ? n : 0;
	}

	function applyMin(minDays) {
		daysInput.setAttribute('min', String(minDays));
		if (!daysInput.value || toInt(daysInput.value) < minDays) {
			daysInput.value = String(minDays);
		}
	}

	// User requested deletions can be shorter; all other reasons default to 60 days.
	var USER_REQUESTED_REASON = 1;

	function syncMin() {
		var reasonId = toInt(reasonSelect.value);
		applyMin(reasonId === USER_REQUESTED_REASON ? 14 : 60);
	}

	syncMin();
	reasonSelect.addEventListener('change', syncMin);
})();
`;

const DeletionDaysScript: FC = () => {
	return <script defer dangerouslySetInnerHTML={{__html: DELETION_DAYS_SCRIPT}} />;
};

interface DeleteAllMessagesSectionProps {
	config: Config;
	userId: string;
	dryRunData: {channel_count: number; message_count: number} | null;
	csrfToken: string;
}

const DeleteAllMessagesSection: FC<DeleteAllMessagesSectionProps> = ({
	config: _config,
	userId: _userId,
	dryRunData,
	csrfToken,
}) => {
	return (
		<Card padding="md">
			<VStack gap={4}>
				<VStack gap={1}>
					<Heading level={2} size="base">
						Delete All Messages
					</Heading>
					<Text size="sm" color="muted">
						Locate every message this user has ever sent and permanently remove them. First run a dry run to see how
						many channels and messages will be affected.
					</Text>
				</VStack>
				<VStack gap={3}>
					<form method="post" action="?action=delete_all_messages&tab=moderation">
						<CsrfInput token={csrfToken} />
						<input type="hidden" name="dry_run" value="true" />
						<Button type="submit" variant="primary">
							Preview Deletion
						</Button>
					</form>
					{dryRunData && (
						<VStack gap={3} class="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
							<Text size="sm" class="text-neutral-700">
								Channels: {dryRunData.channel_count} &middot; Messages: {dryRunData.message_count}
							</Text>
							<form
								method="post"
								action="?action=delete_all_messages&tab=moderation"
								onsubmit="return confirm('This will permanently delete every message this user has ever sent. Continue?')"
							>
								<CsrfInput token={csrfToken} />
								<input type="hidden" name="dry_run" value="false" />
								<Button type="submit" variant="danger">
									Delete All Messages
								</Button>
							</form>
						</VStack>
					)}
				</VStack>
			</VStack>
		</Card>
	);
};

interface MessageShredSectionProps {
	config: Config;
	userId: string;
	jobId: string | null;
	statusResult: {ok: true; data: MessageShredStatusResponse} | {ok: false; error: ApiError} | null;
	csrfToken: string;
}

const MessageShredSection: FC<MessageShredSectionProps> = ({config, userId, jobId, statusResult, csrfToken}) => {
	const entryHint =
		'Upload a CSV file where each row includes the channel_id and message_id separated by a comma. Large files are chunked server-side automatically.';

	return (
		<Card padding="md">
			<VStack gap={4}>
				<VStack gap={1}>
					<Heading level={2} size="base">
						Message Shredder
					</Heading>
					<Text size="sm" color="muted">
						{entryHint}
					</Text>
				</VStack>
				<VStack gap={3}>
					<form method="post" action="?action=message_shred&tab=moderation" id="message-shred-form">
						<CsrfInput token={csrfToken} />
						<input type="hidden" name="csv_data" id="message-shred-csv-data" />
						<VStack gap={3}>
							<FormFieldGroup label="CSV File">
								<input id="message-shred-file" type="file" accept=".csv" class="hidden" />
								<div class="flex items-center gap-2">
									<Button
										type="button"
										variant="secondary"
										size="small"
										onclick="document.getElementById('message-shred-file').click()"
									>
										Choose file
									</Button>
									<span class="text-neutral-500 text-sm" id="message-shred-file-name">
										No file chosen
									</span>
								</div>
							</FormFieldGroup>
							<Button type="submit" variant="primary" fullWidth id="message-shred-submit">
								Shred Messages
							</Button>
						</VStack>
					</form>
				</VStack>
				<MessageShredStatusSection config={config} userId={userId} jobId={jobId} statusResult={statusResult} />
				<MessageShredFormScript />
			</VStack>
		</Card>
	);
};

interface MessageShredStatusSectionProps {
	config: Config;
	userId: string;
	jobId: string | null;
	statusResult: {ok: true; data: MessageShredStatusResponse} | {ok: false; error: ApiError} | null;
}

const MessageShredStatusSection: FC<MessageShredStatusSectionProps> = ({config, userId, jobId, statusResult}) => {
	if (!jobId) {
		return null;
	}

	return (
		<VStack gap={3} class="rounded-lg border border-neutral-200 bg-white p-4">
			<HStack justify="between" align="center">
				<Heading level={2} size="sm" class="font-medium">
					Message Shred Status
				</Heading>
				<a href={`${config.basePath}/users/${userId}?tab=moderation`}>
					<Text size="sm" color="muted">
						Clear
					</Text>
				</a>
			</HStack>
			{statusResult ? (
				statusResult.ok ? (
					<MessageShredStatusContent status={statusResult.data} />
				) : statusResult.error.type === 'notFound' ? (
					<Text size="sm" class="text-neutral-700">
						Preparing job... check back in a moment.
					</Text>
				) : (
					<StatusError error={statusResult.error} />
				)
			) : (
				<Text size="sm" class="text-neutral-700">
					Preparing job... check back in a moment.
				</Text>
			)}
		</VStack>
	);
};

const MessageShredStatusContent: FC<{status: MessageShredStatusResponse}> = ({status}) => {
	if (status.status === 'not_found') {
		return (
			<VStack gap={3}>
				<Text size="sm" class="text-neutral-700">
					Status: {formatMessageShredStatusLabel(status.status)}
				</Text>
			</VStack>
		);
	}

	const percentage = status.total > 0 ? Math.floor((status.processed * 100) / status.total) : 0;

	return (
		<VStack gap={3}>
			<Text size="sm" class="text-neutral-700">
				Status: {formatMessageShredStatusLabel(status.status)}
			</Text>
			<Text size="sm" class="text-neutral-700">
				Requested {status.requested} entries, skipped {status.skipped} entries
			</Text>
			{status.status === 'in_progress' && (
				<VStack gap={2}>
					<HStack justify="between" class="text-neutral-700 text-sm">
						<span>
							{status.processed} / {status.total} ({percentage}%)
						</span>
					</HStack>
					<div class="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
						<div class="h-2 bg-neutral-900 transition-[width] duration-300" style={`width: ${percentage}%`} />
					</div>
				</VStack>
			)}
			{status.status === 'completed' && (
				<Text size="sm" class="text-neutral-700">
					Deleted {status.processed} / {status.total} entries
				</Text>
			)}
			{status.started_at && (
				<Caption class="text-neutral-500">Started {formatTimestampLocal(status.started_at)}</Caption>
			)}
			{status.completed_at && (
				<Caption class="text-neutral-500">Completed {formatTimestampLocal(status.completed_at)}</Caption>
			)}
			{status.failed_at && <Caption class="text-red-600">Failed {formatTimestampLocal(status.failed_at)}</Caption>}
			{status.error && (
				<Text size="sm" class="text-red-600">
					{status.error}
				</Text>
			)}
		</VStack>
	);
};

function formatMessageShredStatusLabel(status: string): string {
	switch (status) {
		case 'in_progress':
			return 'In progress';
		case 'completed':
			return 'Completed';
		case 'failed':
			return 'Failed';
		case 'not_found':
			return 'Preparing';
		default:
			return 'Unknown';
	}
}

function formatTimestampLocal(timestamp: string): string {
	try {
		return formatTimestamp(timestamp, 'en-US');
	} catch {
		return timestamp;
	}
}

const StatusError: FC<{error: ApiError}> = ({error}) => {
	return <ErrorCard title={getErrorTitle(error)} message={getErrorSubtitle(error)} />;
};

const MESSAGE_SHRED_FORM_SCRIPT = `
(function () {
	var form = document.getElementById('message-shred-form');
	if (!form) return;

	var file = document.getElementById('message-shred-file');
	var csvInput = document.getElementById('message-shred-csv-data');
	var submitButton = document.getElementById('message-shred-submit');
	var fileName = document.getElementById('message-shred-file-name');
	if (!file || !csvInput || !submitButton) return;

	file.addEventListener('change', function () {
		if (fileName) {
			fileName.textContent = file.files && file.files[0]
				? file.files[0].name
				: 'No file chosen';
		}
	});

	var processing = false;

	form.addEventListener('submit', function (event) {
		if (processing) {
			event.preventDefault();
			return;
		}

		var selected = file.files && file.files[0];
		if (!selected) {
			event.preventDefault();
			alert('Please select a CSV file to continue.');
			return;
		}

		event.preventDefault();
		processing = true;
		submitButton.disabled = true;
		submitButton.querySelector('span').textContent = 'Processing...';

		var reader = new FileReader();
		reader.onload = function () {
			csvInput.value = reader.result || '';
			form.submit();
		};
		reader.onerror = function () {
			processing = false;
			submitButton.disabled = false;
			submitButton.querySelector('span').textContent = 'Shred Messages';
			alert('Failed to read the CSV file. Please try again.');
		};
		reader.readAsText(selected);
	});
})();
`;

const MessageShredFormScript: FC = () => {
	return <script defer dangerouslySetInnerHTML={{__html: MESSAGE_SHRED_FORM_SCRIPT}} />;
};
