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

export const FLUXER_EPOCH = 1420070400000;
export const FLUXER_USER_AGENT = 'Mozilla/5.0 (compatible; Fluxerbot/1.0; +https://fluxer.app)';

export const ADMIN_OAUTH2_APPLICATION_ID = 1234567890123456789n;

export const USER_MENTION_REGEX = /<@!?(?<userId>\d+)>/g;
export const ROLE_MENTION_REGEX = /<@&(?<roleId>\d+)>/g;
export const URL_REGEX = /https?:\/\/[^\s/$.?#].[^\s]*/g;

export const DeletionReasons = {
	USER_REQUESTED: 1,
	OTHER: 2,
	SPAM: 3,
	CHEATING_OR_EXPLOITATION: 4,
	COORDINATED_RAIDING: 5,
	AUTOMATION_OR_SELFBOT: 6,
	NONCONSENSUAL_SEXUAL_CONTENT: 7,
	SCAM_OR_SOCIAL_ENGINEERING: 8,
	CHILD_SEXUAL_CONTENT: 9,
	PRIVACY_VIOLATION_OR_DOXXING: 10,
	HARASSMENT_OR_BULLYING: 11,
	PAYMENT_FRAUD: 12,
	CHILD_SAFETY_VIOLATION: 13,
	BILLING_DISPUTE_OR_ABUSE: 14,
	UNSOLICITED_EXPLICIT_CONTENT: 15,
	GRAPHIC_VIOLENCE: 16,
	BAN_EVASION: 17,
	TOKEN_OR_CREDENTIAL_SCAM: 18,
	INACTIVITY: 19,
	HATE_SPEECH_OR_EXTREMIST_CONTENT: 20,
	MALICIOUS_LINKS_OR_MALWARE: 21,
	IMPERSONATION_OR_FAKE_IDENTITY: 22,
} as const;
