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
import * as VoiceSettingsActionCreators from '@app/actions/VoiceSettingsActionCreators';
import styles from '@app/components/modals/DisablePiPConfirmModal.module.css';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import {Checkbox} from '@app/components/uikit/checkbox/Checkbox';
import PiPStore from '@app/stores/PiPStore';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useRef, useState} from 'react';

export const DisablePiPConfirmModal = observer(() => {
	const {t} = useLingui();
	const [rememberPreference, setRememberPreference] = useState(false);
	const initialFocusRef = useRef<HTMLButtonElement | null>(null);

	const handleConfirm = () => {
		if (rememberPreference) {
			VoiceSettingsActionCreators.update({disablePictureInPicturePopout: true});
		} else {
			PiPStore.setSessionDisable(true);
		}
		PiPStore.close();
		ModalActionCreators.pop();
	};

	const handleCancel = () => {
		ModalActionCreators.pop();
	};

	return (
		<Modal.Root size="small" centered initialFocusRef={initialFocusRef}>
			<Modal.Header title={t`Hide Picture-in-Picture Popout?`} />
			<Modal.Content>
				<p className={styles.description}>
					<Trans>
						If you don't remember this preference, we'll only hide the popout for this session. You can change this any
						time in User Settings &gt; Audio &amp; Video.
					</Trans>
				</p>
				<div className={styles.checkboxContainer}>
					<Checkbox checked={rememberPreference} onChange={(checked) => setRememberPreference(checked)} size="small">
						<span className={styles.checkboxLabel}>
							<Trans>Remember this preference</Trans>
						</span>
					</Checkbox>
				</div>
			</Modal.Content>
			<Modal.Footer>
				<Button variant="secondary" onClick={handleCancel}>
					{t`Cancel`}
				</Button>
				<Button variant="primary" onClick={handleConfirm} ref={initialFocusRef}>
					{t`Close popout`}
				</Button>
			</Modal.Footer>
		</Modal.Root>
	);
});
