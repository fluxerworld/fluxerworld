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

import GuildReadStateStore from '@app/stores/GuildReadStateStore';
import IdleStore from '@app/stores/IdleStore';
import NotificationStore from '@app/stores/NotificationStore';
import WindowStore from '@app/stores/WindowStore';

export function focused(focused: boolean): void {
	WindowStore.setFocused(focused);
	GuildReadStateStore.handleWindowFocus();
	NotificationStore.handleWindowFocus({focused});

	if (focused) {
		IdleStore.recordActivity();
	}
}

export function resized(): void {
	WindowStore.updateWindowSize();
}

export function visibilityChanged(visible: boolean): void {
	WindowStore.setVisible(visible);
}
