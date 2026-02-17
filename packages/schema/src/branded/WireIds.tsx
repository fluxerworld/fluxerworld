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

declare const GuildIdBrand: unique symbol;
declare const ChannelIdBrand: unique symbol;
declare const UserIdBrand: unique symbol;
declare const RoleIdBrand: unique symbol;
declare const MessageIdBrand: unique symbol;
declare const WebhookIdBrand: unique symbol;
declare const EmojiIdBrand: unique symbol;
declare const StickerIdBrand: unique symbol;
declare const AttachmentIdBrand: unique symbol;
declare const InviteCodeBrand: unique symbol;

export type GuildId = string & {readonly __brand: typeof GuildIdBrand};
export type ChannelId = string & {readonly __brand: typeof ChannelIdBrand};
export type UserId = string & {readonly __brand: typeof UserIdBrand};
export type RoleId = string & {readonly __brand: typeof RoleIdBrand};
export type MessageId = string & {readonly __brand: typeof MessageIdBrand};
export type WebhookId = string & {readonly __brand: typeof WebhookIdBrand};
export type EmojiId = string & {readonly __brand: typeof EmojiIdBrand};
export type StickerId = string & {readonly __brand: typeof StickerIdBrand};
export type AttachmentId = string & {readonly __brand: typeof AttachmentIdBrand};
export type InviteCode = string & {readonly __brand: typeof InviteCodeBrand};
