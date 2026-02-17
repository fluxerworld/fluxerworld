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

import type {ToastProps} from '@app/components/uikit/toast';
import ToastStore from '@app/stores/ToastStore';

export function createToast(data: ToastProps): string {
	return ToastStore.createToast(data);
}

export function destroyToast(id: string): void {
	ToastStore.destroyToast(id);
}

export function success(message: string): string {
	return ToastStore.success(message);
}

export function error(message: string): string {
	return ToastStore.error(message);
}
