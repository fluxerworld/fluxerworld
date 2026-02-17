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

declare const __brand: unique symbol;

type Brand<T, TBrand extends string> = T & {readonly [__brand]: TBrand};
interface BrandedValue {
	readonly [__brand]: unknown;
}

const brand = <TValue extends string | bigint, TBrand extends string>(value: TValue): Brand<TValue, TBrand> =>
	value as Brand<TValue, TBrand>;

const rebrand = <TValue extends string | bigint, TBrand extends string>(
	value: Brand<TValue, string>,
): Brand<TValue, TBrand> => value as Brand<TValue, TBrand>;

export type UserID = Brand<bigint, 'UserID'>;
export type GuildID = Brand<bigint, 'GuildID'>;
export type ChannelID = Brand<bigint, 'ChannelID'>;
export type MessageID = Brand<bigint, 'MessageID'>;
export type RoleID = Brand<bigint, 'RoleID'>;
export type EmojiID = Brand<bigint, 'EmojiID'>;
export type WebhookID = Brand<bigint, 'WebhookID'>;
export type AttachmentID = Brand<bigint, 'AttachmentID'>;
export type StickerID = Brand<bigint, 'StickerID'>;
export type ReportID = Brand<bigint, 'ReportID'>;
export type MemeID = Brand<bigint, 'MemeID'>;
export type ApplicationID = Brand<bigint, 'ApplicationID'>;

export type InviteCode = Brand<string, 'InviteCode'>;
export type VanityURLCode = Brand<string, 'VanityURLCode'>;
export type EmailVerificationToken = Brand<string, 'EmailVerificationToken'>;
export type PasswordResetToken = Brand<string, 'PasswordResetToken'>;
export type EmailRevertToken = Brand<string, 'EmailRevertToken'>;
export type IpAuthorizationToken = Brand<string, 'IpAuthorizationToken'>;
export type IpAuthorizationTicket = Brand<string, 'IpAuthorizationTicket'>;
type MfaTicket = Brand<string, 'MfaTicket'>;
export type WebhookToken = Brand<string, 'WebhookToken'>;
export type MfaBackupCode = Brand<string, 'MfaBackupCode'>;
export type PhoneVerificationToken = Brand<string, 'PhoneVerificationToken'>;

export function createUserID<T extends bigint>(id: T extends BrandedValue ? never : T): UserID {
	return brand<T, 'UserID'>(id);
}
export function createGuildID<T extends bigint>(id: T extends BrandedValue ? never : T): GuildID {
	return brand<T, 'GuildID'>(id);
}
export function createChannelID<T extends bigint>(id: T extends BrandedValue ? never : T): ChannelID {
	return brand<T, 'ChannelID'>(id);
}
export function createMessageID<T extends bigint>(id: T extends BrandedValue ? never : T): MessageID {
	return brand<T, 'MessageID'>(id);
}
export function createRoleID<T extends bigint>(id: T extends BrandedValue ? never : T): RoleID {
	return brand<T, 'RoleID'>(id);
}
export function createEmojiID<T extends bigint>(id: T extends BrandedValue ? never : T): EmojiID {
	return brand<T, 'EmojiID'>(id);
}
export function createWebhookID<T extends bigint>(id: T extends BrandedValue ? never : T): WebhookID {
	return brand<T, 'WebhookID'>(id);
}
export function createAttachmentID<T extends bigint>(id: T extends BrandedValue ? never : T): AttachmentID {
	return brand<T, 'AttachmentID'>(id);
}
export function createStickerID<T extends bigint>(id: T extends BrandedValue ? never : T): StickerID {
	return brand<T, 'StickerID'>(id);
}
export function createReportID<T extends bigint>(id: T extends BrandedValue ? never : T): ReportID {
	return brand<T, 'ReportID'>(id);
}
export function createMemeID<T extends bigint>(id: T extends BrandedValue ? never : T): MemeID {
	return brand<T, 'MemeID'>(id);
}
export function createApplicationID<T extends bigint>(id: T extends BrandedValue ? never : T): ApplicationID {
	return brand<T, 'ApplicationID'>(id);
}

export function createInviteCode<T extends string>(code: T extends BrandedValue ? never : T): InviteCode {
	return brand<T, 'InviteCode'>(code);
}
export function createVanityURLCode<T extends string>(code: T extends BrandedValue ? never : T): VanityURLCode {
	return brand<T, 'VanityURLCode'>(code);
}
export function createEmailVerificationToken<T extends string>(
	token: T extends BrandedValue ? never : T,
): EmailVerificationToken {
	return brand<T, 'EmailVerificationToken'>(token);
}
export function createPasswordResetToken<T extends string>(
	token: T extends BrandedValue ? never : T,
): PasswordResetToken {
	return brand<T, 'PasswordResetToken'>(token);
}
export function createEmailRevertToken<T extends string>(token: T extends BrandedValue ? never : T): EmailRevertToken {
	return brand<T, 'EmailRevertToken'>(token);
}
export function createIpAuthorizationToken<T extends string>(
	token: T extends BrandedValue ? never : T,
): IpAuthorizationToken {
	return brand<T, 'IpAuthorizationToken'>(token);
}
export function createIpAuthorizationTicket<T extends string>(
	ticket: T extends BrandedValue ? never : T,
): IpAuthorizationTicket {
	return brand<T, 'IpAuthorizationTicket'>(ticket);
}
export function createMfaTicket<T extends string>(ticket: T extends BrandedValue ? never : T): MfaTicket {
	return brand<T, 'MfaTicket'>(ticket);
}
export function createWebhookToken<T extends string>(token: T extends BrandedValue ? never : T): WebhookToken {
	return brand<T, 'WebhookToken'>(token);
}
export function createMfaBackupCode<T extends string>(code: T extends BrandedValue ? never : T): MfaBackupCode {
	return brand<T, 'MfaBackupCode'>(code);
}
export function createPhoneVerificationToken<T extends string>(
	token: T extends BrandedValue ? never : T,
): PhoneVerificationToken {
	return brand<T, 'PhoneVerificationToken'>(token);
}

export function createUserIDSet(ids: Set<bigint>): Set<UserID> {
	return ids as Set<UserID>;
}
export function createGuildIDSet(ids: Set<bigint>): Set<GuildID> {
	return ids as Set<GuildID>;
}
export function createRoleIDSet(ids: Set<bigint>): Set<RoleID> {
	return ids as Set<RoleID>;
}
export function guildIdToRoleId(guildId: GuildID): RoleID {
	return rebrand<bigint, 'RoleID'>(guildId);
}
export function channelIdToUserId(channelId: ChannelID): UserID {
	return rebrand<bigint, 'UserID'>(channelId);
}
export function userIdToChannelId(userId: UserID): ChannelID {
	return rebrand<bigint, 'ChannelID'>(userId);
}
export function vanityCodeToInviteCode(vanityCode: VanityURLCode): InviteCode {
	return rebrand<string, 'InviteCode'>(vanityCode);
}
export function channelIdToMessageId(channelId: ChannelID): MessageID {
	return rebrand<bigint, 'MessageID'>(channelId);
}
export function applicationIdToUserId(applicationId: ApplicationID): UserID {
	return rebrand<bigint, 'UserID'>(applicationId);
}
