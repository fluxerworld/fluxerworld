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

const truncateText = (value: string, maxLength: number): string => {
	if (maxLength <= 0) return '';
	if (value.length <= maxLength) return value;
	if (maxLength <= 3) return value.slice(0, maxLength);
	return `${value.slice(0, maxLength - 3)}...`;
};

export function getChannelPlaceholder(channelName: string, prefix: string, maxLength: number): string {
	const availableLength = maxLength - prefix.length;
	if (availableLength <= 0) {
		return prefix;
	}

	const truncatedName = truncateText(channelName, availableLength);
	return prefix + truncatedName;
}

export function getDMPlaceholder(username: string, prefix: string, maxLength: number): string {
	const availableLength = maxLength - prefix.length;
	if (availableLength <= 0) {
		return prefix;
	}

	const truncatedName = truncateText(username, availableLength);
	return prefix + truncatedName;
}
