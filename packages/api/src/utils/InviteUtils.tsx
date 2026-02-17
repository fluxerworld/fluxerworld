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

import {Config} from '@fluxer/api/src/Config';
import * as RegexUtils from '@fluxer/api/src/utils/RegexUtils';

let _invitePattern: RegExp | null = null;

function getInvitePattern(): RegExp {
	if (!_invitePattern) {
		_invitePattern = new RegExp(
			[
				'(?:https?:\\/\\/)?',
				'(?:',
				`${RegexUtils.escapeRegex(Config.hosts.invite)}(?:\\/#)?\\/(?!invite\\/)([a-zA-Z0-9\\-]{2,32})(?![a-zA-Z0-9\\-])`,
				'|',
				`${RegexUtils.escapeRegex(new URL(Config.endpoints.webApp).hostname)}(?:\\/#)?\\/invite\\/([a-zA-Z0-9\\-]{2,32})(?![a-zA-Z0-9\\-])`,
				')',
			].join(''),
			'gi',
		);
	}
	return _invitePattern;
}

export function findInvites(content: string | null): Array<string> {
	if (!content) return [];

	const invites: Array<string> = [];
	const seenCodes = new Set<string>();

	const pattern = getInvitePattern();
	pattern.lastIndex = 0;

	let match: RegExpExecArray | null;
	while ((match = pattern.exec(content)) !== null && invites.length < 10) {
		const code = match[1] || match[2];
		if (code && !seenCodes.has(code)) {
			seenCodes.add(code);
			invites.push(code);
		}
	}

	return invites;
}

export function findInvite(content: string | null): string | null {
	if (!content) return null;

	const pattern = getInvitePattern();
	pattern.lastIndex = 0;
	const match = pattern.exec(content);

	if (match) {
		return match[1] || match[2];
	}

	return null;
}
