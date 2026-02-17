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

import * as AuthenticationActionCreators from '@app/actions/AuthenticationActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import styles from '@app/components/layout/AppLayout.module.css';
import {useAppLayoutState} from '@app/components/layout/app_layout/AppLayoutHooks';
import {SplashScreen} from '@app/components/layout/SplashScreen';
import RequiredActionModal from '@app/components/modals/RequiredActionModal';
import {NewDeviceMonitoringManager} from '@app/components/voice/NewDeviceMonitoringManager';
import {VoiceReconnectionManager} from '@app/components/voice/VoiceReconnectionManager';
import AccountManager from '@app/stores/AccountManager';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import GatewayConnectionStore from '@app/stores/gateway/GatewayConnectionStore';
import InitializationStore from '@app/stores/InitializationStore';
import ModalStore from '@app/stores/ModalStore';
import UserStore from '@app/stores/UserStore';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useEffect} from 'react';

export const AppLayout = observer(({children}: {children: React.ReactNode}) => {
	const isAuthenticated = AuthenticationStore.isAuthenticated;
	const socket = GatewayConnectionStore.socket;
	const user = UserStore.currentUser;

	const appState = useAppLayoutState();

	useEffect(() => {
		if (InitializationStore.isLoading) {
			return;
		}
		void AuthenticationActionCreators.ensureSessionStarted();
	}, [
		isAuthenticated,
		socket,
		GatewayConnectionStore.isConnected,
		GatewayConnectionStore.isConnecting,
		InitializationStore.isLoading,
		AccountManager.isSwitching,
	]);

	useEffect(() => {
		const hasRequired = !!(user?.requiredActions && user.requiredActions.length > 0);
		const isOpen = ModalStore.getModal()?.key === 'required-actions';
		if (hasRequired && !isOpen) {
			ModalActionCreators.pushWithKey(
				modal(() => <RequiredActionModal mock={false} />),
				'required-actions',
			);
		}
		if (!hasRequired && isOpen) {
			ModalActionCreators.pop();
		}
	}, [user?.requiredActions?.length]);

	return (
		<>
			{isAuthenticated && <SplashScreen />}
			{isAuthenticated && socket && <VoiceReconnectionManager />}
			{isAuthenticated && <NewDeviceMonitoringManager />}
			<div className={clsx(styles.appLayout, appState.isStandalone && styles.appLayoutStandalone)}>{children}</div>
		</>
	);
});
