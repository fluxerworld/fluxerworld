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

interface ParsedStreamKey {
	guildId: string | null;
	channelId: string | null;
	connectionId: string;
}

export function getStreamKey(
	guildId: string | null | undefined,
	channelId: string | null | undefined,
	connectionId: string,
): string {
	if (channelId && guildId) return `${guildId}:${channelId}:${connectionId}`;
	if (channelId) return `dm:${channelId}:${connectionId}`;
	return `stream:${connectionId}`;
}

export function parseStreamKey(streamKey: string): ParsedStreamKey | null {
	const parts = streamKey.split(':');
	if (parts.length === 2 && parts[0] === 'stream') {
		return {guildId: null, channelId: null, connectionId: parts[1]};
	}
	if (parts.length === 3 && parts[0] === 'dm') {
		return {guildId: null, channelId: parts[1], connectionId: parts[2]};
	}
	if (parts.length === 3) {
		return {guildId: parts[0], channelId: parts[1], connectionId: parts[2]};
	}
	return null;
}
