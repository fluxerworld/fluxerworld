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

import {ErrorAlert} from '@fluxer/admin/src/components/ErrorDisplay';
import {Layout} from '@fluxer/admin/src/components/Layout';
import {FormFieldGroup} from '@fluxer/admin/src/components/ui/Form/FormFieldGroup';
import {Grid} from '@fluxer/admin/src/components/ui/Grid';
import {InlineStack} from '@fluxer/admin/src/components/ui/InlineStack';
import {Input} from '@fluxer/admin/src/components/ui/Input';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Stack} from '@fluxer/admin/src/components/ui/Stack';
import {Textarea} from '@fluxer/admin/src/components/ui/Textarea';
import {Caption, Heading, Text} from '@fluxer/admin/src/components/ui/Typography';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import type {Flash} from '@fluxer/hono/src/Flash';
import type {SystemDmJobResponse} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {Pill} from '@fluxer/ui/src/components/Badge';
import {Button} from '@fluxer/ui/src/components/Button';
import {Card} from '@fluxer/ui/src/components/Card';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import {EmptyState} from '@fluxer/ui/src/components/EmptyState';
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
import type {FC} from 'hono/jsx';

const PAGE_PATH = '/system-dms';

interface SystemDmPageProps {
	config: Config;
	session: Session;
	currentAdmin: UserAdminResponse | undefined;
	flash: Flash | undefined;
	adminAcls: Array<string>;
	jobs: Array<SystemDmJobResponse>;
	nextCursor?: string | undefined;
	loadError?: string | undefined;
	formError?: string | undefined;
	assetVersion: string;
	csrfToken: string;
}

function getStatusTone(status: string): ColorTone {
	switch (status) {
		case 'pending':
			return 'neutral';
		case 'approved':
			return 'info';
		case 'running':
			return 'success';
		case 'completed':
			return 'success';
		case 'failed':
			return 'danger';
		default:
			return 'neutral';
	}
}

const JobFilters: FC<{job: SystemDmJobResponse}> = ({job}) => {
	let registration: string;
	if (job.registration_start && job.registration_end) {
		registration = `${job.registration_start} -> ${job.registration_end}`;
	} else if (job.registration_start) {
		registration = `From ${job.registration_start}`;
	} else if (job.registration_end) {
		registration = `Until ${job.registration_end}`;
	} else {
		registration = 'Any time';
	}

	return (
		<Stack gap="sm">
			<Caption>Registration: {registration}</Caption>
			{job.excluded_guild_ids.length > 0 && <Caption>Excluded guilds: {job.excluded_guild_ids.join(', ')}</Caption>}
		</Stack>
	);
};

const JobTimestamps: FC<{job: SystemDmJobResponse}> = ({job}) => {
	return (
		<Stack gap="sm">
			<Caption>Created: {job.created_at}</Caption>
			{job.approved_at ? <Caption>Approved: {job.approved_at}</Caption> : <Caption>Awaiting approval</Caption>}
		</Stack>
	);
};

const JobActions: FC<{job: SystemDmJobResponse; config: Config; csrfToken: string}> = ({job, config, csrfToken}) => {
	if (job.status !== 'pending') return null;

	return (
		<form method="post" action={`${config.basePath}${PAGE_PATH}?action=approve`}>
			<CsrfInput token={csrfToken} />
			<input type="hidden" name="job_id" value={job.job_id} />
			<Button type="submit" variant="success" fullWidth>
				Approve
			</Button>
		</form>
	);
};

const JobTableRows: FC<{jobs: Array<SystemDmJobResponse>; config: Config; csrfToken: string}> = ({
	jobs,
	config,
	csrfToken,
}) => {
	return (
		<>
			{jobs.map((job) => (
				<TableRow>
					<TableCell>{job.job_id}</TableCell>
					<TableCell>
						<Pill label={job.status} tone={getStatusTone(job.status)} />
					</TableCell>
					<TableCell>
						<VStack gap={1}>
							<Text size="sm">{job.target_count} recipients</Text>
							<Text size="sm" color="muted">
								{job.sent_count} sent, {job.failed_count} failed
							</Text>
						</VStack>
					</TableCell>
					<TableCell>
						<JobFilters job={job} />
					</TableCell>
					<TableCell>
						<JobTimestamps job={job} />
					</TableCell>
					<TableCell>
						<JobActions job={job} config={config} csrfToken={csrfToken} />
					</TableCell>
				</TableRow>
			))}
		</>
	);
};

export async function SystemDmPage({
	config,
	session,
	currentAdmin,
	flash,
	adminAcls: _adminAcls,
	jobs,
	nextCursor,
	loadError,
	formError,
	assetVersion,
	csrfToken,
}: SystemDmPageProps) {
	return (
		<Layout
			csrfToken={csrfToken}
			title="System DMs"
			activePage="system-dms"
			config={config}
			session={session}
			currentAdmin={currentAdmin}
			flash={flash}
			assetVersion={assetVersion}
		>
			<Stack gap="lg">
				<Heading level={1}>System DMs</Heading>

				<Card padding="lg">
					<Stack gap="md">
						<Heading level={2} size="base">
							Schedule a system DM
						</Heading>
						{formError && <ErrorAlert error={formError} />}
						<form method="post" action={`${config.basePath}${PAGE_PATH}?action=send`}>
							<CsrfInput token={csrfToken} />
							<Stack gap="md">
								<FormFieldGroup label="Content" htmlFor="system-dm-content">
									<Textarea id="system-dm-content" name="content" required rows={6} maxlength={4000} size="sm" />
								</FormFieldGroup>
								<Grid cols={2} gap="md">
									<FormFieldGroup label="Registration start" htmlFor="system-dm-registration-start">
										<Input
											id="system-dm-registration-start"
											type="datetime-local"
											name="registration_start"
											size="sm"
										/>
									</FormFieldGroup>
									<FormFieldGroup label="Registration end" htmlFor="system-dm-registration-end">
										<Input id="system-dm-registration-end" type="datetime-local" name="registration_end" size="sm" />
									</FormFieldGroup>
								</Grid>
								<FormFieldGroup
									label="Exclude guild IDs"
									helper="Separate IDs with commas."
									htmlFor="system-dm-excluded-guild-ids"
								>
									<Textarea
										id="system-dm-excluded-guild-ids"
										name="excluded_guild_ids"
										rows={3}
										placeholder="12345,67890"
										size="sm"
									/>
								</FormFieldGroup>
								<Button type="submit" variant="primary" fullWidth>
									Create job
								</Button>
							</Stack>
						</form>
					</Stack>
				</Card>

				<Card padding="lg">
					<Stack gap="md">
						<Heading level={2} size="base">
							Job history
						</Heading>
						{loadError && <ErrorAlert error={loadError} />}
						<TableContainer>
							<Table>
								<TableHead>
									<tr>
										<TableHeaderCell label="Job" />
										<TableHeaderCell label="Status" />
										<TableHeaderCell label="Targets" />
										<TableHeaderCell label="Filters" />
										<TableHeaderCell label="Timestamps" />
										<TableHeaderCell label="Actions" />
									</tr>
								</TableHead>
								<TableBody>
									{jobs.length === 0 ? (
										<tr>
											<td colSpan={6} class="px-6 py-4 text-center">
												<EmptyState title="No system DM jobs have been created yet." />
											</td>
										</tr>
									) : (
										<JobTableRows jobs={jobs} config={config} csrfToken={csrfToken} />
									)}
								</TableBody>
							</Table>
						</TableContainer>
						{nextCursor && (
							<InlineStack gap={0} class="mt-4 justify-end">
								<a
									href={`${config.basePath}${PAGE_PATH}?before_job_id=${nextCursor}`}
									class="font-medium text-neutral-900 text-sm hover:underline"
								>
									Load older jobs
								</a>
							</InlineStack>
						)}
					</Stack>
				</Card>
			</Stack>
		</Layout>
	);
}

export function parseExcludedGuildIds(value?: string): Array<string> {
	if (!value) return [];
	return value
		.trim()
		.replace(/\n/g, ',')
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry !== '');
}
