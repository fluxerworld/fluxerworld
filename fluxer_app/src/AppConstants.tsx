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

import type {OAuth2Scope} from '@fluxer/constants/src/OAuth2Constants';
import {isStatusType, normalizeStatus, type StatusType, StatusTypes} from '@fluxer/constants/src/StatusConstants';
import type {I18n, MessageDescriptor} from '@lingui/core';
import {msg} from '@lingui/core/macro';

const OAuth2ScopeDescriptorsInternal: Record<OAuth2Scope, MessageDescriptor> = {
	identify: msg`Access your basic profile information (username, avatar, etc.)`,
	email: msg`View your email address`,
	guilds: msg`View the communities you are a member of`,
	connections: msg`View your connected accounts`,
	bot: msg`Add a bot to a community with requested permissions`,
	admin: msg`Access administrative endpoints`,
};

export function getOAuth2ScopeDescription(i18n: I18n, scope: OAuth2Scope): string {
	return i18n._(OAuth2ScopeDescriptorsInternal[scope]);
}

const StatusTypeToLabelDescriptorsInternal: Record<StatusType, MessageDescriptor> = {
	[StatusTypes.ONLINE]: msg`Online`,
	[StatusTypes.DND]: msg`Do Not Disturb`,
	[StatusTypes.IDLE]: msg`Idle`,
	[StatusTypes.INVISIBLE]: msg`Invisible`,
	[StatusTypes.OFFLINE]: msg`Offline`,
};

export function getStatusTypeLabel(i18n: I18n, statusType: StatusType | string): string {
	const normalized = isStatusType(statusType) ? statusType : normalizeStatus(statusType);
	return i18n._(StatusTypeToLabelDescriptorsInternal[normalized]);
}

const StatusTypeToDescriptionDescriptorsInternal: Record<StatusType, MessageDescriptor> = {
	[StatusTypes.ONLINE]: msg`Charged up on 1.21 gigawatts, ready to talk`,
	[StatusTypes.DND]: msg`In the zone, please do not disturb`,
	[StatusTypes.IDLE]: msg`Took the DeLorean out, but I'll be back in time`,
	[StatusTypes.INVISIBLE]: msg`Currently stuck in 1885, appearing offline`,
	[StatusTypes.OFFLINE]: msg`Currently stuck in 1885, appearing offline`,
};

export function getStatusTypeDescription(i18n: I18n, statusType: StatusType | string): string {
	const normalized = isStatusType(statusType) ? statusType : normalizeStatus(statusType);
	return i18n._(StatusTypeToDescriptionDescriptorsInternal[normalized]);
}
