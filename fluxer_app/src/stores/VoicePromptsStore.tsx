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

import {makePersistent} from '@app/lib/MobXPersistence';
import {makeAutoObservable} from 'mobx';

class VoicePromptsStore {
	skipHideOwnCameraConfirm = false;
	skipHideOwnScreenShareConfirm = false;

	constructor() {
		makeAutoObservable(
			this,
			{getSkipHideOwnCameraConfirm: false, getSkipHideOwnScreenShareConfirm: false},
			{autoBind: true},
		);
		void this.initPersistence();
	}

	private async initPersistence(): Promise<void> {
		await makePersistent(this, 'VoicePromptsStore', ['skipHideOwnCameraConfirm', 'skipHideOwnScreenShareConfirm']);
	}

	getSkipHideOwnCameraConfirm(): boolean {
		return this.skipHideOwnCameraConfirm;
	}

	setSkipHideOwnCameraConfirm(value: boolean): void {
		this.skipHideOwnCameraConfirm = value;
	}

	getSkipHideOwnScreenShareConfirm(): boolean {
		return this.skipHideOwnScreenShareConfirm;
	}

	setSkipHideOwnScreenShareConfirm(value: boolean): void {
		this.skipHideOwnScreenShareConfirm = value;
	}
}

export default new VoicePromptsStore();
