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

import type {GuildRecord} from '@app/records/GuildRecord';
import type {UserRecord} from '@app/records/UserRecord';
import ChannelStore from '@app/stores/ChannelStore';
import GuildStore from '@app/stores/GuildStore';
import UserStore from '@app/stores/UserStore';
import * as PermissionUtils from '@app/utils/PermissionUtils';
import type {ChannelId, GuildId, UserId} from '@fluxer/schema/src/branded/WireIds';
import type {Channel} from '@fluxer/schema/src/domains/channel/ChannelSchemas';
import type {Guild} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import {makeAutoObservable, observable, reaction} from 'mobx';

const isChannelLike = (value: unknown): value is Channel => {
	return Boolean(value && typeof value === 'object' && 'type' in value && 'id' in value);
};

const isGuildLike = (value: unknown): value is Guild | GuildRecord => {
	return Boolean(value && typeof value === 'object' && ('owner_id' in value || 'ownerId' in value));
};

class PermissionStore {
	private readonly guildPermissions = observable.map<GuildId, bigint>();
	private readonly channelPermissions = observable.map<ChannelId, bigint>();
	private readonly guildVersions = observable.map<GuildId, number>();
	private globalVersion = 0;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
	}

	getChannelPermissions(channelId: string): bigint | undefined {
		return this.channelPermissions.get(channelId as ChannelId);
	}

	getGuildPermissions(guildId: string): bigint | undefined {
		return this.guildPermissions.get(guildId as GuildId);
	}

	getGuildVersion(guildId: string): number | undefined {
		return this.guildVersions.get(guildId as GuildId);
	}

	get version(): number {
		return this.globalVersion;
	}

	can(permission: bigint, context: Channel | Guild | GuildRecord | {channelId?: string; guildId?: string}): boolean {
		let permissions = PermissionUtils.NONE;

		if (isChannelLike(context)) {
			permissions = this.channelPermissions.get(context.id as ChannelId) ?? PermissionUtils.NONE;
		} else if (isGuildLike(context)) {
			permissions = this.guildPermissions.get(context.id as GuildId) ?? PermissionUtils.NONE;
		} else if (context.channelId) {
			permissions = this.channelPermissions.get(context.channelId as ChannelId) ?? PermissionUtils.NONE;
		} else if (context.guildId) {
			permissions = this.guildPermissions.get(context.guildId as GuildId) ?? PermissionUtils.NONE;
		}

		return (permissions & permission) === permission;
	}

	canManageUser(permission: bigint, otherUser: UserRecord | UserId, guild: Guild): boolean {
		const otherUserId = typeof otherUser === 'string' ? otherUser : otherUser.id;

		if (guild.owner_id === otherUserId) {
			return false;
		}

		const me = UserStore.currentUser;
		if (!me) return false;

		if (!this.can(permission, guild)) {
			return false;
		}

		const myHighestRole = PermissionUtils.getHighestRole(guild, me.id);
		const otherHighestRole = PermissionUtils.getHighestRole(guild, otherUserId);

		return PermissionUtils.isRoleHigher(guild, me.id, myHighestRole, otherHighestRole);
	}

	handleConnectionOpen(): void {
		this.rebuildPermissions();
	}

	handleConnectionClose(): void {
		this.guildPermissions.clear();
		this.channelPermissions.clear();
		this.guildVersions.clear();
		this.bumpGlobalVersion();
	}

	handleGuild(): void {
		this.rebuildPermissions();
	}

	handleGuildMemberUpdate(userId: string): void {
		const currentUser = UserStore.currentUser;
		if (!currentUser) return;
		if (userId !== currentUser.id) return;
		this.rebuildPermissions();
	}

	handleUserUpdate(userId: string): void {
		this.handleGuildMemberUpdate(userId);
	}

	handleChannelUpdate(channelId: string): void {
		const channel = ChannelStore.getChannel(channelId);
		if (!channel) {
			return;
		}

		const currentUser = UserStore.currentUser;
		if (!currentUser) return;

		this.channelPermissions.set(
			channel.id as ChannelId,
			PermissionUtils.computePermissions(currentUser, channel.toJSON()),
		);
		this.bumpGuildVersion(channel.guildId);
	}

	handleChannelDelete(channelId: string, guildId?: string): void {
		this.channelPermissions.delete(channelId as ChannelId);
		this.bumpGuildVersion(guildId);
	}

	handleGuildRole(guildId: string): void {
		const currentUser = UserStore.currentUser;
		if (!currentUser) return;

		const guild = GuildStore.getGuild(guildId);
		if (!guild) return;

		this.guildPermissions.set(guildId as GuildId, PermissionUtils.computePermissions(currentUser, guild.toJSON()));

		for (const channel of ChannelStore.channels) {
			if (channel.guildId === guildId) {
				this.channelPermissions.set(
					channel.id as ChannelId,
					PermissionUtils.computePermissions(currentUser, channel.toJSON()),
				);
			}
		}

		this.bumpGuildVersion(guildId);
	}

	private rebuildPermissions(): void {
		const user = UserStore.currentUser;
		if (!user) {
			this.guildPermissions.clear();
			this.channelPermissions.clear();
			this.guildVersions.clear();
			this.bumpGlobalVersion();
			return;
		}

		this.guildPermissions.clear();
		this.channelPermissions.clear();

		for (const guild of GuildStore.getGuilds()) {
			this.guildPermissions.set(guild.id as GuildId, PermissionUtils.computePermissions(user, guild.toJSON()));
			this.bumpGuildVersion(guild.id);
		}

		for (const channel of ChannelStore.channels) {
			if (Object.keys(channel.permissionOverwrites).length === 0) {
				if (channel.guildId != null) {
					const guildPerms = this.guildPermissions.get(channel.guildId as GuildId) ?? PermissionUtils.NONE;
					this.channelPermissions.set(channel.id as ChannelId, guildPerms);
				} else {
					this.channelPermissions.set(channel.id as ChannelId, PermissionUtils.NONE);
				}
			} else {
				this.channelPermissions.set(
					channel.id as ChannelId,
					PermissionUtils.computePermissions(user, channel.toJSON()),
				);
			}

			this.bumpGuildVersion(channel.guildId);
		}

		this.bumpGlobalVersion();
	}

	private bumpGlobalVersion(): void {
		this.globalVersion += 1;
	}

	private bumpGuildVersion(guildId?: string | null): void {
		if (!guildId) return;
		const current = this.guildVersions.get(guildId as GuildId) ?? 0;
		this.guildVersions.set(guildId as GuildId, current + 1);
		this.bumpGlobalVersion();
	}

	subscribe(callback: () => void): () => void {
		return reaction(
			() => this.version,
			() => callback(),
			{fireImmediately: true},
		);
	}
}

export default new PermissionStore();
