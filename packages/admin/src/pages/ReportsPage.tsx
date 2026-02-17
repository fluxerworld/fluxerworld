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
import {type Report, searchReports} from '@fluxer/admin/src/api/Reports';
import {ErrorAlert} from '@fluxer/admin/src/components/ErrorDisplay';
import {Layout} from '@fluxer/admin/src/components/Layout';
import {PageHeader} from '@fluxer/admin/src/components/ui/Layout/PageHeader';
import {ResourceLink} from '@fluxer/admin/src/components/ui/ResourceLink';
import {Text} from '@fluxer/admin/src/components/ui/Typography';
import {buildPaginationUrl} from '@fluxer/admin/src/hooks/usePaginationUrl';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {formatTimestamp} from '@fluxer/date_utils/src/DateFormatting';
import type {Flash} from '@fluxer/hono/src/Flash';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {Pill} from '@fluxer/ui/src/components/Badge';
import {Button} from '@fluxer/ui/src/components/Button';
import {Card, CardEmpty} from '@fluxer/ui/src/components/Card';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import {Checkbox, Input, Select} from '@fluxer/ui/src/components/Form';
import {FlexRow, Stack} from '@fluxer/ui/src/components/Layout';
import {
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableHeaderCell,
	TableRow,
} from '@fluxer/ui/src/components/Table';
import type {FC} from 'hono/jsx';

const REPORT_CATEGORY_OPTIONS: Array<{value: string; label: string}> = [
	{value: 'harassment', label: 'Harassment or Bullying'},
	{value: 'hate_speech', label: 'Hate Speech'},
	{value: 'spam', label: 'Spam or Scam'},
	{value: 'illegal_activity', label: 'Illegal Activity'},
	{value: 'impersonation', label: 'Impersonation'},
	{value: 'child_safety', label: 'Child Safety Concerns'},
	{value: 'other', label: 'Other'},
	{value: 'violent_content', label: 'Violent or Graphic Content'},
	{value: 'nsfw_violation', label: 'NSFW Policy Violation'},
	{value: 'doxxing', label: 'Sharing Personal Information'},
	{value: 'self_harm', label: 'Self-Harm or Suicide'},
	{value: 'malicious_links', label: 'Malicious Links'},
	{value: 'spam_account', label: 'Spam Account'},
	{value: 'underage_user', label: 'Underage User'},
	{value: 'inappropriate_profile', label: 'Inappropriate Profile'},
	{value: 'raid_coordination', label: 'Raid Coordination'},
	{value: 'malware_distribution', label: 'Malware Distribution'},
	{value: 'extremist_community', label: 'Extremist Community'},
];

interface ReportsPageProps {
	config: Config;
	session: Session;
	currentAdmin: UserAdminResponse | undefined;
	flash: Flash | undefined;
	assetVersion: string;
	query: string | undefined;
	statusFilter: number | undefined;
	typeFilter: number | undefined;
	categoryFilter: string | undefined;
	page: number;
	limit: number;
	sort: string | undefined;
	csrfToken: string;
}

const QuickFilterChip: FC<{
	config: Config;
	label: string;
	statusFilter: number | undefined;
	typeFilter: number | undefined;
	categoryFilter: string | undefined;
	query: string | undefined;
	sort: string | undefined;
	limit: number;
}> = ({config, label, statusFilter, typeFilter, categoryFilter, query, sort, limit}) => {
	const url = `/reports${buildPaginationUrl(0, {
		q: query,
		status: statusFilter,
		type: typeFilter,
		category: categoryFilter,
		sort,
		limit,
	})}`;

	return (
		<Button href={`${config.basePath}${url}`} variant="ghost" size="small">
			{label}
		</Button>
	);
};

const SelectionToolbar: FC = () => {
	return (
		<Card padding="sm" data-report-toolbar="true">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div data-report-select-all="true">
					<Checkbox name="select-all" value="all" label="Select all on this page" />
				</div>
				<FlexRow gap="2">
					<span data-report-selected-count="true" class="text-neutral-600 text-sm">
						0 selected
					</span>
					<Button type="button" variant="success" size="small" data-report-bulk-resolve="true" disabled>
						Resolve selected
					</Button>
				</FlexRow>
			</div>
		</Card>
	);
};

const Filters: FC<{
	config: Config;
	query: string | undefined;
	statusFilter: number | undefined;
	typeFilter: number | undefined;
	categoryFilter: string | undefined;
	sort: string | undefined;
	limit: number;
}> = ({config, query, statusFilter, typeFilter, categoryFilter, sort, limit}) => {
	const statusOptions = [
		{value: '', label: 'All'},
		{value: '0', label: 'Pending'},
		{value: '1', label: 'Resolved'},
	];

	const typeOptions = [
		{value: '', label: 'All'},
		{value: '0', label: 'Message'},
		{value: '1', label: 'User'},
		{value: '2', label: 'Guild'},
	];

	const categoryOptions = [{value: '', label: 'All'}, ...REPORT_CATEGORY_OPTIONS];

	const sortOptions = [
		{value: 'reported_at_desc', label: 'Newest first'},
		{value: 'reported_at_asc', label: 'Oldest first'},
		{value: 'status_asc', label: 'Status ascending'},
		{value: 'status_desc', label: 'Status descending'},
	];

	const limitOptions = [
		{value: '25', label: '25'},
		{value: '50', label: '50'},
		{value: '100', label: '100'},
		{value: '150', label: '150'},
	];

	return (
		<Card padding="md">
			<form method="get">
				<Stack gap="4">
					<FlexRow gap="2">
						<QuickFilterChip
							config={config}
							label="Pending"
							statusFilter={0}
							typeFilter={typeFilter}
							categoryFilter={categoryFilter}
							query={query}
							sort={sort}
							limit={limit}
						/>
						<QuickFilterChip
							config={config}
							label="Resolved"
							statusFilter={1}
							typeFilter={typeFilter}
							categoryFilter={categoryFilter}
							query={query}
							sort={sort}
							limit={limit}
						/>
						<QuickFilterChip
							config={config}
							label="Message"
							statusFilter={statusFilter}
							typeFilter={0}
							categoryFilter={categoryFilter}
							query={query}
							sort={sort}
							limit={limit}
						/>
						<QuickFilterChip
							config={config}
							label="User"
							statusFilter={statusFilter}
							typeFilter={1}
							categoryFilter={categoryFilter}
							query={query}
							sort={sort}
							limit={limit}
						/>
						<QuickFilterChip
							config={config}
							label="Guild"
							statusFilter={statusFilter}
							typeFilter={2}
							categoryFilter={categoryFilter}
							query={query}
							sort={sort}
							limit={limit}
						/>
					</FlexRow>
					<Input
						label="Search"
						name="q"
						id="reports-search"
						type="text"
						value={query ?? ''}
						placeholder="Search by ID, reporter, category, or description..."
					/>
					<div class="grid grid-cols-1 gap-4 md:grid-cols-4">
						<Select
							label="Status"
							name="status"
							id="reports-status"
							value={statusFilter?.toString() ?? ''}
							options={statusOptions}
						/>
						<Select
							label="Type"
							name="type"
							id="reports-type"
							value={typeFilter?.toString() ?? ''}
							options={typeOptions}
						/>
						<Select
							label="Category"
							name="category"
							id="reports-category"
							value={categoryFilter ?? ''}
							options={categoryOptions}
						/>
						<Select
							label="Sort"
							name="sort"
							id="reports-sort"
							value={sort ?? 'reported_at_desc'}
							options={sortOptions}
						/>
						<Select label="Page size" name="limit" id="reports-limit" value={limit.toString()} options={limitOptions} />
					</div>
					<FlexRow gap="2">
						<Button type="submit" variant="primary">
							Search & Filter
						</Button>
						<Button href={`${config.basePath}/reports`} variant="secondary">
							Clear
						</Button>
					</FlexRow>
				</Stack>
			</form>
		</Card>
	);
};

function formatReportType(reportType: number): string {
	switch (reportType) {
		case 0:
			return 'Message';
		case 1:
			return 'User';
		case 2:
			return 'Guild';
		default:
			return 'Unknown';
	}
}

function getReportTypeTone(reportType: number): 'info' | 'purple' | 'orange' | 'neutral' {
	switch (reportType) {
		case 0:
			return 'info';
		case 1:
			return 'purple';
		case 2:
			return 'orange';
		default:
			return 'neutral';
	}
}

function formatUserTag(report: Report): string {
	if (report.reported_user_tag) {
		return report.reported_user_tag;
	}
	if (report.reported_user_username) {
		const discriminator = report.reported_user_discriminator ?? '0000';
		return `${report.reported_user_username}#${discriminator}`;
	}
	return `User ${report.reported_user_id ?? 'unknown'}`;
}

const ReporterCell: FC<{config: Config; report: Report}> = ({config, report}) => {
	const primary = report.reporter_tag ?? report.reporter_email ?? 'Anonymous';
	const detailValues: Array<string> = [];
	if (report.reporter_full_legal_name) detailValues.push(report.reporter_full_legal_name);
	if (report.reporter_country_of_residence) detailValues.push(report.reporter_country_of_residence);

	return (
		<div class="flex flex-col gap-1">
			{report.reporter_id ? (
				<ResourceLink config={config} resourceType="user" resourceId={report.reporter_id}>
					{primary}
				</ResourceLink>
			) : (
				<span class="text-neutral-900 text-sm">{primary}</span>
			)}
			{detailValues.length > 0 && (
				<div class="flex flex-col gap-1 text-neutral-500 text-xs">
					{detailValues.map((value) => (
						<div>{value}</div>
					))}
				</div>
			)}
		</div>
	);
};

const ReportedUserCell: FC<{config: Config; report: Report}> = ({config, report}) => {
	const primaryText = formatUserTag(report);
	if (report.reported_user_id) {
		return (
			<ResourceLink config={config} resourceType="user" resourceId={report.reported_user_id}>
				{primaryText}
			</ResourceLink>
		);
	}
	return <span class="text-neutral-900 text-sm">{primaryText}</span>;
};

const ReportedGuildCell: FC<{config: Config; report: Report}> = ({config, report}) => {
	if (!report.reported_guild_id) {
		return <span class="text-neutral-400 text-sm italic">{'\u2014'}</span>;
	}

	const primaryName = report.reported_guild_name ?? `Guild ${report.reported_guild_id}`;

	return (
		<div class="flex flex-col gap-1">
			<ResourceLink config={config} resourceType="guild" resourceId={report.reported_guild_id}>
				{primaryName}
			</ResourceLink>
			{report.reported_guild_invite_code && (
				<div class="text-neutral-500 text-xs">Invite: {report.reported_guild_invite_code}</div>
			)}
		</div>
	);
};

const ReportedCell: FC<{config: Config; report: Report}> = ({config, report}) => {
	switch (report.report_type) {
		case 0:
		case 1:
			return <ReportedUserCell config={config} report={report} />;
		case 2:
			return <ReportedGuildCell config={config} report={report} />;
		default:
			return <span class="text-neutral-400 text-sm italic">Unknown</span>;
	}
};

const StatusPill: FC<{reportId: string; status: number}> = ({reportId, status}) => {
	const label = status === 0 ? 'Pending' : status === 1 ? 'Resolved' : 'Unknown';
	const tone = status === 0 ? 'warning' : status === 1 ? 'success' : 'neutral';

	return (
		<span data-status-pill={reportId}>
			<Pill label={label} tone={tone} />
		</span>
	);
};

const ActionsCell: FC<{config: Config; report: Report; csrfToken: string}> = ({config, report, csrfToken}) => {
	return (
		<Stack gap="2">
			<FlexRow gap="2">
				<Button href={`${config.basePath}/reports/${report.report_id}`} variant="primary" size="small">
					View Details
				</Button>
				{report.status === 0 && (
					<form
						method="post"
						action={`${config.basePath}/reports/${report.report_id}/resolve`}
						data-report-action="resolve"
						data-report-id={report.report_id}
						data-confirm="Resolve this report?"
						data-async="true"
					>
						<CsrfInput token={csrfToken} />
						<input type="hidden" name="_method" value="post" />
						<input type="hidden" name="public_comment" value="Resolved via reports table" />
						<Button type="submit" variant="success" size="small">
							Resolve
						</Button>
					</form>
				)}
			</FlexRow>
		</Stack>
	);
};

const ReportsTable: FC<{config: Config; reports: Array<Report>; csrfToken: string}> = ({
	config,
	reports,
	csrfToken,
}) => {
	return (
		<div data-report-table="true">
			<TableContainer>
				<Table>
					<TableHead>
						<tr>
							<th class="w-10 px-4 py-3"></th>
							<TableHeaderCell label="Reported At" />
							<TableHeaderCell label="Type" />
							<TableHeaderCell label="Category" />
							<TableHeaderCell label="Reporter" />
							<TableHeaderCell label="Reported" />
							<TableHeaderCell label="Status" />
							<TableHeaderCell label="Actions" />
						</tr>
					</TableHead>
					<TableBody>
						{reports.map((report) => (
							<TableRow>
								<td class="w-10 px-4 py-4" data-report-select={report.report_id}>
									<Checkbox name={`select-${report.report_id}`} value={report.report_id} label="" />
								</td>
								<TableCell>
									<span class="whitespace-nowrap">{formatTimestamp(report.reported_at)}</span>
								</TableCell>
								<TableCell>
									<Pill label={formatReportType(report.report_type)} tone={getReportTypeTone(report.report_type)} />
								</TableCell>
								<TableCell>{report.category}</TableCell>
								<TableCell>
									<ReporterCell config={config} report={report} />
								</TableCell>
								<TableCell>
									<ReportedCell config={config} report={report} />
								</TableCell>
								<TableCell>
									<StatusPill reportId={report.report_id} status={report.status} />
								</TableCell>
								<TableCell>
									<ActionsCell config={config} report={report} csrfToken={csrfToken} />
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</TableContainer>
		</div>
	);
};

const ReportsPagination: FC<{
	config: Config;
	total: number;
	limit: number;
	currentPage: number;
	query: string | undefined;
	statusFilter: number | undefined;
	typeFilter: number | undefined;
	categoryFilter: string | undefined;
	sort: string | undefined;
}> = ({config, total, limit, currentPage, query, statusFilter, typeFilter, categoryFilter, sort}) => {
	const totalPages = Math.ceil(total / limit);
	const hasPrevious = currentPage > 0;
	const hasNext = currentPage < totalPages - 1;

	return (
		<Stack gap="6">
			<FlexRow gap="3">
				{hasPrevious ? (
					<Button
						href={`${config.basePath}/reports${buildPaginationUrl(currentPage - 1, {
							q: query,
							status: statusFilter,
							type: typeFilter,
							category: categoryFilter,
							sort,
							limit,
						})}`}
						variant="secondary"
					>
						{'\u2190'} Previous
					</Button>
				) : (
					<Button variant="secondary" disabled>
						{'\u2190'} Previous
					</Button>
				)}
				<span class="text-neutral-600 text-sm">
					Page {currentPage + 1} of {totalPages}
				</span>
				{hasNext ? (
					<Button
						href={`${config.basePath}/reports${buildPaginationUrl(currentPage + 1, {
							q: query,
							status: statusFilter,
							type: typeFilter,
							category: categoryFilter,
							sort,
							limit,
						})}`}
						variant="primary"
					>
						Next {'\u2192'}
					</Button>
				) : (
					<Button variant="primary" disabled>
						Next {'\u2192'}
					</Button>
				)}
			</FlexRow>
		</Stack>
	);
};

const EmptyState: FC = () => {
	return (
		<CardEmpty>
			<Text color="muted">No reports found</Text>
			<Text size="sm" color="muted">
				Try adjusting your filters or check back later
			</Text>
		</CardEmpty>
	);
};

function sortReports(reports: Array<Report>, sort?: string): Array<Report> {
	const sortKey = sort ?? 'reported_at_desc';
	return [...reports].sort((a, b) => {
		switch (sortKey) {
			case 'reported_at_asc':
				return a.reported_at.localeCompare(b.reported_at);
			case 'status_asc':
				if (a.status !== b.status) return a.status - b.status;
				return a.reported_at.localeCompare(b.reported_at);
			case 'status_desc':
				if (a.status !== b.status) return b.status - a.status;
				return a.reported_at.localeCompare(b.reported_at);
			default:
				return b.reported_at.localeCompare(a.reported_at);
		}
	});
}

const REPORTS_SCRIPT = `
(function () {
  const table = document.querySelector('[data-report-table]');
  if (!table) return;
  const toolbar = document.querySelector('[data-report-toolbar]');
  const selectAllWrapper = toolbar?.querySelector('[data-report-select-all]') || null;
  const selectAll = selectAllWrapper?.querySelector('input[type="checkbox"]') || null;
  const countEl = toolbar?.querySelector('[data-report-selected-count]') || null;
  const bulkBtn = toolbar?.querySelector('[data-report-bulk-resolve]') || null;

  function showToast(message, ok) {
    const box = document.createElement('div');
    box.className = 'fixed left-4 right-4 bottom-4 z-50';
    box.innerHTML =
      '<div class="max-w-xl mx-auto">' +
      '<div class="px-4 py-3 rounded-lg shadow border ' +
      (ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800') +
      '">' +
      '<div class="text-sm font-semibold">' + (ok ? 'Success' : 'Action failed') + '</div>' +
      '<div class="text-sm mt-1 break-words" data-toast-message=""></div>' +
      '</div></div>';
    const msgEl = box.querySelector('[data-toast-message]');
    if (msgEl) msgEl.textContent = message || (ok ? 'Done' : 'Action failed');
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 4000);
  }

  function selectionBoxes() {
    return Array.from(table.querySelectorAll('[data-report-select] input[type="checkbox"]'));
  }

  function updateSelection() {
    const boxes = selectionBoxes();
    const selected = boxes.filter((b) => b.checked);
    if (countEl) countEl.textContent = selected.length + ' selected';
    if (bulkBtn) bulkBtn.disabled = selected.length === 0;
    if (selectAll) {
      selectAll.checked = selected.length > 0 && selected.length === boxes.length;
      selectAll.indeterminate = selected.length > 0 && selected.length < boxes.length;
    }
  }

  function setLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
      btn.dataset.originalText = btn.textContent;
      btn.textContent = 'Working...';
    } else if (btn.dataset.originalText) {
      btn.textContent = btn.dataset.originalText;
    }
  }

  async function submitForm(form) {
    const actionUrl = new URL(form.action, window.location.origin);
    actionUrl.searchParams.set('background', '1');
    const fd = new FormData(form);
    const body = new URLSearchParams();
    fd.forEach((v, k) => body.append(k, v));
    const resp = await fetch(actionUrl.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: body.toString(),
      credentials: 'same-origin',
    });
    if (!resp.ok && resp.status !== 204) {
      let t = '';
      try { t = await resp.text(); } catch (_) {}
      throw new Error(t || 'Request failed (' + resp.status + ')');
    }
  }

  function markResolved(reportId) {
    const pill = table.querySelector('[data-status-pill="' + reportId + '"]');
    if (pill) {
      const inner = pill.querySelector('span');
      if (inner) {
        inner.textContent = 'Resolved';
        inner.classList.remove('bg-yellow-100', 'text-yellow-700');
        inner.classList.add('bg-green-100', 'text-green-700');
      }
    }
    const form = table.querySelector('form[data-report-id="' + reportId + '"]');
    if (form) form.remove();
  }

  async function resolveOne(reportId) {
    const form = table.querySelector('form[data-report-id="' + reportId + '"][data-report-action="resolve"]');
    if (!form) throw new Error('Missing resolve form');
    await submitForm(form);
    markResolved(reportId);
  }

  async function handleBulkResolve() {
    const boxes = selectionBoxes().filter((b) => b.checked);
    if (boxes.length === 0) return;
    if (!window.confirm('Resolve ' + boxes.length + ' report(s)?')) return;
    setLoading(bulkBtn, true);
    try {
      for (const box of boxes) {
        const wrapper = box.closest('[data-report-select]');
        const id = wrapper?.getAttribute('data-report-select');
        if (!id) continue;
        await resolveOne(id);
        box.checked = false;
      }
      showToast('Resolved ' + boxes.length + ' report(s)', true);
    } catch (err) {
      showToast(err && err.message ? err.message : String(err), false);
    } finally {
      setLoading(bulkBtn, false);
      updateSelection();
    }
  }

  function wireSelection() {
    if (selectAll) {
      selectAll.addEventListener('change', (e) => {
        selectionBoxes().forEach((b) => (b.checked = e.target.checked));
        updateSelection();
      });
    }
    table.addEventListener('change', (e) => {
      const t = e.target;
      if (t && t.matches('[data-report-select] input[type="checkbox"]')) updateSelection();
    });
    if (bulkBtn) {
      bulkBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleBulkResolve();
      });
    }
    updateSelection();
  }

  function wireAsyncForms() {
    table.querySelectorAll('form[data-async]').forEach((form) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const confirmMsg = form.getAttribute('data-confirm');
        if (confirmMsg && !window.confirm(confirmMsg)) return;
        const btn = form.querySelector('button[type="submit"]');
        const id = form.getAttribute('data-report-id') || form.querySelector('[name="report_id"]')?.value;
        setLoading(btn, true);
        submitForm(form)
          .then(() => {
            if (id) markResolved(id);
            showToast('Resolved report', true);
          })
          .catch((err) => showToast(err && err.message ? err.message : String(err), false))
          .finally(() => setLoading(btn, false));
      });
    });
  }

  wireSelection();
  wireAsyncForms();
})();
`;

const ReportsScript: FC = () => {
	return <script defer dangerouslySetInnerHTML={{__html: REPORTS_SCRIPT}} />;
};

export async function ReportsPage({
	config,
	session,
	currentAdmin,
	flash,
	assetVersion,
	query,
	statusFilter,
	typeFilter,
	categoryFilter,
	page,
	limit,
	sort,
	csrfToken,
}: ReportsPageProps) {
	const offset = page * limit;
	const result = await searchReports(config, session, query, statusFilter, typeFilter, categoryFilter, limit, offset);

	const content = result.ok ? (
		(() => {
			const sortedReports = sortReports(result.data.reports, sort);
			return (
				<div class="mx-auto max-w-7xl">
					<PageHeader
						title="Reports"
						actions={
							<Text size="sm" color="muted">
								Found {result.data.total} results (showing {sortedReports.length})
							</Text>
						}
					/>
					<Stack gap="6">
						<Filters
							config={config}
							query={query}
							statusFilter={statusFilter}
							typeFilter={typeFilter}
							categoryFilter={categoryFilter}
							sort={sort}
							limit={limit}
						/>
						{sortedReports.length === 0 ? (
							<EmptyState />
						) : (
							<Stack gap="4">
								<SelectionToolbar />
								<ReportsTable config={config} reports={sortedReports} csrfToken={csrfToken} />
								<ReportsPagination
									config={config}
									total={result.data.total}
									limit={limit}
									currentPage={page}
									query={query}
									statusFilter={statusFilter}
									typeFilter={typeFilter}
									categoryFilter={categoryFilter}
									sort={sort}
								/>
							</Stack>
						)}
					</Stack>
					<ReportsScript />
				</div>
			);
		})()
	) : (
		<div class="mx-auto max-w-7xl">
			<PageHeader title="Reports" />
			<Stack gap="6">
				<Filters
					config={config}
					query={query}
					statusFilter={statusFilter}
					typeFilter={typeFilter}
					categoryFilter={categoryFilter}
					sort={sort}
					limit={limit}
				/>
				<ErrorAlert error={getErrorMessage(result.error)} />
			</Stack>
		</div>
	);

	return (
		<Layout
			csrfToken={csrfToken}
			title="Reports"
			activePage="reports"
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
