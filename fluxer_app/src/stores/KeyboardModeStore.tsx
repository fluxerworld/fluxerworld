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

import {KeyboardModeIntroModal} from '@app/components/modals/KeyboardModeIntroModal';
import {Logger} from '@app/lib/Logger';
import {makePersistent} from '@app/lib/MobXPersistence';
import {registerKeyboardModeRestoreCallback, registerKeyboardModeStateResolver} from '@app/stores/ModalStore';
import {makeAutoObservable, runInAction} from 'mobx';

const logger = new Logger('KeyboardModeStore');

class KeyboardModeStore {
	keyboardModeEnabled = false;
	introSeen = false;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
		void makePersistent(this, 'KeyboardModeStore', ['introSeen']);
	}

	enterKeyboardMode(showIntro = true): void {
		logger.debug(
			`Entering keyboard mode (showIntro=${showIntro}) previous=${this.keyboardModeEnabled ? 'true' : 'false'}`,
		);
		runInAction(() => {
			this.keyboardModeEnabled = true;
		});

		if (showIntro && !this.introSeen) {
			this.introSeen = true;
			void import('@app/actions/ModalActionCreators').then(({modal, push}) => {
				push(modal(() => <KeyboardModeIntroModal />));
			});
		}
	}

	exitKeyboardMode(): void {
		if (!this.keyboardModeEnabled) {
			logger.debug('exitKeyboardMode ignored (already false)');
			return;
		}
		logger.debug('Exiting keyboard mode');
		runInAction(() => {
			this.keyboardModeEnabled = false;
		});
	}

	dismissIntro(): void {
		this.introSeen = true;
	}
}

const keyboardModeStore = new KeyboardModeStore();
registerKeyboardModeStateResolver(() => keyboardModeStore.keyboardModeEnabled);
registerKeyboardModeRestoreCallback((showIntro) => keyboardModeStore.enterKeyboardMode(showIntro));

export default keyboardModeStore;
