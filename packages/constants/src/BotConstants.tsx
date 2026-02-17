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

import {PublicUserFlags} from '@fluxer/constants/src/UserConstants';

export const ApplicationFlags = {} as const;

export const BotFlags = {
	FRIENDLY_BOT: PublicUserFlags.FRIENDLY_BOT,
	FRIENDLY_BOT_MANUAL_APPROVAL: PublicUserFlags.FRIENDLY_BOT_MANUAL_APPROVAL,
} as const;

export const BotFlagsDescriptions: Record<keyof typeof BotFlags, string> = {
	FRIENDLY_BOT: 'Bot accepts friend requests from users',
	FRIENDLY_BOT_MANUAL_APPROVAL: 'Bot requires manual approval for friend requests',
};
