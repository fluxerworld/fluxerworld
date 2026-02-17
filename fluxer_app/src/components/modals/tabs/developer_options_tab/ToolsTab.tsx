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
import * as PrivateChannelActionCreators from '@app/actions/PrivateChannelActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import * as TrustedDomainActionCreators from '@app/actions/TrustedDomainActionCreators';
import * as UserActionCreators from '@app/actions/UserActionCreators';
import {testBulkDeleteAllMessages} from '@app/actions/UserActionCreators';
import {CaptchaModal} from '@app/components/modals/CaptchaModal';
import {openClaimAccountModal} from '@app/components/modals/ClaimAccountModal';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {KeyboardModeIntroModal} from '@app/components/modals/KeyboardModeIntroModal';
import {resetPremiumStateOverrides} from '@app/components/modals/tabs/developer_options_tab/PremiumScenarioOptions';
import styles from '@app/components/modals/tabs/developer_options_tab/ToolsTab.module.css';
import {Button} from '@app/components/uikit/button/Button';
import {useSudo} from '@app/hooks/useSudo';
import type {GatewaySocket} from '@app/lib/GatewaySocket';
import {Logger} from '@app/lib/Logger';
import NewDeviceMonitoringStore from '@app/stores/NewDeviceMonitoringStore';
import TrustedDomainStore from '@app/stores/TrustedDomainStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import {FLUXERBOT_ID} from '@fluxer/constants/src/AppConstants';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useState} from 'react';

const logger = new Logger('ToolsTab');

interface ToolsTabContentProps {
	socket: GatewaySocket;
}

export const ToolsTabContent: React.FC<ToolsTabContentProps> = observer(({socket}) => {
	const {t} = useLingui();
	const sudo = useSudo();
	const [isTestingBulkDelete, setIsTestingBulkDelete] = useState(false);
	const [shouldCrash, setShouldCrash] = useState(false);
	const [isForgettingAuthorizedIps, setIsForgettingAuthorizedIps] = useState(false);
	const [isClearingTrustedDomains, setIsClearingTrustedDomains] = useState(false);
	const [isResettingPremiumState, setIsResettingPremiumState] = useState(false);
	const trustedDomainsCount = TrustedDomainStore.getTrustedDomainsCount();

	const handleTestBulkDelete = useCallback(async () => {
		setIsTestingBulkDelete(true);
		try {
			await testBulkDeleteAllMessages();
		} finally {
			setIsTestingBulkDelete(false);
		}
	}, []);

	const handleOpenCaptchaModal = useCallback(() => {
		ModalActionCreators.push(
			ModalActionCreators.modal(() => (
				<CaptchaModal
					closeOnVerify={false}
					onVerify={(token, captchaType) => {
						logger.debug('Captcha solved in Developer Options', {token, captchaType});
					}}
					onCancel={() => {
						logger.debug('Captcha cancelled in Developer Options');
					}}
				/>
			)),
		);
	}, []);

	const handleOpenClaimAccountModal = useCallback(() => {
		openClaimAccountModal({force: true});
	}, []);

	const handleOpenSystemDm = useCallback(() => {
		void PrivateChannelActionCreators.openDMChannel(FLUXERBOT_ID);
	}, []);

	const handleForgetAuthorizedIps = useCallback(async () => {
		setIsForgettingAuthorizedIps(true);
		try {
			const sudoPayload = await sudo.require();
			await UserActionCreators.forgetAuthorizedIps(sudoPayload);
			sudo.finalize();
			ToastActionCreators.createToast({
				type: 'success',
				children: t`Authorized IPs cleared. New logins will require email verification.`,
			});
		} catch (error) {
			logger.error('Failed to forget authorized IPs', error);
			ToastActionCreators.createToast({
				type: 'error',
				children: t`Failed to forget authorized IPs. Please try again.`,
			});
		} finally {
			setIsForgettingAuthorizedIps(false);
		}
	}, [sudo, t]);

	const handleForgetAuthorizedIpsClick = useCallback(() => {
		ModalActionCreators.push(
			ModalActionCreators.modal(() => (
				<ConfirmModal
					title={t`Forget Authorized IPs`}
					description={
						<Trans>
							This removes all previously authorized IP addresses on your account. The next login from any IP will
							require email verification.
						</Trans>
					}
					primaryText={t`Forget Authorized IPs`}
					primaryVariant="danger-primary"
					onPrimary={async () => {
						await handleForgetAuthorizedIps();
					}}
				/>
			)),
		);
	}, [handleForgetAuthorizedIps, t]);

	const handleClearTrustedDomains = useCallback(async () => {
		setIsClearingTrustedDomains(true);
		try {
			await TrustedDomainActionCreators.clearAllTrustedDomains();
			ToastActionCreators.createToast({
				type: 'success',
				children: t`Trusted domains cleared.`,
			});
		} catch (error) {
			logger.error('Failed to clear trusted domains', error);
			ToastActionCreators.createToast({
				type: 'error',
				children: t`Failed to clear trusted domains.`,
			});
		} finally {
			setIsClearingTrustedDomains(false);
		}
	}, [t]);

	const handleClearTrustedDomainsClick = useCallback(() => {
		ModalActionCreators.push(
			ModalActionCreators.modal(() => (
				<ConfirmModal
					title={t`Clear Trusted Domains`}
					description={
						<Trans>
							This will remove all trusted domains. You will see the external link warning for all domains again.
						</Trans>
					}
					primaryText={t`Clear Trusted Domains`}
					primaryVariant="danger-primary"
					onPrimary={handleClearTrustedDomains}
				/>
			)),
		);
	}, [handleClearTrustedDomains, t]);

	const handleResetPremiumState = useCallback(async () => {
		setIsResettingPremiumState(true);
		try {
			await UserActionCreators.resetPremiumState();
			resetPremiumStateOverrides();
			ToastActionCreators.createToast({
				type: 'success',
				children: t`Premium state reset on the backend.`,
			});
		} catch (error) {
			logger.error('Failed to reset premium state', error);
			ToastActionCreators.createToast({
				type: 'error',
				children: t`Failed to reset premium state.`,
			});
		} finally {
			setIsResettingPremiumState(false);
		}
	}, [t]);

	const handleResetPremiumStateClick = useCallback(() => {
		ModalActionCreators.push(
			ModalActionCreators.modal(() => (
				<ConfirmModal
					title={t`Reset Premium State`}
					description={
						<Trans>
							This clears your backend premium state entirely, including premium type, billing metadata, and override
							flags.
						</Trans>
					}
					primaryText={t`Reset Premium State`}
					primaryVariant="danger-primary"
					onPrimary={handleResetPremiumState}
				/>
			)),
		);
	}, [handleResetPremiumState, t]);

	if (shouldCrash) {
		return null;
	}

	return (
		<div className={styles.buttonGroup}>
			<Button onClick={() => socket.reset()}>{t`Reset Socket`}</Button>
			<Button onClick={() => socket.simulateNetworkDisconnect()}>{t`Disconnect Socket`}</Button>
			<Button
				onClick={() => {
					void MediaEngineStore.moveToAfkChannel();
				}}
			>
				{t`Force Move to AFK Channel`}
			</Button>
			<Button onClick={() => NewDeviceMonitoringStore.showTestModal()}>{t`Show new device modal`}</Button>
			<Button onClick={handleOpenCaptchaModal}>{t`Open Captcha Modal`}</Button>

			<Button
				onClick={() => {
					ModalActionCreators.push(ModalActionCreators.modal(() => <KeyboardModeIntroModal />));
				}}
			>
				{t`Show keyboard mode intro`}
			</Button>
			<Button onClick={handleOpenClaimAccountModal}>{t`Open claim account modal`}</Button>
			<Button onClick={handleOpenSystemDm}>{t`Open System DM`}</Button>
			<Button onClick={() => void handleTestBulkDelete()} submitting={isTestingBulkDelete} variant="danger-primary">
				{t`Test Bulk Delete (60s)`}
			</Button>
			<Button
				onClick={handleForgetAuthorizedIpsClick}
				submitting={isForgettingAuthorizedIps}
				variant="danger-secondary"
			>
				{t`Forget Authorized IPs`}
			</Button>
			<Button
				onClick={handleClearTrustedDomainsClick}
				submitting={isClearingTrustedDomains}
				variant="danger-secondary"
				disabled={trustedDomainsCount === 0 && !TrustedDomainStore.trustAllDomains}
			>
				{TrustedDomainStore.trustAllDomains
					? t`Clear trust all setting`
					: trustedDomainsCount === 0
						? t`No Trusted Domains`
						: t`Clear ${trustedDomainsCount} Trusted Domain(s)`}
			</Button>
			<Button onClick={handleResetPremiumStateClick} submitting={isResettingPremiumState} variant="danger-secondary">
				{t`Reset Premium State`}
			</Button>
			<Button onClick={() => setShouldCrash(true)} variant="danger-primary">
				{t`Trigger React Crash`}
			</Button>
		</div>
	);
});
