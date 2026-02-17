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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import styles from '@app/components/modals/KeyboardModeIntroModal.module.css';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import KeyboardModeStore from '@app/stores/KeyboardModeStore';
import {SHIFT_KEY_SYMBOL} from '@app/utils/KeyboardUtils';
import {isNativeMacOS} from '@app/utils/NativeUtils';
import {useLingui} from '@lingui/react/macro';
import {useCallback, useRef} from 'react';

export function KeyboardModeIntroModal() {
	const {t} = useLingui();
	const initialFocusRef = useRef<HTMLButtonElement | null>(null);
	const title = t`Keyboard Mode`;
	const commandKeyLabel = isNativeMacOS() ? '⌘' : 'Ctrl';

	const handleClose = useCallback(() => {
		KeyboardModeStore.dismissIntro();
		ModalActionCreators.pop();
	}, []);

	return (
		<Modal.Root size="small" centered initialFocusRef={initialFocusRef}>
			<Modal.Header title={title} />
			<Modal.Content contentClassName={styles.content}>
				<p className={styles.description}>
					{t`You just pressed Tab. Keyboard Mode is now on so you can navigate Fluxer without a mouse.`}
				</p>

				<ul className={styles.tips}>
					<li className={styles.tip}>
						<div className={styles.keys} aria-hidden="true">
							<kbd className={styles.kbd}>Tab</kbd>
							<span className={styles.separator}>{t`or`}</span>
							<kbd className={styles.kbd}>{SHIFT_KEY_SYMBOL}</kbd>
							<span className={styles.separator}>+</span>
							<kbd className={styles.kbd}>Tab</kbd>
						</div>
						<p className={styles.tipText}>{t`Move focus across buttons, inputs, and links.`}</p>
					</li>

					<li className={styles.tip}>
						<div className={styles.keys} aria-hidden="true">
							<kbd className={styles.kbd}>↑</kbd>
							<kbd className={styles.kbd}>↓</kbd>
						</div>
						<p className={styles.tipText}>{t`Step through messages and action bars in chat.`}</p>
					</li>

					<li className={styles.tip}>
						<div className={styles.keys} aria-hidden="true">
							<kbd className={styles.kbd}>{commandKeyLabel}</kbd>
							<kbd className={styles.kbd}>/</kbd>
						</div>
						<p className={styles.tipText}>{t`Open the shortcuts list anytime for quick actions.`}</p>
					</li>
				</ul>
			</Modal.Content>
			<Modal.Footer>
				<Button onClick={handleClose} ref={initialFocusRef} variant="primary">
					{t`Got it`}
				</Button>
			</Modal.Footer>
		</Modal.Root>
	);
}
