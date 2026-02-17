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

import {
	createNamedStringLiteralUnion,
	createStringType,
	SnowflakeStringType,
	SnowflakeType,
	withOpenApiType,
} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {EmailType} from '@fluxer/schema/src/primitives/UserValidators';
import {z} from 'zod';

export const MessageReportCategoryEnum = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			['harassment', 'harassment', 'Content that harasses, bullies, or intimidates users'],
			['hate_speech', 'hate_speech', 'Content promoting hatred against protected groups'],
			['violent_content', 'violent_content', 'Content depicting or promoting violence'],
			['spam', 'spam', 'Unsolicited bulk messages or promotional content'],
			['nsfw_violation', 'nsfw_violation', 'Adult content posted outside age-restricted channels'],
			['illegal_activity', 'illegal_activity', 'Content promoting or facilitating illegal activities'],
			['doxxing', 'doxxing', 'Content revealing private personal information'],
			['self_harm', 'self_harm', 'Content promoting self-harm or suicide'],
			['child_safety', 'child_safety', 'Content that endangers minors or depicts child abuse'],
			['malicious_links', 'malicious_links', 'Links to malware, phishing, or other malicious sites'],
			['impersonation', 'impersonation', 'Content falsely claiming to be another person or entity'],
			['other', 'other', 'Other violations not covered by specific categories'],
		],
		'Category of the message report',
	),
	'MessageReportCategory',
);

export const UserReportCategoryEnum = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			['harassment', 'harassment', 'User engages in harassment, bullying, or intimidation'],
			['hate_speech', 'hate_speech', 'User promotes hatred against protected groups'],
			['spam_account', 'spam_account', 'Account used for spamming or bulk messaging'],
			['impersonation', 'impersonation', 'User falsely claims to be another person or entity'],
			['underage_user', 'underage_user', 'User appears to be under the minimum required age'],
			['inappropriate_profile', 'inappropriate_profile', 'Profile contains inappropriate or offensive content'],
			['other', 'other', 'Other violations not covered by specific categories'],
		],
		'Category of the user report',
	),
	'UserReportCategory',
);

export const GuildReportCategoryEnum = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			['harassment', 'harassment', 'Guild facilitates harassment, bullying, or intimidation'],
			['hate_speech', 'hate_speech', 'Guild promotes hatred against protected groups'],
			['extremist_community', 'extremist_community', 'Guild promotes extremist or terrorist ideologies'],
			['illegal_activity', 'illegal_activity', 'Guild promotes or facilitates illegal activities'],
			['child_safety', 'child_safety', 'Guild endangers minors or hosts child abuse content'],
			['raid_coordination', 'raid_coordination', 'Guild coordinates attacks on other communities'],
			['spam', 'spam', 'Guild used for spamming or bulk messaging'],
			['malware_distribution', 'malware_distribution', 'Guild distributes malware or malicious software'],
			['other', 'other', 'Other violations not covered by specific categories'],
		],
		'Category of the guild report',
	),
	'GuildReportCategory',
);

export const ReportResponse = z.object({
	report_id: SnowflakeStringType.describe('The unique identifier for this report'),
	status: z.string().describe('Current status of the report (pending, reviewed, resolved)'),
	reported_at: z.string().describe('ISO 8601 timestamp when the report was submitted'),
});
export type ReportResponse = z.infer<typeof ReportResponse>;

export const OkResponse = z.object({
	ok: z.boolean().describe('Whether the operation was successful'),
});
export type OkResponse = z.infer<typeof OkResponse>;

export const TicketResponse = z.object({
	ticket: z.string().describe('A temporary ticket token for subsequent operations'),
});
export type TicketResponse = z.infer<typeof TicketResponse>;

const FLUXER_TAG_REGEX = /^([^#]{1,32})#([0-9]{4})$/;

const FLUXER_TAG_TYPE = z
	.string()
	.min(3)
	.max(37)
	.refine((value) => FLUXER_TAG_REGEX.test(value), 'Fluxer tag must be in the format username#1234')
	.describe('A Fluxer username tag in the format username#1234');

const EU_COUNTRY_CODE_ENUM = createNamedStringLiteralUnion(
	[
		['AT', 'AT', 'Austria'],
		['BE', 'BE', 'Belgium'],
		['BG', 'BG', 'Bulgaria'],
		['HR', 'HR', 'Croatia'],
		['CY', 'CY', 'Cyprus'],
		['CZ', 'CZ', 'Czechia'],
		['DK', 'DK', 'Denmark'],
		['EE', 'EE', 'Estonia'],
		['FI', 'FI', 'Finland'],
		['FR', 'FR', 'France'],
		['DE', 'DE', 'Germany'],
		['GR', 'GR', 'Greece'],
		['HU', 'HU', 'Hungary'],
		['IE', 'IE', 'Ireland'],
		['IT', 'IT', 'Italy'],
		['LV', 'LV', 'Latvia'],
		['LT', 'LT', 'Lithuania'],
		['LU', 'LU', 'Luxembourg'],
		['MT', 'MT', 'Malta'],
		['NL', 'NL', 'Netherlands'],
		['PL', 'PL', 'Poland'],
		['PT', 'PT', 'Portugal'],
		['RO', 'RO', 'Romania'],
		['SK', 'SK', 'Slovakia'],
		['SI', 'SI', 'Slovenia'],
		['ES', 'ES', 'Spain'],
		['SE', 'SE', 'Sweden'],
	] as const,
	'EU country code of residence',
);

export const ReportMessageRequest = z.object({
	channel_id: SnowflakeType.describe('ID of the channel containing the reported message'),
	message_id: SnowflakeType.describe('ID of the message being reported'),
	category: MessageReportCategoryEnum,
	additional_info: z.optional(createStringType(0, 1000)).describe('Additional context or details about the report'),
});
export type ReportMessageRequest = z.infer<typeof ReportMessageRequest>;

export const ReportUserRequest = z.object({
	user_id: SnowflakeType.describe('ID of the user being reported'),
	category: UserReportCategoryEnum,
	additional_info: z.optional(createStringType(0, 1000)).describe('Additional context or details about the report'),
	guild_id: z.optional(SnowflakeType).describe('ID of the guild where the violation occurred'),
});
export type ReportUserRequest = z.infer<typeof ReportUserRequest>;

export const ReportGuildRequest = z.object({
	guild_id: SnowflakeType.describe('ID of the guild being reported'),
	category: GuildReportCategoryEnum,
	additional_info: z.optional(createStringType(0, 1000)).describe('Additional context or details about the report'),
});
export type ReportGuildRequest = z.infer<typeof ReportGuildRequest>;

const DSA_VERIFICATION_CODE_TYPE = createStringType(9, 9).refine(
	(value) => /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(value),
	'Verification code must have the format XXXX-XXXX (uppercase letters and digits)',
);

export const DsaReportEmailSendRequest = z.object({
	email: EmailType.describe('Email address to send the DSA verification code to'),
});
export type DsaReportEmailSendRequest = z.infer<typeof DsaReportEmailSendRequest>;

export const DsaReportEmailVerifyRequest = z.object({
	email: EmailType.describe('Email address that received the verification code'),
	code: DSA_VERIFICATION_CODE_TYPE.describe('Verification code received via email'),
});
export type DsaReportEmailVerifyRequest = z.infer<typeof DsaReportEmailVerifyRequest>;

const DsaReportBase = z.object({
	ticket: createStringType(1, 128).describe('Verification ticket obtained from email verification'),
	additional_info: z.optional(createStringType(0, 1000)).describe('Additional context or details about the report'),
	reporter_full_legal_name: createStringType(1, 160).describe('Full legal name of the person filing the report'),
	reporter_country_of_residence: EU_COUNTRY_CODE_ENUM.describe('EU country code of the reporter residence'),
	reporter_fluxer_tag: z.optional(FLUXER_TAG_TYPE).describe('Fluxer tag of the reporter if they have an account'),
});

export const DsaReportMessageRequest = DsaReportBase.extend({
	report_type: z.literal('message').describe('Type of report'),
	category: MessageReportCategoryEnum,
	message_link: createStringType(1, 2048).describe('Link to the message being reported'),
	reported_user_tag: z.optional(FLUXER_TAG_TYPE).describe('Fluxer tag of the user who sent the message'),
});
export type DsaReportMessageRequest = z.infer<typeof DsaReportMessageRequest>;

export const DsaReportUserRequest = DsaReportBase.extend({
	report_type: z.literal('user').describe('Type of report'),
	category: UserReportCategoryEnum,
	user_id: SnowflakeType.optional().describe('ID of the user being reported'),
	user_tag: z.optional(FLUXER_TAG_TYPE).describe('Fluxer tag of the user being reported'),
}).superRefine((value, ctx) => {
	if (!value.user_id && !value.user_tag) {
		ctx.addIssue({
			code: 'custom',
			message: 'Either user_id or user_tag must be provided for user reports',
			path: [],
		});
	}
});
export type DsaReportUserRequest = z.infer<typeof DsaReportUserRequest>;

export const DsaReportGuildRequest = DsaReportBase.extend({
	report_type: z.literal('guild').describe('Type of report'),
	category: GuildReportCategoryEnum,
	guild_id: SnowflakeType.describe('ID of the guild being reported'),
	invite_code: z.optional(createStringType(1, 64)).describe('Invite code used to access the guild'),
});
export type DsaReportGuildRequest = z.infer<typeof DsaReportGuildRequest>;

export const DsaReportRequest = z.discriminatedUnion('report_type', [
	DsaReportMessageRequest,
	DsaReportUserRequest,
	DsaReportGuildRequest,
]);
export type DsaReportRequest = z.infer<typeof DsaReportRequest>;
