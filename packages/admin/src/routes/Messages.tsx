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
import * as archivesApi from '@fluxer/admin/src/api/Archives';
import * as bulkApi from '@fluxer/admin/src/api/Bulk';
import {getErrorMessage} from '@fluxer/admin/src/api/Errors';
import * as messagesApi from '@fluxer/admin/src/api/Messages';
import * as systemDmApi from '@fluxer/admin/src/api/SystemDm';
import {redirectWithFlash} from '@fluxer/admin/src/middleware/Auth';
import {ArchivesPage} from '@fluxer/admin/src/pages/ArchivesPage';
import {BulkActionsPage} from '@fluxer/admin/src/pages/BulkActionsPage';
import {handleMessagesGet, MessagesPage} from '@fluxer/admin/src/pages/MessagesPage';
import {SystemDmPage} from '@fluxer/admin/src/pages/SystemDmPage';
import {getRouteContext} from '@fluxer/admin/src/routes/RouteContext';
import type {RouteFactoryDeps} from '@fluxer/admin/src/routes/RouteTypes';
import {getPageConfig} from '@fluxer/admin/src/SelfHostedOverride';
import type {AppVariables} from '@fluxer/admin/src/types/App';
import {getOptionalString, getRequiredString, getStringArray, type ParsedBody} from '@fluxer/admin/src/utils/Forms';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import {Hono} from 'hono';

function resolveArchiveSubjectType(
	requestedType: string | undefined,
	adminAcls: Array<string>,
): 'all' | 'user' | 'guild' {
	const canViewAll = hasPermission(adminAcls, AdminACLs.ARCHIVE_VIEW_ALL);
	const canViewGuild = hasPermission(adminAcls, AdminACLs.ARCHIVE_TRIGGER_GUILD);
	const canViewUser = hasPermission(adminAcls, AdminACLs.ARCHIVE_TRIGGER_USER);

	if (requestedType === 'all' && canViewAll) {
		return 'all';
	}
	if (requestedType === 'guild' && canViewGuild) {
		return 'guild';
	}
	if (requestedType === 'user' && canViewUser) {
		return 'user';
	}
	if (canViewAll) {
		return 'all';
	}
	if (canViewGuild) {
		return 'guild';
	}
	return 'user';
}

export function createMessagesRoutes({config, assetVersion, requireAuth}: RouteFactoryDeps) {
	const router = new Hono<{Variables: AppVariables}>();

	router.get('/messages', requireAuth, async (c) => {
		const {session, currentAdmin, flash, adminAcls, csrfToken} = getRouteContext(c);
		const pageConfig = getPageConfig(c, config);

		const query: Record<string, string> = {};
		const channelId = c.req.query('channel_id');
		const messageId = c.req.query('message_id');
		const attachmentId = c.req.query('attachment_id');
		const filename = c.req.query('filename');
		const contextLimit = c.req.query('context_limit');

		if (channelId) query['channel_id'] = channelId;
		if (messageId) query['message_id'] = messageId;
		if (attachmentId) query['attachment_id'] = attachmentId;
		if (filename) query['filename'] = filename;
		if (contextLimit) query['context_limit'] = contextLimit;

		const {lookupResult, prefillChannelId} = await handleMessagesGet(
			config,
			session,
			currentAdmin,
			flash,
			adminAcls,
			assetVersion,
			query,
		);

		const page = await MessagesPage({
			config: pageConfig,
			session,
			currentAdmin,
			flash,
			assetVersion,
			adminAcls,
			csrfToken,
			lookupResult,
			prefillChannelId,
		});
		return c.html(page ?? '');
	});

	router.post('/messages', requireAuth, async (c) => {
		const session = c.get('session')!;
		const action = c.req.query('action');
		const formData = (await c.req.parseBody()) as ParsedBody;

		if (action === 'lookup') {
			const channelId = getOptionalString(formData, 'channel_id') ?? '';
			const messageId = getOptionalString(formData, 'message_id') ?? '';
			const contextLimitStr = getOptionalString(formData, 'context_limit');
			const contextLimit = contextLimitStr ? parseInt(contextLimitStr, 10) || 50 : 50;

			return c.redirect(
				`${config.basePath}/messages?channel_id=${channelId}&message_id=${messageId}&context_limit=${contextLimit}`,
			);
		}

		if (action === 'lookup-by-attachment') {
			const channelId = getOptionalString(formData, 'channel_id') ?? '';
			const attachmentId = getOptionalString(formData, 'attachment_id') ?? '';
			const filename = getOptionalString(formData, 'filename') ?? '';
			const contextLimitStr = getOptionalString(formData, 'context_limit');
			const contextLimit = contextLimitStr ? parseInt(contextLimitStr, 10) || 50 : 50;

			return c.redirect(
				`${config.basePath}/messages?channel_id=${channelId}&attachment_id=${attachmentId}&filename=${filename}&context_limit=${contextLimit}`,
			);
		}

		if (action === 'delete') {
			const channelId = getRequiredString(formData, 'channel_id');
			const messageId = getRequiredString(formData, 'message_id');
			const auditLogReason = getOptionalString(formData, 'audit_log_reason') ?? '';

			if (!channelId || !messageId) {
				return c.json({success: false, error: 'Missing channel_id or message_id'}, 400);
			}

			await messagesApi.deleteMessage(config, session, channelId, messageId, auditLogReason);
			return c.json({success: true});
		}

		return c.redirect(`${config.basePath}/messages`);
	});

	router.get('/system-dms', requireAuth, async (c) => {
		const {session, currentAdmin, flash, adminAcls, csrfToken} = getRouteContext(c);
		const pageConfig = getPageConfig(c, config);

		const result = await systemDmApi.listSystemDmJobs(config, session, 20);
		const jobs = result.ok ? result.data.jobs : [];

		const page = await SystemDmPage({
			config: pageConfig,
			session,
			currentAdmin,
			flash,
			assetVersion,
			adminAcls,
			jobs,
			csrfToken,
		});
		return c.html(page ?? '');
	});

	router.post('/system-dms', requireAuth, async (c) => {
		const session = c.get('session')!;
		const redirectUrl = `${config.basePath}/system-dms`;

		try {
			const formData = (await c.req.parseBody()) as ParsedBody;
			const action = c.req.query('action');

			if (action === 'send') {
				const content = getRequiredString(formData, 'content');
				const registrationStart = getOptionalString(formData, 'registration_start');
				const registrationEnd = getOptionalString(formData, 'registration_end');
				const excludedGuildIdsInput = getOptionalString(formData, 'excluded_guild_ids');

				if (!content) {
					return redirectWithFlash(c, redirectUrl, {message: 'Message content is required', type: 'error'});
				}

				const excludedGuildIds = excludedGuildIdsInput
					? excludedGuildIdsInput
							.split(/[\n,]/)
							.map((id) => id.trim())
							.filter((id) => id !== '')
					: [];

				const result = await systemDmApi.createSystemDmJob(
					config,
					session,
					content,
					registrationStart || undefined,
					registrationEnd || undefined,
					excludedGuildIds,
				);

				return redirectWithFlash(c, redirectUrl, {
					message: result.ok ? 'System DM job created' : 'Failed to send system DM',
					type: result.ok ? 'success' : 'error',
				});
			}

			if (action === 'approve') {
				const jobId = getRequiredString(formData, 'job_id');

				if (!jobId) {
					return redirectWithFlash(c, redirectUrl, {message: 'Job ID is required', type: 'error'});
				}

				const result = await systemDmApi.approveSystemDmJob(config, session, jobId);
				return redirectWithFlash(c, redirectUrl, {
					message: result.ok ? 'System DM job approved' : 'Failed to approve system DM job',
					type: result.ok ? 'success' : 'error',
				});
			}

			return redirectWithFlash(c, redirectUrl, {message: 'Unknown action', type: 'error'});
		} catch {
			return redirectWithFlash(c, redirectUrl, {message: 'Invalid form data', type: 'error'});
		}
	});

	router.get('/archives', requireAuth, async (c) => {
		const {session, currentAdmin, flash, adminAcls, csrfToken} = getRouteContext(c);
		const pageConfig = getPageConfig(c, config);
		const requestedSubjectType = c.req.query('subject_type') ?? undefined;
		const subjectId = c.req.query('subject_id');
		const subjectType = subjectId
			? requestedSubjectType || 'user'
			: resolveArchiveSubjectType(requestedSubjectType, adminAcls);

		let archives: Array<archivesApi.Archive> = [];
		let error: string | undefined;

		if (subjectId) {
			const result = await archivesApi.listArchives(config, session, subjectType, subjectId);
			if (result.ok) {
				archives = result.data.archives;
			} else {
				error = getErrorMessage(result.error);
			}
		} else if (currentAdmin?.id) {
			const result = await archivesApi.listArchives(config, session, subjectType, undefined, false, currentAdmin.id);
			if (result.ok) {
				archives = result.data.archives;
			} else {
				error = getErrorMessage(result.error);
			}
		} else {
			error = 'Failed to load archives';
		}

		const page = await ArchivesPage({
			config: pageConfig,
			session,
			currentAdmin,
			flash,
			assetVersion,
			csrfToken,
			subjectType,
			subjectId,
			archives,
			error,
		});
		return c.html(page ?? '');
	});

	router.get('/archives/download', requireAuth, async (c) => {
		const session = c.get('session')!;
		const subjectType = c.req.query('subject_type');
		const subjectId = c.req.query('subject_id');
		const archiveId = c.req.query('archive_id');

		if (!subjectType || !subjectId || !archiveId) {
			return c.redirect(`${config.basePath}/archives`);
		}

		const result = await archivesApi.getArchiveDownloadUrl(config, session, subjectType, subjectId, archiveId);
		if (result.ok && result.data.downloadUrl) {
			return c.redirect(result.data.downloadUrl);
		}

		return redirectWithFlash(c, `${config.basePath}/archives?subject_type=${subjectType}&subject_id=${subjectId}`, {
			message: 'Failed to get archive download URL',
			type: 'error',
		});
	});

	router.get('/bulk-actions', requireAuth, async (c) => {
		const {session, currentAdmin, flash, adminAcls, csrfToken} = getRouteContext(c);
		const pageConfig = getPageConfig(c, config);

		return c.html(
			<BulkActionsPage
				config={pageConfig}
				session={session}
				currentAdmin={currentAdmin}
				flash={flash}
				assetVersion={assetVersion}
				adminAcls={adminAcls}
				csrfToken={csrfToken}
			/>,
		);
	});

	router.post('/bulk-actions', requireAuth, async (c) => {
		const session = c.get('session')!;
		const action = c.req.query('action');
		const formData = (await c.req.parseBody()) as ParsedBody;

		if (action === 'bulk-update-user-flags') {
			const userIdsText = getRequiredString(formData, 'user_ids');
			if (!userIdsText) {
				return c.redirect(`${config.basePath}/bulk-actions`);
			}
			const addFlags = getStringArray(formData, 'add_flags[]');
			const removeFlags = getStringArray(formData, 'remove_flags[]');
			const auditLogReason = getOptionalString(formData, 'audit_log_reason') ?? '';

			const userIds = userIdsText
				.split('\n')
				.map((id) => id.trim())
				.filter(Boolean);
			await bulkApi.bulkUpdateUserFlags(config, session, userIds, addFlags, removeFlags, auditLogReason);

			return c.redirect(`${config.basePath}/bulk-actions`);
		}

		if (action === 'bulk-update-guild-features') {
			const guildIdsText = getRequiredString(formData, 'guild_ids');
			if (!guildIdsText) {
				return c.redirect(`${config.basePath}/bulk-actions`);
			}
			const addFeatures = getStringArray(formData, 'add_features[]');
			const removeFeatures = getStringArray(formData, 'remove_features[]');
			const customAddFeatures = getOptionalString(formData, 'custom_add_features') ?? '';
			const customRemoveFeatures = getOptionalString(formData, 'custom_remove_features') ?? '';
			const auditLogReason = getOptionalString(formData, 'audit_log_reason') ?? '';

			const guildIds = guildIdsText
				.split('\n')
				.map((id) => id.trim())
				.filter(Boolean);
			const allAddFeatures = [
				...addFeatures,
				...customAddFeatures
					.split(',')
					.map((f) => f.trim())
					.filter(Boolean),
			];
			const allRemoveFeatures = [
				...removeFeatures,
				...customRemoveFeatures
					.split(',')
					.map((f) => f.trim())
					.filter(Boolean),
			];

			await bulkApi.bulkUpdateGuildFeatures(
				config,
				session,
				guildIds,
				allAddFeatures,
				allRemoveFeatures,
				auditLogReason,
			);
			return c.redirect(`${config.basePath}/bulk-actions`);
		}

		if (action === 'bulk-add-guild-members') {
			const guildId = getRequiredString(formData, 'guild_id');
			const userIdsText = getRequiredString(formData, 'user_ids');
			const auditLogReason = getOptionalString(formData, 'audit_log_reason') ?? '';

			if (!guildId || !userIdsText) {
				return c.redirect(`${config.basePath}/bulk-actions`);
			}

			const userIds = userIdsText
				.split('\n')
				.map((id) => id.trim())
				.filter(Boolean);
			await bulkApi.bulkAddGuildMembers(config, session, guildId, userIds, auditLogReason);
			return c.redirect(`${config.basePath}/bulk-actions`);
		}

		if (action === 'bulk-schedule-user-deletion') {
			const userIdsText = getRequiredString(formData, 'user_ids');
			const reasonCodeStr = getOptionalString(formData, 'reason_code');
			const daysUntilDeletionStr = getOptionalString(formData, 'days_until_deletion');
			const publicReason = getOptionalString(formData, 'public_reason') ?? '';
			const auditLogReason = getOptionalString(formData, 'audit_log_reason') ?? '';

			if (!userIdsText) {
				return c.redirect(`${config.basePath}/bulk-actions`);
			}

			const reasonCode = reasonCodeStr ? parseInt(reasonCodeStr, 10) : 0;
			const daysUntilDeletion = daysUntilDeletionStr ? parseInt(daysUntilDeletionStr, 10) : 30;

			const userIds = userIdsText
				.split('\n')
				.map((id) => id.trim())
				.filter(Boolean);
			await bulkApi.bulkScheduleUserDeletion(
				config,
				session,
				userIds,
				reasonCode,
				daysUntilDeletion,
				publicReason,
				auditLogReason,
			);
			return c.redirect(`${config.basePath}/bulk-actions`);
		}

		return c.redirect(`${config.basePath}/bulk-actions`);
	});

	return router;
}
