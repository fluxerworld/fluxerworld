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

import {DeletionReasons} from '@fluxer/constants/src/Core';
import {createInt32EnumType, withOpenApiType} from '@fluxer/schema/src/primitives/SchemaPrimitives';

export const DeletionReasonSchema = withOpenApiType(
	createInt32EnumType(
		[
			[DeletionReasons.USER_REQUESTED, 'USER_REQUESTED', 'User requested account deletion'],
			[DeletionReasons.OTHER, 'OTHER', 'Other reason'],
			[DeletionReasons.SPAM, 'SPAM', 'Spam or unwanted content'],
			[DeletionReasons.CHEATING_OR_EXPLOITATION, 'CHEATING_OR_EXPLOITATION', 'Cheating or exploitation'],
			[DeletionReasons.COORDINATED_RAIDING, 'COORDINATED_RAIDING', 'Coordinated raiding'],
			[DeletionReasons.AUTOMATION_OR_SELFBOT, 'AUTOMATION_OR_SELFBOT', 'Automation or selfbot usage'],
			[DeletionReasons.NONCONSENSUAL_SEXUAL_CONTENT, 'NONCONSENSUAL_SEXUAL_CONTENT', 'Non-consensual sexual content'],
			[DeletionReasons.SCAM_OR_SOCIAL_ENGINEERING, 'SCAM_OR_SOCIAL_ENGINEERING', 'Scam or social engineering'],
			[DeletionReasons.CHILD_SEXUAL_CONTENT, 'CHILD_SEXUAL_CONTENT', 'Child sexual abuse material'],
			[DeletionReasons.PRIVACY_VIOLATION_OR_DOXXING, 'PRIVACY_VIOLATION_OR_DOXXING', 'Privacy violation or doxxing'],
			[DeletionReasons.HARASSMENT_OR_BULLYING, 'HARASSMENT_OR_BULLYING', 'Harassment or bullying'],
			[DeletionReasons.PAYMENT_FRAUD, 'PAYMENT_FRAUD', 'Payment fraud'],
			[DeletionReasons.CHILD_SAFETY_VIOLATION, 'CHILD_SAFETY_VIOLATION', 'Child safety violation'],
			[DeletionReasons.BILLING_DISPUTE_OR_ABUSE, 'BILLING_DISPUTE_OR_ABUSE', 'Billing dispute or abuse'],
			[DeletionReasons.UNSOLICITED_EXPLICIT_CONTENT, 'UNSOLICITED_EXPLICIT_CONTENT', 'Unsolicited explicit content'],
			[DeletionReasons.GRAPHIC_VIOLENCE, 'GRAPHIC_VIOLENCE', 'Graphic violence'],
			[DeletionReasons.BAN_EVASION, 'BAN_EVASION', 'Ban evasion'],
			[DeletionReasons.TOKEN_OR_CREDENTIAL_SCAM, 'TOKEN_OR_CREDENTIAL_SCAM', 'Token or credential scam'],
			[DeletionReasons.INACTIVITY, 'INACTIVITY', 'Account inactivity'],
			[
				DeletionReasons.HATE_SPEECH_OR_EXTREMIST_CONTENT,
				'HATE_SPEECH_OR_EXTREMIST_CONTENT',
				'Hate speech or extremist content',
			],
			[DeletionReasons.MALICIOUS_LINKS_OR_MALWARE, 'MALICIOUS_LINKS_OR_MALWARE', 'Malicious links or malware'],
			[
				DeletionReasons.IMPERSONATION_OR_FAKE_IDENTITY,
				'IMPERSONATION_OR_FAKE_IDENTITY',
				'Impersonation or fake identity',
			],
		],
		'Reason for account deletion',
		'DeletionReason',
	),
	'DeletionReason',
);
