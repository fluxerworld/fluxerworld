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

import {Logger} from '@app/lib/Logger';
import WindowStore from '@app/stores/WindowStore';
import {autorun} from 'mobx';

type FocusChangeListener = (focused: boolean) => void;

class FocusManager {
	private static instance: FocusManager;
	private listeners: Set<FocusChangeListener> = new Set();
	private initialized = false;
	private disposer: (() => void) | null = null;
	private logger = new Logger('FocusManager');

	static getInstance(): FocusManager {
		if (!FocusManager.instance) {
			FocusManager.instance = new FocusManager();
		}
		return FocusManager.instance;
	}

	init(): void {
		if (this.initialized) return;
		this.initialized = true;

		this.disposer = autorun(() => {
			this.notifyListeners(this.isForeground());
		});
	}

	destroy(): void {
		this.listeners.clear();
		this.disposer?.();
		this.disposer = null;
		this.initialized = false;
	}

	subscribe(listener: FocusChangeListener): () => void {
		this.listeners.add(listener);
		listener(this.isForeground());

		return () => {
			this.listeners.delete(listener);
		};
	}

	private notifyListeners(focused: boolean): void {
		this.listeners.forEach((listener) => {
			try {
				listener(focused);
			} catch (error) {
				this.logger.error('FocusManager: Error in listener:', error);
			}
		});
	}

	private isForeground(): boolean {
		return WindowStore.isFocused() && WindowStore.isVisible();
	}

	isFocused(): boolean {
		return WindowStore.isFocused() && WindowStore.isVisible();
	}
}

export default FocusManager.getInstance();
