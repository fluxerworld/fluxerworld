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

import type {EmailTemplate, EmailTemplateKey} from '@fluxer/email/src/email_i18n/EmailI18nTypes.generated';

export interface EmailTemplateVariables {
	account_disabled_suspicious: {
		username: string;
		reason: string | null;
		forgotUrl: string;
	};
	account_scheduled_deletion: {
		username: string;
		reason: string | null;
		deletionDate: Date;
		termsUrl: string;
		guidelinesUrl: string;
	};
	account_temp_banned: {
		username: string;
		reason: string | null;
		durationHours: number;
		bannedUntil: Date;
		termsUrl: string;
		guidelinesUrl: string;
	};
	donation_confirmation: {
		amount: string;
		currency: string;
		interval: string;
		manageUrl: string;
	};
	donation_magic_link: {
		manageUrl: string;
		expiresAt: Date;
	};
	dsa_report_verification: {
		code: string;
		expiresAt: Date;
	};
	email_change_new: {
		username: string;
		code: string;
		expiresAt: Date;
	};
	email_change_original: {
		username: string;
		code: string;
		expiresAt: Date;
	};
	email_change_revert: {
		username: string;
		newEmail: string;
		revertUrl: string;
	};
	email_verification: {
		username: string;
		verifyUrl: string;
	};
	gift_chargeback_notification: {
		username: string;
	};
	harvest_completed: {
		username: string;
		downloadUrl: string;
		totalMessages: number;
		fileSizeMB: number;
		expiresAt: Date;
	};
	inactivity_warning: {
		username: string;
		deletionDate: Date;
		lastActiveDate: Date;
		loginUrl: string;
	};
	ip_authorization: {
		username: string;
		authUrl: string;
		ipAddress: string;
		location: string;
	};
	password_change_verification: {
		username: string;
		code: string;
		expiresAt: Date;
	};
	password_reset: {
		username: string;
		resetUrl: string;
	};
	registration_approved: {
		username: string;
		channelsUrl: string;
	};
	report_resolved: {
		username: string;
		reportId: string;
		publicComment: string;
	};
	scheduled_deletion_notification: {
		username: string;
		deletionDate: Date;
		reason: string;
	};
	self_deletion_scheduled: {
		username: string;
		deletionDate: Date;
	};
	unban_notification: {
		username: string;
		reason: string;
	};
}

export type EmailTranslations = Partial<Record<EmailTemplateKey, EmailTemplate>>;
