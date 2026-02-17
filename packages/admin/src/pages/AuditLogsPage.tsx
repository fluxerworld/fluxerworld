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

import {searchAuditLogs} from '@fluxer/admin/src/api/Audit';
import {getErrorMessage} from '@fluxer/admin/src/api/Errors';
import {lookupUsersByIds} from '@fluxer/admin/src/api/Users';
import {ErrorAlert} from '@fluxer/admin/src/components/ErrorDisplay';
import {Layout} from '@fluxer/admin/src/components/Layout';
import {HStack} from '@fluxer/admin/src/components/ui/Layout/HStack';
import {PageHeader} from '@fluxer/admin/src/components/ui/Layout/PageHeader';
import {PageLayout} from '@fluxer/admin/src/components/ui/Layout/PageLayout';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {ResourceLink} from '@fluxer/admin/src/components/ui/ResourceLink';
import {Text} from '@fluxer/admin/src/components/ui/Typography';
import {buildPaginationUrl} from '@fluxer/admin/src/hooks/usePaginationUrl';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {formatTimestamp} from '@fluxer/date_utils/src/DateFormatting';
import type {Flash} from '@fluxer/hono/src/Flash';
import type {AdminAuditLogResponseSchema} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {Pill} from '@fluxer/ui/src/components/Badge';
import {Button} from '@fluxer/ui/src/components/Button';
import {EmptyState} from '@fluxer/ui/src/components/EmptyState';
import {Pagination} from '@fluxer/ui/src/components/Pagination';
import {type SearchField, SearchForm} from '@fluxer/ui/src/components/SearchForm';
import {
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableHeaderCell,
	TableRow,
} from '@fluxer/ui/src/components/Table';
import type {ColorTone} from '@fluxer/ui/src/utils/ColorVariants';
import {formatUserTag} from '@fluxer/ui/src/utils/FormatUser';
import type {FC} from 'hono/jsx';
import type {z} from 'zod';

type AuditLog = z.infer<typeof AdminAuditLogResponseSchema>;

interface AuditLogsPageProps {
	config: Config;
	session: Session;
	currentAdmin: UserAdminResponse | undefined;
	flash: Flash | undefined;
	csrfToken: string;
	query: string | undefined;
	adminUserIdFilter: string | undefined;
	targetId: string | undefined;
	currentPage: number;
	assetVersion: string;
}

interface UserMap {
	[userId: string]: UserAdminResponse;
}

function formatTimestampLocal(timestamp: string): string {
	return formatTimestamp(timestamp, 'en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	});
}

function formatAction(action: string): string {
	return action.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function getActionTone(action: string): ColorTone {
	switch (action) {
		case 'temp_ban':
		case 'disable_suspicious_activity':
		case 'schedule_deletion':
		case 'ban_ip':
		case 'ban_email':
		case 'ban_phone':
			return 'danger';
		case 'unban':
		case 'cancel_deletion':
		case 'unban_ip':
		case 'unban_email':
		case 'unban_phone':
			return 'success';
		case 'update_flags':
		case 'update_features':
		case 'set_acls':
		case 'update_settings':
			return 'info';
		case 'delete_message':
			return 'orange';
		default:
			return 'neutral';
	}
}

function capitalise(s: string): string {
	if (s.length === 0) return s;
	return s.charAt(0).toUpperCase() + s.slice(1);
}

const FiltersSection: FC<{
	config: Config;
	query: string | undefined;
	adminUserIdFilter: string | undefined;
	targetId: string | undefined;
}> = ({config, query, adminUserIdFilter, targetId}) => {
	const fields: Array<SearchField> = [
		{
			name: 'q',
			type: 'text',
			label: 'Search',
			placeholder: 'Search by action, reason, or metadata...',
			value: query ?? '',
		},
		{
			name: 'target_id',
			type: 'text',
			label: 'Target ID',
			placeholder: 'Filter by target ID...',
			value: targetId ?? '',
		},
		{
			name: 'admin_user_id',
			type: 'text',
			label: 'Admin User ID',
			placeholder: 'Filter by admin user ID...',
			value: adminUserIdFilter ?? '',
		},
	];

	return (
		<SearchForm
			action="/audit-logs"
			method="get"
			fields={fields}
			submitLabel="Search"
			showClear={true}
			clearHref="/audit-logs"
			clearLabel="Clear"
			layout="vertical"
			padding="sm"
			basePath={config.basePath}
		/>
	);
};

const AdminCell: FC<{config: Config; admin_user_id: string; userMap: UserMap}> = ({config, admin_user_id, userMap}) => {
	if (admin_user_id === '') {
		return (
			<TableCell>
				<Text size="sm" color="muted" class="italic">
					-
				</Text>
			</TableCell>
		);
	}

	const user = userMap[admin_user_id];
	return (
		<TableCell>
			<ResourceLink config={config} resourceType="user" resourceId={admin_user_id}>
				<VStack gap={0}>
					<Text size="sm" weight="medium">
						{user ? formatUserTag(user.username, user.discriminator) : 'Unknown User'}
					</Text>
					<Text size="xs" color="muted">
						{admin_user_id}
					</Text>
				</VStack>
			</ResourceLink>
		</TableCell>
	);
};

const TargetCell: FC<{config: Config; target_type: string; target_id: string; userMap: UserMap}> = ({
	config,
	target_type,
	target_id,
	userMap,
}) => {
	if (target_type === 'user') {
		const user = userMap[target_id];
		return (
			<TableCell>
				<ResourceLink config={config} resourceType="user" resourceId={target_id}>
					<VStack gap={0}>
						<Text size="sm" weight="medium">
							{user ? formatUserTag(user.username, user.discriminator) : 'Unknown User'}
						</Text>
						<Text size="xs" color="muted">
							{target_id}
						</Text>
					</VStack>
				</ResourceLink>
			</TableCell>
		);
	}

	if (target_type === 'guild') {
		return (
			<TableCell>
				<ResourceLink config={config} resourceType="guild" resourceId={target_id}>
					<VStack gap={0}>
						<Text size="sm" weight="medium">
							Guild
						</Text>
						<Text size="xs" color="muted">
							{target_id}
						</Text>
					</VStack>
				</ResourceLink>
			</TableCell>
		);
	}

	return (
		<TableCell>
			<VStack gap={0}>
				<Text size="sm" weight="medium">
					{capitalise(target_type)}
				</Text>
				<Text size="xs" color="muted">
					{target_id}
				</Text>
			</VStack>
		</TableCell>
	);
};

const DetailsExpanded: FC<{reason: string | null; metadata: Record<string, string>}> = ({reason, metadata}) => {
	const entries = Object.entries(metadata);
	const hasContent = reason || entries.length > 0;

	if (!hasContent) {
		return (
			<Text size="sm" color="muted" class="italic">
				No additional details
			</Text>
		);
	}

	return (
		<VStack gap={3}>
			{reason && (
				<HStack gap={2} align="start">
					<Text size="sm" weight="semibold" class="min-w-[120px]">
						Reason
					</Text>
					<Text size="sm" color="muted">
						{reason}
					</Text>
				</HStack>
			)}
			{entries.map(([key, value]) => (
				<HStack gap={2} align="start">
					<Text size="sm" weight="semibold" class="min-w-[120px]">
						{key}
					</Text>
					<Text size="sm" color="muted">
						{value}
					</Text>
				</HStack>
			))}
		</VStack>
	);
};

const LogRow: FC<{config: Config; log: AuditLog; userMap: UserMap}> = ({config, log, userMap}) => {
	const expandedId = `expanded-${log.log_id}`;
	const hasDetails = log.audit_log_reason || Object.keys(log.metadata).length > 0;

	return (
		<>
			<TableRow>
				<TableCell muted>
					<Text size="sm" class="whitespace-nowrap">
						{formatTimestampLocal(log.created_at)}
					</Text>
				</TableCell>
				<TableCell>
					<Pill label={formatAction(log.action)} tone={getActionTone(log.action)} />
				</TableCell>
				<AdminCell config={config} admin_user_id={log.admin_user_id} userMap={userMap} />
				<TargetCell config={config} target_type={log.target_type} target_id={log.target_id} userMap={userMap} />
				<TableCell muted>
					{hasDetails ? (
						<Button
							type="button"
							variant="ghost"
							size="small"
							onclick={`document.getElementById('${expandedId}').classList.toggle('hidden')`}
						>
							Show details
						</Button>
					) : (
						<Text size="sm" color="muted" class="italic">
							-
						</Text>
					)}
				</TableCell>
			</TableRow>
			{hasDetails && (
				<tr id={expandedId} class="hidden bg-neutral-50">
					<td colspan={5} class="px-6 py-4">
						<DetailsExpanded reason={log.audit_log_reason} metadata={log.metadata} />
					</td>
				</tr>
			)}
		</>
	);
};

const LogsTable: FC<{config: Config; logs: Array<AuditLog>; userMap: UserMap}> = ({config, logs, userMap}) => (
	<TableContainer>
		<Table>
			<TableHead>
				<tr>
					<TableHeaderCell label="Timestamp" />
					<TableHeaderCell label="Action" />
					<TableHeaderCell label="Admin" />
					<TableHeaderCell label="Target" />
					<TableHeaderCell label="Details" />
				</tr>
			</TableHead>
			<TableBody>
				{logs.map((log) => (
					<LogRow config={config} log={log} userMap={userMap} />
				))}
			</TableBody>
		</Table>
	</TableContainer>
);

const AuditLogsPagination: FC<{
	config: Config;
	currentPage: number;
	totalPages: number;
	query: string | undefined;
	adminUserIdFilter: string | undefined;
	targetId: string | undefined;
}> = ({config, currentPage, totalPages, query, adminUserIdFilter, targetId}) => {
	const buildUrl = (page: number) => {
		return `/audit-logs${buildPaginationUrl(page, {
			q: query,
			admin_user_id: adminUserIdFilter,
			target_id: targetId,
		})}`;
	};

	return (
		<Pagination
			currentPage={currentPage}
			totalPages={totalPages}
			buildUrlFn={buildUrl}
			basePath={config.basePath}
			previousLabel="Previous"
			nextLabel="Next"
			pageInfo={`Page ${currentPage + 1} of ${totalPages}`}
		/>
	);
};

const AuditLogsEmptyState: FC = () => (
	<EmptyState title="No audit logs found" message="Try adjusting your filters or check back later" />
);

function collectUserIds(logs: Array<AuditLog>): Array<string> {
	const ids = new Set<string>();
	for (const log of logs) {
		if (log.admin_user_id !== '') {
			ids.add(log.admin_user_id);
		}
		if (log.target_type === 'user' && log.target_id !== '') {
			ids.add(log.target_id);
		}
	}
	return Array.from(ids);
}

export async function AuditLogsPage({
	config,
	session,
	currentAdmin,
	flash,
	csrfToken,
	query,
	adminUserIdFilter,
	targetId,
	currentPage,
	assetVersion,
}: AuditLogsPageProps) {
	const limit = 50;
	const offset = currentPage * limit;

	const result = await searchAuditLogs(config, session, {
		query,
		admin_user_id: adminUserIdFilter,
		target_id: targetId,
		limit,
		offset,
	});

	const userMap: UserMap = {};
	if (result.ok && result.data.logs.length > 0) {
		const userIds = collectUserIds(result.data.logs);
		if (userIds.length > 0) {
			const usersResult = await lookupUsersByIds(config, session, userIds);
			if (usersResult.ok) {
				for (const user of usersResult.data) {
					userMap[user.id] = user;
				}
			}
		}
	}

	const content = result.ok ? (
		(() => {
			const totalPages = Math.ceil(result.data.total / limit);
			return (
				<PageLayout maxWidth="7xl">
					<VStack gap={6}>
						<PageHeader
							title="Audit Logs"
							actions={
								<Text size="sm" color="muted">
									Showing {result.data.logs.length} of {result.data.total} entries
								</Text>
							}
						/>

						<FiltersSection config={config} query={query} adminUserIdFilter={adminUserIdFilter} targetId={targetId} />

						{result.data.logs.length === 0 ? (
							<AuditLogsEmptyState />
						) : (
							<LogsTable config={config} logs={result.data.logs} userMap={userMap} />
						)}

						{result.data.total > limit && (
							<AuditLogsPagination
								config={config}
								currentPage={currentPage}
								totalPages={totalPages}
								query={query}
								adminUserIdFilter={adminUserIdFilter}
								targetId={targetId}
							/>
						)}
					</VStack>
				</PageLayout>
			);
		})()
	) : (
		<PageLayout maxWidth="7xl">
			<VStack gap={6}>
				<PageHeader title="Audit Logs" />
				<ErrorAlert error={getErrorMessage(result.error)} />
			</VStack>
		</PageLayout>
	);

	return (
		<Layout
			csrfToken={csrfToken}
			title="Audit Logs"
			activePage="audit-logs"
			config={config}
			session={session}
			currentAdmin={currentAdmin}
			flash={flash}
			assetVersion={assetVersion}
		>
			{content}
		</Layout>
	);
}
