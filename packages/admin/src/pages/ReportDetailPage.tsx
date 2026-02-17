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

import type {Report} from '@fluxer/admin/src/api/Reports';
import {Layout} from '@fluxer/admin/src/components/Layout';
import {createMessageDeletionScriptBody, MessageList} from '@fluxer/admin/src/components/MessageList';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {NavLink} from '@fluxer/admin/src/components/ui/NavLink';
import {ResourceLink} from '@fluxer/admin/src/components/ui/ResourceLink';
import {TextLink} from '@fluxer/admin/src/components/ui/TextLink';
import {Caption, Heading, Text} from '@fluxer/admin/src/components/ui/Typography';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {formatTimestamp} from '@fluxer/date_utils/src/DateFormatting';
import type {Flash} from '@fluxer/hono/src/Flash';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {Button} from '@fluxer/ui/src/components/Button';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import {FlexRow} from '@fluxer/ui/src/components/Layout';
import type {FC} from 'hono/jsx';

interface MessageContext {
	id: string;
	channel_id: string;
	guild_id: string | null;
	content: string;
	timestamp: string;
	attachments: Array<{filename: string; url: string}>;
	author_id: string;
	author_username: string;
	author_discriminator: string;
}

export interface ReportDetailPageProps {
	config: Config;
	session: Session;
	currentAdmin: UserAdminResponse | undefined;
	flash: Flash | undefined;
	assetVersion: string;
	report: Report;
	csrfToken: string;
}

function formatTimestampLocal(timestamp: string): string {
	return formatTimestamp(timestamp, 'en-US', {
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	});
}

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

function buildMessageLookupHref(config: Config, channelId: string, messageId: string | null): string {
	const params = new URLSearchParams();
	params.set('channel_id', channelId);
	params.set('context_limit', '50');
	if (messageId) {
		params.set('message_id', messageId);
	}
	return `${config.basePath}/messages?${params.toString()}`;
}

function formatReportedUserLabel(report: Report): string {
	if (report.reported_user_tag) {
		return report.reported_user_tag;
	}
	if (report.reported_user_username) {
		const discriminator = report.reported_user_discriminator ?? '0000';
		return `${report.reported_user_username}#${discriminator}`;
	}
	return `User ${report.reported_user_id ?? 'unknown'}`;
}

const InfoRow: FC<{label: string; value: string; mono?: boolean}> = ({label, value, mono}) => (
	<VStack gap={1}>
		<Caption>{label}</Caption>
		<Text size="sm" class={mono ? 'font-mono' : ''}>
			{value}
		</Text>
	</VStack>
);

const InfoRowWithLink: FC<{
	label: string;
	value: string;
	href: string;
	mono?: boolean;
}> = ({label, value, href, mono}) => (
	<VStack gap={1}>
		<Caption>{label}</Caption>
		<TextLink href={href} mono={mono} class="body-sm">
			{value}
		</TextLink>
	</VStack>
);

const InfoRowOpt: FC<{label: string; value: string | null; mono?: boolean}> = ({label, value, mono}) => (
	<VStack gap={1}>
		<Caption>{label}</Caption>
		<Text size="sm" class={mono ? 'font-mono' : ''}>
			{value ?? '\u2014'}
		</Text>
	</VStack>
);

const InfoRowOptWithLink: FC<{
	config: Config;
	label: string;
	id: string | null;
	name: string | null;
	pathFn: (id: string) => string;
	mono?: boolean;
}> = ({config, label, id, name, pathFn, mono}) => (
	<VStack gap={1}>
		<Caption>{label}</Caption>
		{id ? (
			<TextLink href={`${config.basePath}${pathFn(id)}`} mono={mono} class="body-sm">
				{name ?? id}
			</TextLink>
		) : (
			<Text size="sm" color="muted" class="italic">
				{'\u2014'}
			</Text>
		)}
	</VStack>
);

const BasicInfo: FC<{config: Config; report: Report}> = ({config, report}) => {
	const reporterPrimary = report.reporter_tag ?? report.reporter_email ?? 'Anonymous';

	return (
		<div class="rounded-lg border border-neutral-200 bg-white p-6">
			<h2 class="title-sm mb-4 text-neutral-900">Basic Information</h2>
			<dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<InfoRow label="Report ID" value={report.report_id} mono />
				<InfoRow label="Reported At" value={formatTimestampLocal(report.reported_at)} />
				<InfoRow label="Type" value={formatReportType(report.report_type)} />
				<InfoRow label="Category" value={report.category ?? ''} />
				{report.reporter_id ? (
					<InfoRowWithLink
						label="Reporter"
						value={reporterPrimary}
						href={`${config.basePath}/users/${report.reporter_id}`}
						mono
					/>
				) : (
					<InfoRow label="Reporter" value={reporterPrimary} />
				)}
				<InfoRowOpt label="Reporter Email" value={report.reporter_email} />
				<InfoRowOpt label="Full Legal Name" value={report.reporter_full_legal_name} />
				<InfoRowOpt label="Country of Residence" value={report.reporter_country_of_residence} />
				<InfoRow
					label="Status"
					value={report.status === 0 ? 'Pending' : report.status === 1 ? 'Resolved' : 'Unknown'}
				/>
			</dl>
		</div>
	);
};

const ReportedEntity: FC<{config: Config; report: Report}> = ({config, report}) => {
	const renderMessageReportEntity = () => (
		<>
			<InfoRowOptWithLink
				config={config}
				label="User"
				id={report.reported_user_id}
				name={formatReportedUserLabel(report)}
				pathFn={(id) => `/users/${id}`}
				mono
			/>
			{report.reported_message_id && report.reported_channel_id ? (
				<InfoRowWithLink
					label="Message ID"
					value={report.reported_message_id}
					href={buildMessageLookupHref(config, report.reported_channel_id, report.reported_message_id)}
					mono
				/>
			) : (
				<InfoRowOpt label="Message ID" value={report.reported_message_id} mono />
			)}
			{report.reported_channel_id ? (
				<InfoRowWithLink
					label="Channel ID"
					value={report.reported_channel_id}
					href={buildMessageLookupHref(config, report.reported_channel_id, report.reported_message_id)}
					mono
				/>
			) : (
				<InfoRowOpt label="Channel ID" value={report.reported_channel_id} mono />
			)}
			<InfoRowOpt label="Channel Name" value={report.reported_channel_name} />
			<InfoRowOptWithLink
				config={config}
				label="Guild ID"
				id={report.reported_guild_id}
				name={report.reported_guild_id}
				pathFn={(id) => `/guilds/${id}`}
				mono
			/>
			<InfoRowOpt label="Guild Invite Code" value={report.reported_guild_invite_code} />
		</>
	);

	const renderUserReportEntity = () => (
		<>
			<InfoRowOptWithLink
				config={config}
				label="User"
				id={report.reported_user_id}
				name={formatReportedUserLabel(report)}
				pathFn={(id) => `/users/${id}`}
				mono
			/>
			<InfoRowOpt label="Guild Name" value={report.reported_guild_name} />
			<InfoRowOptWithLink
				config={config}
				label="Guild ID"
				id={report.reported_guild_id}
				name={report.reported_guild_id}
				pathFn={(id) => `/guilds/${id}`}
				mono
			/>
			<InfoRowOpt label="Guild Invite Code" value={report.reported_guild_invite_code} />
		</>
	);

	const renderGuildReportEntity = () => (
		<>
			<InfoRowOptWithLink
				config={config}
				label="Guild"
				id={report.reported_guild_id}
				name={report.reported_guild_name}
				pathFn={(id) => `/guilds/${id}`}
				mono
			/>
			<InfoRowOpt label="Guild Invite Code" value={report.reported_guild_invite_code} />
		</>
	);

	return (
		<div class="rounded-lg border border-neutral-200 bg-white p-6">
			<h2 class="title-sm mb-4 text-neutral-900">Reported Entity</h2>
			<dl class="grid grid-cols-1 gap-4">
				{report.report_type === 0 && renderMessageReportEntity()}
				{report.report_type === 1 && renderUserReportEntity()}
				{report.report_type === 2 && renderGuildReportEntity()}
			</dl>
		</div>
	);
};

const MessageContextList: FC<{config: Config; messages: Array<MessageContext>}> = ({config, messages}) => {
	if (messages.length === 0) return null;

	const mappedMessages = messages.map((msg) => ({
		id: msg.id,
		content: msg.content || '',
		timestamp: formatTimestampLocal(msg.timestamp),
		author_id: msg.author_id,
		author_username: msg.author_username,
		author_discriminator: msg.author_discriminator,
		channel_id: msg.channel_id,
		guild_id: msg.guild_id,
		attachments: msg.attachments,
	}));

	return (
		<div class="rounded-lg border border-neutral-200 bg-white p-6">
			<h2 class="title-sm mb-4 text-neutral-900">Message Context</h2>
			<MessageList basePath={config.basePath} messages={mappedMessages} includeDeleteButton />
		</div>
	);
};

const AdditionalInfo: FC<{info: string}> = ({info}) => (
	<div class="rounded-lg border border-neutral-200 bg-white p-6">
		<h2 class="title-sm mb-4 text-neutral-900">Additional Information</h2>
		<p class="whitespace-pre-wrap text-neutral-700">{info}</p>
	</div>
);

const StatusCard: FC<{config: Config; report: Report}> = ({config, report}) => (
	<div class="rounded-lg border border-neutral-200 bg-white p-6">
		<h2 class="title-sm mb-4 text-neutral-900">Status</h2>
		<div class="space-y-3">
			<div class="text-center">
				{report.status === 0 && (
					<span class="subtitle rounded-lg bg-neutral-100 px-4 py-2 text-neutral-700">Pending</span>
				)}
				{report.status === 1 && <span class="subtitle rounded-lg bg-green-100 px-4 py-2 text-green-700">Resolved</span>}
				{report.status !== 0 && report.status !== 1 && (
					<span class="subtitle rounded-lg bg-neutral-100 px-4 py-2 text-neutral-700">Unknown</span>
				)}
			</div>
			{report.resolved_at && (
				<div class="body-sm text-neutral-600">
					<span class="label">Resolved At: </span>
					{formatTimestampLocal(report.resolved_at)}
				</div>
			)}
			{report.resolved_by_admin_id && (
				<div class="body-sm text-neutral-600">
					<span class="label">Resolved By: </span>
					<ResourceLink config={config} resourceType="user" resourceId={report.resolved_by_admin_id}>
						{report.resolved_by_admin_id}
					</ResourceLink>
				</div>
			)}
			{report.public_comment && (
				<div class="border-neutral-200 border-t pt-3">
					<p class="body-sm mb-2 text-neutral-700">Public Comment:</p>
					<p class="body-sm whitespace-pre-wrap text-neutral-600">{report.public_comment}</p>
				</div>
			)}
		</div>
	</div>
);

const ActionsCard: FC<{config: Config; report: Report; csrfToken: string}> = ({config, report, csrfToken}) => {
	const renderResolveButton = () => {
		if (report.status !== 0) return null;

		return (
			<form
				method="post"
				action={`${config.basePath}/reports/${report.report_id}/resolve`}
				onsubmit="return confirm('Resolve this report?')"
			>
				<CsrfInput token={csrfToken} />
				<input type="hidden" name="public_comment" value="" />
				<Button type="submit" variant="primary">
					Resolve Report
				</Button>
			</form>
		);
	};

	const renderViewReportedEntityButton = () => {
		if (report.report_type === 0 || report.report_type === 1) {
			if (report.reported_user_id) {
				return (
					<NavLink href={`${config.basePath}/users/${report.reported_user_id}`} class="block w-full text-center">
						View Reported User
					</NavLink>
				);
			}
		}
		if (report.report_type === 2) {
			if (report.reported_guild_id) {
				return (
					<NavLink href={`${config.basePath}/guilds/${report.reported_guild_id}`} class="block w-full text-center">
						View Reported Guild
					</NavLink>
				);
			}
		}
		return null;
	};

	const renderViewReporterButton = () => {
		if (!report.reporter_id) return null;

		return (
			<NavLink href={`${config.basePath}/users/${report.reporter_id}`} class="block w-full text-center">
				View Reporter
			</NavLink>
		);
	};

	const renderViewMutualDmButton = () => {
		if (report.report_type !== 1) {
			return null;
		}
		if (!report.mutual_dm_channel_id) {
			return null;
		}

		return (
			<NavLink
				href={buildMessageLookupHref(config, report.mutual_dm_channel_id, null)}
				class="block w-full text-center"
			>
				View Mutual DM Channel
			</NavLink>
		);
	};

	return (
		<div class="rounded-lg border border-neutral-200 bg-white p-6">
			<h2 class="title-sm mb-4 text-neutral-900">Actions</h2>
			<div class="space-y-3">
				{renderResolveButton()}
				{renderViewReportedEntityButton()}
				{renderViewReporterButton()}
				{renderViewMutualDmButton()}
			</div>
		</div>
	);
};

export function ReportDetailPage({
	config,
	session,
	currentAdmin,
	flash,
	assetVersion,
	report,
	csrfToken,
}: ReportDetailPageProps) {
	const messageContext = report.message_context ?? [];
	const hasMessageContext = report.report_type === 0 && messageContext.length > 0;

	return (
		<Layout
			csrfToken={csrfToken}
			title="Report Details"
			activePage="reports"
			config={config}
			session={session}
			currentAdmin={currentAdmin}
			flash={flash}
			assetVersion={assetVersion}
			extraScripts={hasMessageContext ? createMessageDeletionScriptBody(csrfToken) : undefined}
		>
			<div class="mx-auto max-w-5xl">
				<div class="mb-6">
					<FlexRow gap="4">
						<NavLink href={`${config.basePath}/reports`}>{'\u2190'} Back to Reports</NavLink>
						<Heading level={1}>Report Details</Heading>
					</FlexRow>
				</div>

				<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
					<div class="space-y-6 lg:col-span-2">
						<BasicInfo config={config} report={report} />
						<ReportedEntity config={config} report={report} />
						{hasMessageContext && <MessageContextList config={config} messages={messageContext} />}
						{report.additional_info && <AdditionalInfo info={report.additional_info} />}
					</div>
					<div class="space-y-6">
						<StatusCard config={config} report={report} />
						<ActionsCard config={config} report={report} csrfToken={csrfToken} />
					</div>
				</div>
			</div>
		</Layout>
	);
}

export function ReportDetailFragment({config, report}: {config: Config; report: Report}) {
	const messageContext = report.message_context ?? [];
	const hasMessageContext = report.report_type === 0 && messageContext.length > 0;

	return (
		<div data-report-fragment="" class="space-y-4">
			<BasicInfo config={config} report={report} />
			<ReportedEntity config={config} report={report} />
			{hasMessageContext && <MessageContextList config={config} messages={messageContext} />}
			{report.additional_info && <AdditionalInfo info={report.additional_info} />}
		</div>
	);
}
