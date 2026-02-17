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

import type {GuildRoleRecord} from '@app/records/GuildRoleRecord';
import {UserRecord} from '@app/records/UserRecord';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import GuildStore from '@app/stores/GuildStore';
import RuntimeConfigStore from '@app/stores/RuntimeConfigStore';
import UserStore from '@app/stores/UserStore';
import * as ColorUtils from '@app/utils/ColorUtils';
import {GuildMemberProfileFlags} from '@fluxer/constants/src/GuildConstants';
import type {GuildMemberData} from '@fluxer/schema/src/domains/guild/GuildMemberSchemas';

interface GuildMemberRecordOptions {
	instanceId?: string;
}

export class GuildMemberRecord {
	readonly instanceId: string;
	readonly guildId: string;
	readonly user: UserRecord;
	readonly nick: string | null;
	readonly avatar: string | null;
	readonly banner: string | null;
	readonly accentColor: number | null;
	readonly roles: ReadonlySet<string>;
	readonly joinedAt: Date;
	readonly mute: boolean;
	readonly deaf: boolean;
	readonly communicationDisabledUntil: Date | null;
	readonly profileFlags: number;

	constructor(guildId: string, guildMember: GuildMemberData, options?: GuildMemberRecordOptions) {
		this.instanceId = options?.instanceId ?? RuntimeConfigStore.localInstanceDomain;
		this.guildId = guildId;

		const cachedUser = UserStore.getUser(guildMember.user.id);
		if (cachedUser) {
			this.user = cachedUser;
		} else {
			this.user = new UserRecord(guildMember.user, {instanceId: this.instanceId});
			UserStore.cacheUsers([this.user.toJSON()]);
		}

		this.nick = guildMember.nick ?? null;
		this.avatar = guildMember.avatar ?? null;
		this.banner = guildMember.banner ?? null;
		this.accentColor = guildMember.accent_color ?? null;
		this.roles = new Set(guildMember.roles);
		this.joinedAt = new Date(guildMember.joined_at);
		this.mute = guildMember.mute ?? false;
		this.deaf = guildMember.deaf ?? false;
		this.communicationDisabledUntil = guildMember.communication_disabled_until
			? new Date(guildMember.communication_disabled_until)
			: null;
		this.profileFlags = guildMember.profile_flags ?? 0;
	}

	isAvatarUnset(): boolean {
		return (this.profileFlags & GuildMemberProfileFlags.AVATAR_UNSET) !== 0;
	}

	isBannerUnset(): boolean {
		return (this.profileFlags & GuildMemberProfileFlags.BANNER_UNSET) !== 0;
	}

	withUpdates(updates: Partial<GuildMemberData>): GuildMemberRecord {
		return new GuildMemberRecord(
			this.guildId,
			{
				user: updates.user ?? this.user.toJSON(),
				nick: updates.nick ?? this.nick,
				avatar: updates.avatar ?? this.avatar,
				banner: updates.banner ?? this.banner,
				accent_color: updates.accent_color ?? this.accentColor,
				roles: updates.roles ?? Array.from(this.roles),
				joined_at: updates.joined_at ?? this.joinedAt.toISOString(),
				mute: updates.mute ?? this.mute,
				deaf: updates.deaf ?? this.deaf,
				communication_disabled_until:
					updates.communication_disabled_until ?? this.communicationDisabledUntil?.toISOString() ?? null,
				profile_flags: updates.profile_flags ?? this.profileFlags,
			},
			{instanceId: this.instanceId},
		);
	}

	withRoles(roles: Iterable<string>): GuildMemberRecord {
		return new GuildMemberRecord(
			this.guildId,
			{
				...this.toJSON(),
				roles: Array.from(roles),
			},
			{instanceId: this.instanceId},
		);
	}

	getSortedRoles(): ReadonlyArray<GuildRoleRecord> {
		const guild = GuildStore.getGuild(this.guildId);
		if (!guild) {
			return [];
		}

		return Array.from(this.roles)
			.map((roleId) => guild.roles[roleId])
			.filter((role): role is GuildRoleRecord => role !== undefined)
			.sort((a, b) => {
				if (b.position !== a.position) {
					return b.position - a.position;
				}
				return BigInt(a.id) < BigInt(b.id) ? -1 : 1;
			});
	}

	getColorString(): string | undefined {
		const sortedRoles = this.getSortedRoles();
		for (const role of sortedRoles) {
			if (role.color) {
				return ColorUtils.int2rgb(role.color);
			}
		}

		const guild = GuildStore.getGuild(this.guildId);
		if (guild) {
			const everyoneRole = guild.roles[this.guildId];
			if (everyoneRole?.color) {
				return ColorUtils.int2rgb(everyoneRole.color);
			}
		}

		return;
	}

	isCurrentUser(): boolean {
		return this.user.id === AuthenticationStore.currentUserId;
	}

	isTimedOut(): boolean {
		if (!this.communicationDisabledUntil) {
			return false;
		}
		return this.communicationDisabledUntil.getTime() > Date.now();
	}

	toJSON(): GuildMemberData {
		return {
			user: this.user.toJSON(),
			nick: this.nick,
			avatar: this.avatar,
			banner: this.banner,
			accent_color: this.accentColor,
			roles: Array.from(this.roles),
			joined_at: this.joinedAt.toISOString(),
			mute: this.mute,
			deaf: this.deaf,
			communication_disabled_until: this.communicationDisabledUntil?.toISOString() ?? null,
			profile_flags: this.profileFlags,
		};
	}
}
