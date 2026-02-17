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

import type {ExpressionPickerTabType} from '@app/components/popouts/ExpressionPickerPopout';
import {Logger} from '@app/lib/Logger';
import ExpressionPickerStore from '@app/stores/ExpressionPickerStore';

const logger = new Logger('ExpressionPicker');

export function open(channelId: string, tab?: ExpressionPickerTabType): void {
	logger.debug(`Opening expression picker for channel ${channelId}, tab: ${tab}`);
	ExpressionPickerStore.open(channelId, tab);
}

export function close(): void {
	logger.debug('Closing expression picker');
	ExpressionPickerStore.close();
}

export function toggle(channelId: string, tab: ExpressionPickerTabType): void {
	logger.debug(`Toggling expression picker for channel ${channelId}, tab: ${tab}`);
	ExpressionPickerStore.toggle(channelId, tab);
}

export function setTab(tab: ExpressionPickerTabType): void {
	logger.debug(`Setting expression picker tab to: ${tab}`);
	ExpressionPickerStore.setTab(tab);
}
