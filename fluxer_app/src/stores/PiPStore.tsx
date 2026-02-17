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

import AppStorage from '@app/lib/AppStorage';
import {makeAutoObservable, runInAction} from 'mobx';

type PiPContentType = 'stream' | 'camera';
type PiPCorner = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';
const PIP_DEFAULT_WIDTH = 320;

interface PiPContent {
	type: PiPContentType;
	participantIdentity: string;
	channelId: string;
	guildId: string | null;
	connectionId: string;
	userId: string;
}

const PIP_CORNER_STORAGE_KEY = 'pip_corner';
const PIP_WIDTH_STORAGE_KEY = 'pip_width';
const PIP_CORNERS: ReadonlyArray<PiPCorner> = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];

function isPiPCorner(value: string | null): value is PiPCorner {
	if (!value) return false;
	return PIP_CORNERS.includes(value as PiPCorner);
}

function parsePiPWidth(value: string | null): number | null {
	if (!value) return null;
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) return null;
	return parsed;
}

class PiPStore {
	isOpen = false;
	content: PiPContent | null = null;
	focusedTileMirrorContent: PiPContent | null = null;
	corner: PiPCorner = 'bottom-right';
	temporaryCornerOverride: PiPCorner | null = null;
	sessionDisable = false;
	width = PIP_DEFAULT_WIDTH;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
		const storedCorner = AppStorage.getItem(PIP_CORNER_STORAGE_KEY);
		if (isPiPCorner(storedCorner)) {
			this.corner = storedCorner;
		}
		const storedWidth = parsePiPWidth(AppStorage.getItem(PIP_WIDTH_STORAGE_KEY));
		if (storedWidth != null) {
			this.width = storedWidth;
		}
	}

	open(content: PiPContent): void {
		runInAction(() => {
			this.isOpen = true;
			this.content = content;
		});
	}

	close(): void {
		runInAction(() => {
			this.isOpen = false;
			this.content = null;
		});
	}

	showFocusedTileMirror(content: PiPContent, corner: PiPCorner = 'top-right'): void {
		runInAction(() => {
			this.focusedTileMirrorContent = content;
			this.temporaryCornerOverride = corner;
		});
	}

	hideFocusedTileMirror(): void {
		runInAction(() => {
			this.focusedTileMirrorContent = null;
			this.temporaryCornerOverride = null;
		});
	}

	setSessionDisable(value: boolean): void {
		runInAction(() => {
			this.sessionDisable = value;
		});
	}

	setCorner(corner: PiPCorner): void {
		runInAction(() => {
			this.corner = corner;
		});
		AppStorage.setItem(PIP_CORNER_STORAGE_KEY, corner);
	}

	setWidth(width: number): void {
		runInAction(() => {
			this.width = width;
		});
		AppStorage.setItem(PIP_WIDTH_STORAGE_KEY, `${width}`);
	}

	getContent(): PiPContent | null {
		return this.content;
	}

	getActiveContent(): PiPContent | null {
		return this.focusedTileMirrorContent ?? this.content;
	}

	getIsOpen(): boolean {
		return this.isOpen;
	}

	getHasActiveOverlay(): boolean {
		return this.focusedTileMirrorContent != null || this.isOpen;
	}

	getCorner(): PiPCorner {
		return this.corner;
	}

	getEffectiveCorner(): PiPCorner {
		return this.temporaryCornerOverride ?? this.corner;
	}

	getSessionDisable(): boolean {
		return this.sessionDisable;
	}

	getWidth(): number {
		return this.width;
	}
}

export {PIP_DEFAULT_WIDTH};
export type {PiPContent, PiPContentType, PiPCorner};
export default new PiPStore();
