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

import type {Archive} from '@fluxer/admin/src/api/Archives';
import {ErrorAlert} from '@fluxer/admin/src/components/ErrorDisplay';
import {Layout} from '@fluxer/admin/src/components/Layout';
import {Badge} from '@fluxer/admin/src/components/ui/Badge';
import {PageHeader} from '@fluxer/admin/src/components/ui/Layout/PageHeader';
import {PageLayout} from '@fluxer/admin/src/components/ui/Layout/PageLayout';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Text} from '@fluxer/admin/src/components/ui/Typography';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {formatTimestamp} from '@fluxer/date_utils/src/DateFormatting';
import type {Flash} from '@fluxer/hono/src/Flash';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {Button} from '@fluxer/ui/src/components/Button';
import {EmptyState} from '@fluxer/ui/src/components/EmptyState';
import {Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow} from '@fluxer/ui/src/components/Table';
import type {FC} from 'hono/jsx';

export interface ArchivesPageProps {
	config: Config;
	session: Session;
	currentAdmin: UserAdminResponse | undefined;
	flash: Flash | undefined;
	csrfToken: string;
	subjectType: string;
	subjectId: string | undefined;
	archives: Array<Archive>;
	error: string | undefined;
	assetVersion: string;
}

function formatTimestampLocal(timestamp: string): string {
	try {
		return formatTimestamp(timestamp, 'en-US');
	} catch {
		return timestamp;
	}
}

function getStatusLabel(archive: Archive): string {
	if (archive.failed_at) {
		return 'Failed';
	}
	if (archive.completed_at) {
		return 'Completed';
	}
	return 'In Progress';
}

const ArchiveTable: FC<{archives: Array<Archive>; config: Config}> = ({archives, config}) => {
	return (
		<div class="overflow-hidden rounded-lg border border-neutral-200 bg-white">
			<Table>
				<TableHead>
					<tr>
						<TableHeaderCell label="Subject" />
						<TableHeaderCell label="Requested By" />
						<TableHeaderCell label="Requested At" />
						<TableHeaderCell label="Status" />
						<TableHeaderCell label="Actions" />
					</tr>
				</TableHead>
				<TableBody>
					{archives.map((archive) => (
						<TableRow>
							<TableCell>
								<VStack gap={0} class="whitespace-nowrap">
									<Text weight="semibold" size="sm">
										{archive.subject_type} {archive.subject_id}
									</Text>
									<Text size="xs" color="muted">
										Archive ID: {archive.archive_id}
									</Text>
								</VStack>
							</TableCell>
							<TableCell>
								<Text size="sm">{archive.requested_by}</Text>
							</TableCell>
							<TableCell>
								<Text size="sm">{formatTimestampLocal(archive.requested_at)}</Text>
							</TableCell>
							<TableCell>
								<VStack gap={1}>
									<div class="flex items-center gap-2">
										<Badge size="sm" variant="neutral">
											{getStatusLabel(archive)}
										</Badge>
										<Text size="xs" color="muted">
											{archive.progress_percent}%
										</Text>
									</div>
									{archive.progress_step && !archive.completed_at && !archive.failed_at && (
										<Text size="xs" color="muted">
											{archive.progress_step}
										</Text>
									)}
								</VStack>
							</TableCell>
							<TableCell>
								{archive.completed_at ? (
									<Button
										href={`${config.basePath}/archives/download?subject_type=${archive.subject_type}&subject_id=${archive.subject_id}&archive_id=${archive.archive_id}`}
										variant="primary"
										size="small"
									>
										Download
									</Button>
								) : (
									<Text size="sm" color="muted">
										Not ready
									</Text>
								)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
};

const ArchivesEmptyState: FC<{filterHint: string}> = ({filterHint}) => {
	return (
		<EmptyState
			title={`No archives found${filterHint}.`}
			message="This page lists all user and guild archives you've requested. Request an archive from a user or guild detail page."
		/>
	);
};

export async function ArchivesPage({
	config,
	session,
	currentAdmin,
	flash,
	csrfToken,
	subjectType,
	subjectId,
	archives,
	error,
	assetVersion,
}: ArchivesPageProps) {
	const filterHint = subjectId ? ` for ${subjectType} ${subjectId}` : '';

	return (
		<Layout
			csrfToken={csrfToken}
			title="Archives"
			activePage="archives"
			config={config}
			session={session}
			currentAdmin={currentAdmin}
			flash={flash}
			assetVersion={assetVersion}
		>
			<PageLayout maxWidth="7xl">
				<VStack gap={4}>
					<PageHeader title={`Archives${filterHint}`} />

					{error ? (
						<ErrorAlert error={error} />
					) : archives.length === 0 ? (
						<ArchivesEmptyState filterHint={filterHint} />
					) : (
						<ArchiveTable archives={archives} config={config} />
					)}
				</VStack>
			</PageLayout>
		</Layout>
	);
}
