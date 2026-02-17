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
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import KeybindManager from '@app/lib/KeybindManager';
import InputMonitoringPromptsStore from '@app/stores/InputMonitoringPromptsStore';
import {openNativePermissionSettings, requestNativePermission} from '@app/utils/NativePermissions';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useRef, useState} from 'react';

interface InputMonitoringCTAModalProps {
	onComplete?: () => void;
}

export const InputMonitoringCTAModal: React.FC<InputMonitoringCTAModalProps> = observer(({onComplete}) => {
	const {t} = useLingui();
	const [submitting, setSubmitting] = useState(false);
	const initialFocusRef = useRef<HTMLButtonElement | null>(null);

	const handleEnable = async () => {
		setSubmitting(true);
		try {
			const result = await requestNativePermission('input-monitoring');

			if (result === 'granted') {
				ToastActionCreators.createToast({type: 'success', children: t`Input Monitoring enabled`});
				await KeybindManager.reapplyGlobalShortcuts();
			} else if (result === 'denied') {
				await openNativePermissionSettings('input-monitoring');
				ToastActionCreators.createToast({
					type: 'info',
					children: t`Please enable Fluxer in System Settings → Privacy & Security → Input Monitoring.`,
				});
			}

			InputMonitoringPromptsStore.dismissInputMonitoringCTA();
			ModalActionCreators.pop();
			onComplete?.();
		} finally {
			setSubmitting(false);
		}
	};

	const handleDismiss = () => {
		InputMonitoringPromptsStore.dismissInputMonitoringCTA();
		ModalActionCreators.pop();
		onComplete?.();
	};

	return (
		<Modal.Root size="small" centered initialFocusRef={initialFocusRef}>
			<Modal.Header title={t`Enable Input Monitoring`} />
			<Modal.Content>
				<Modal.ContentLayout>
					<Modal.Description>
						<Trans>
							Fluxer needs permission to monitor keyboard and mouse input so that <strong>Push-to-Talk</strong> and{' '}
							<strong>Global Shortcuts</strong> work even when you're in another app or game.
						</Trans>
					</Modal.Description>
					<Modal.Description>
						<Trans>
							This is required to detect any key or mouse button you choose for Push-to-Talk. You can change this later
							in <strong>System Settings → Privacy & Security → Input Monitoring</strong>.
						</Trans>
					</Modal.Description>
				</Modal.ContentLayout>
			</Modal.Content>
			<Modal.Footer>
				<Button onClick={handleDismiss} variant="secondary">
					<Trans>Not Now</Trans>
				</Button>
				<Button onClick={handleEnable} submitting={submitting} variant="primary" ref={initialFocusRef}>
					<Trans>Enable Input Monitoring</Trans>
				</Button>
			</Modal.Footer>
		</Modal.Root>
	);
});
