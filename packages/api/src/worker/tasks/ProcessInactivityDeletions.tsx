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

import type {UserID} from '@fluxer/api/src/BrandedTypes';
import {Config} from '@fluxer/api/src/Config';
import type {KVActivityTracker} from '@fluxer/api/src/infrastructure/KVActivityTracker';
import {Logger} from '@fluxer/api/src/Logger';
import type {User} from '@fluxer/api/src/models/User';
import type {UserRepository} from '@fluxer/api/src/user/repositories/UserRepository';
import type {UserDeletionEligibilityService} from '@fluxer/api/src/user/services/UserDeletionEligibilityService';
import {getWorkerDependencies} from '@fluxer/api/src/worker/WorkerContext';
import {DeletionReasons} from '@fluxer/constants/src/Core';
import {UserFlags} from '@fluxer/constants/src/UserConstants';
import type {IEmailService} from '@fluxer/email/src/IEmailService';
import {TestEmailService} from '@fluxer/email/src/TestEmailService';
import type {IKVProvider} from '@fluxer/kv_client/src/IKVProvider';
import type {WorkerTaskHandler} from '@fluxer/worker/src/contracts/WorkerTask';
import {ms} from 'itty-time';

const BATCH_SIZE = 100;

export interface InactivityCheckResult {
	warningsSent: number;
	deletionsScheduled: number;
	errors: number;
}

async function scheduleDeletion(userRepository: UserRepository, user: User, userId: UserID): Promise<void> {
	const gracePeriodMs = Config.deletionGracePeriodHours * ms('1 hour');
	const pendingDeletionAt = new Date(Date.now() + gracePeriodMs);

	await userRepository.patchUpsert(
		userId,
		{
			flags: user.flags | UserFlags.SELF_DELETED,
			pending_deletion_at: pendingDeletionAt,
		},
		user.toRow(),
	);

	await userRepository.addPendingDeletion(userId, pendingDeletionAt, DeletionReasons.INACTIVITY);

	Logger.debug({userId, pendingDeletionAt, reason: 'INACTIVITY'}, 'Scheduled inactive user for deletion');
}

interface ProcessUserDeps {
	userRepository: UserRepository;
	emailService: IEmailService;
	activityTracker: KVActivityTracker;
	deletionEligibilityService: UserDeletionEligibilityService;
}

async function processUser(user: User, deps: ProcessUserDeps, result: InactivityCheckResult): Promise<void> {
	const {userRepository, emailService, activityTracker, deletionEligibilityService} = deps;
	const userId = user.id;

	if (user.pendingDeletionAt) {
		Logger.debug({userId}, 'User already pending deletion, skipping');
		return;
	}

	if (user.isBot) {
		Logger.debug({userId}, 'User is a bot, skipping');
		return;
	}

	if (user.flags & UserFlags.APP_STORE_REVIEWER) {
		Logger.debug({userId}, 'User is an app store reviewer, skipping');
		return;
	}

	const lastActivity = await activityTracker.getActivity(userId);
	const now = new Date();
	const userInactiveMs = lastActivity ? now.getTime() - lastActivity.getTime() : Infinity;

	if (userInactiveMs < ms('2 years')) {
		return;
	}

	const isEligible = await deletionEligibilityService.isEligibleForInactivityDeletion(user);

	if (!isEligible) {
		Logger.debug({userId}, 'User not eligible for inactivity deletion');
		return;
	}

	const hasWarningSent = await deletionEligibilityService.hasWarningSent(userId);

	if (hasWarningSent) {
		const hasGracePeriodExpired = await deletionEligibilityService.hasWarningGracePeriodExpired(userId);

		if (hasGracePeriodExpired) {
			Logger.debug({userId}, 'Warning grace period expired, scheduling deletion');
			await scheduleDeletion(userRepository, user, userId);
			result.deletionsScheduled++;
		} else {
			Logger.debug({userId}, 'Warning grace period still active, skipping (idempotency check)');
		}
		return;
	}

	const isTestRun = Config.dev.testModeEnabled;
	const usingTestEmailService = emailService instanceof TestEmailService;
	const canSendEmail = !!user.email && (Config.email.enabled || usingTestEmailService || isTestRun);

	if (!canSendEmail) {
		return;
	}

	try {
		const deletionDate = new Date(now.getTime() + ms('30 days'));
		const sent = await emailService.sendInactivityWarningEmail(
			user.email,
			user.username,
			deletionDate,
			lastActivity || new Date(0),
			user.locale,
		);

		if (sent) {
			await deletionEligibilityService.markWarningSent(userId);
			result.warningsSent++;
			Logger.debug({userId, email: user.email}, 'Sent inactivity warning email');
		}
	} catch (emailError) {
		Logger.error({error: emailError, userId, email: user.email}, 'Failed to send inactivity warning email');
		result.errors++;
	}
}

interface ProcessInactivityDeletionsDeps {
	kvClient: IKVProvider;
	userRepository: UserRepository;
	emailService: IEmailService;
	activityTracker: KVActivityTracker;
	deletionEligibilityService: UserDeletionEligibilityService;
}

export async function processInactivityDeletionsCore(
	deps: ProcessInactivityDeletionsDeps,
): Promise<InactivityCheckResult> {
	const {userRepository, emailService, activityTracker, deletionEligibilityService} = deps;

	const result: InactivityCheckResult = {
		warningsSent: 0,
		deletionsScheduled: 0,
		errors: 0,
	};

	Logger.debug('Starting inactivity deletion check');

	const needsRebuild = await activityTracker.needsRebuild();
	if (needsRebuild) {
		Logger.info('Activity tracker needs rebuild, rebuilding from Cassandra');
		await activityTracker.rebuildActivities();
	}

	const userDeps: ProcessUserDeps = {userRepository, emailService, activityTracker, deletionEligibilityService};
	let lastUserId: UserID | undefined;
	let processedUsers = 0;

	while (true) {
		const users = await userRepository.listAllUsersPaginated(BATCH_SIZE, lastUserId);

		if (users.length === 0) {
			break;
		}

		for (const user of users) {
			try {
				await processUser(user, userDeps, result);
			} catch (userError) {
				Logger.error({error: userError, userId: user.id}, 'Failed to process inactive user');
				result.errors++;
			}
		}

		processedUsers += users.length;
		lastUserId = users[users.length - 1]!.id;

		if (processedUsers % 1000 === 0) {
			Logger.debug(
				{processedUsers, warningsSent: result.warningsSent, deletionsScheduled: result.deletionsScheduled},
				'Inactivity deletion progress',
			);
		}
	}

	Logger.info(
		{
			processedUsers,
			warningsSent: result.warningsSent,
			deletionsScheduled: result.deletionsScheduled,
			errors: result.errors,
		},
		'Completed inactivity deletion processing',
	);

	return result;
}

const processInactivityDeletions: WorkerTaskHandler = async (_payload, helpers) => {
	helpers.logger.debug('Processing processInactivityDeletions task');

	const {kvClient, userRepository, emailService, activityTracker, deletionEligibilityService} = getWorkerDependencies();

	await processInactivityDeletionsCore({
		kvClient,
		userRepository,
		emailService,
		activityTracker,
		deletionEligibilityService,
	});
};

export default processInactivityDeletions;
