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

import EventEmitter from 'eventemitter3';

interface CustomStatusEvents {
	presenceChange: (userId: string) => void;
	memberListChange: (guildId: string, listId: string, userId: string) => void;
}

class CustomStatusEmitterClass extends EventEmitter<CustomStatusEvents> {
	emitPresenceChange(userId: string): void {
		this.emit('presenceChange', userId);
	}

	emitMemberListChange(guildId: string, listId: string, userId: string): void {
		this.emit('memberListChange', guildId, listId, userId);
	}

	subscribeToPresence(userId: string, callback: () => void): () => void {
		const handler = (changedUserId: string) => {
			if (changedUserId === userId) {
				callback();
			}
		};
		this.on('presenceChange', handler);
		return () => this.off('presenceChange', handler);
	}

	subscribeToMemberList(guildId: string, listId: string, userId: string, callback: () => void): () => void {
		const handler = (g: string, l: string, u: string) => {
			if (g === guildId && l === listId && u === userId) {
				callback();
			}
		};
		this.on('memberListChange', handler);
		return () => this.off('memberListChange', handler);
	}
}

export const CustomStatusEmitter = new CustomStatusEmitterClass();
