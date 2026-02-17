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

export type EmailTemplateKey =
	| 'account_disabled_suspicious'
	| 'account_scheduled_deletion'
	| 'account_temp_banned'
	| 'donation_confirmation'
	| 'donation_magic_link'
	| 'dsa_report_verification'
	| 'email_change_new'
	| 'email_change_original'
	| 'email_change_revert'
	| 'email_verification'
	| 'gift_chargeback_notification'
	| 'harvest_completed'
	| 'inactivity_warning'
	| 'ip_authorization'
	| 'password_change_verification'
	| 'password_reset'
	| 'registration_approved'
	| 'report_resolved'
	| 'scheduled_deletion_notification'
	| 'self_deletion_scheduled'
	| 'unban_notification';

export interface EmailTemplate {
	subject: string;
	body: string;
}
