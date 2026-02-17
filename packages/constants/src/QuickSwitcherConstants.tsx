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

import type {ValueOf} from '@fluxer/constants/src/ValueOf';

export const QuickSwitcherResultTypes = {
	HEADER: 'header',
	USER: 'user',
	GROUP_DM: 'group_dm',
	TEXT_CHANNEL: 'text_channel',
	VOICE_CHANNEL: 'voice_channel',
	GUILD: 'guild',
	VIRTUAL_GUILD: 'virtual_guild',
	SETTINGS: 'settings',
	QUICK_ACTION: 'quick_action',
	LINK: 'link',
} as const;

export type QuickSwitcherResultType = ValueOf<typeof QuickSwitcherResultTypes>;
