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
import {modal} from '@app/actions/ModalActionCreators';
import {useSettingsContentKey} from '@app/components/modals/hooks/useSettingsContentKey';
import {useUnsavedChangesFlash} from '@app/components/modals/hooks/useUnsavedChangesFlash';
import {
	SettingsTabContainer,
	SettingsTabContent,
	SettingsTabSection,
} from '@app/components/modals/shared/SettingsTabLayout';
import {StatusSlate} from '@app/components/modals/shared/StatusSlate';
import {ApplicationCreateModal} from '@app/components/modals/tabs/applications_tab/ApplicationCreateModal';
import {ApplicationDetail} from '@app/components/modals/tabs/applications_tab/ApplicationDetail';
import {ApplicationsList} from '@app/components/modals/tabs/applications_tab/ApplicationsList';
import styles from '@app/components/modals/tabs/applications_tab/ApplicationsTab.module.css';
import ApplicationsTabStore from '@app/components/modals/tabs/applications_tab/ApplicationsTabStore';
import {Button} from '@app/components/uikit/button/Button';
import {Spinner} from '@app/components/uikit/Spinner';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import type {DeveloperApplication} from '@app/records/DeveloperApplicationRecord';
import UserStore from '@app/stores/UserStore';
import {Trans, useLingui} from '@lingui/react/macro';
import {BookOpenIcon, WarningCircleIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useLayoutEffect} from 'react';

const ApplicationsTab: React.FC = observer(() => {
	const {t} = useLingui();
	const {checkUnsavedChanges} = useUnsavedChangesFlash('applications');
	const {setContentKey} = useSettingsContentKey();
	const store = ApplicationsTabStore;
	const isUnclaimed = !(UserStore.currentUser?.isClaimed() ?? false);

	useLayoutEffect(() => {
		setContentKey(store.contentKey);
	}, [store.contentKey, setContentKey]);

	useEffect(() => {
		void store.fetchApplications({showLoading: store.applications.length === 0});
	}, [store]);

	const handleSelectApplication = useCallback(
		(appId: string) => {
			if (checkUnsavedChanges()) return;
			void store.navigateToDetail(appId);
		},
		[store, checkUnsavedChanges],
	);

	const openCreateModal = useCallback(() => {
		ModalActionCreators.push(
			modal(() => (
				<ApplicationCreateModal
					onCreated={async (app: DeveloperApplication) => {
						await store.navigateToDetail(app.id, app);
						void store.fetchApplications({showLoading: false});
					}}
				/>
			)),
		);
	}, [store]);

	const handleBackToList = useCallback(() => {
		if (checkUnsavedChanges()) return;
		void store.navigateToList();
	}, [store, checkUnsavedChanges]);

	if (store.navigationState === 'LOADING_LIST' || (store.isLoading && store.isListView)) {
		return (
			<SettingsTabContainer>
				<SettingsTabContent>
					<div className={styles.spinnerContainer}>
						<Spinner />
					</div>
				</SettingsTabContent>
			</SettingsTabContainer>
		);
	}

	if (store.navigationState === 'ERROR' && store.isListView) {
		return (
			<SettingsTabContainer>
				<SettingsTabContent>
					<SettingsTabSection
						title={<Trans>Applications &amp; Bots</Trans>}
						description={<Trans>Manage your applications and bots.</Trans>}
					>
						<StatusSlate
							Icon={WarningCircleIcon}
							title={<Trans>Unable to load applications</Trans>}
							description={<Trans>Check your connection and try again.</Trans>}
							actions={[
								{
									text: <Trans>Retry</Trans>,
									onClick: () => store.fetchApplications({showLoading: true}),
								},
							]}
						/>
					</SettingsTabSection>
				</SettingsTabContent>
			</SettingsTabContainer>
		);
	}

	if (store.isDetailView && store.selectedAppId) {
		return (
			<SettingsTabContainer>
				<SettingsTabContent>
					<ApplicationDetail
						applicationId={store.selectedAppId}
						onBack={handleBackToList}
						initialApplication={store.selectedApplication}
					/>
				</SettingsTabContent>
			</SettingsTabContainer>
		);
	}

	return (
		<SettingsTabContainer>
			<SettingsTabContent>
				<SettingsTabSection
					title={<Trans>Applications &amp; Bots</Trans>}
					description={<Trans>Create and manage applications and bots for your account.</Trans>}
				>
					<div className={styles.buttonContainer}>
						{isUnclaimed ? (
							<Tooltip text={t`Claim your account to create applications.`}>
								<div>
									<Button variant="primary" fitContainer={false} fitContent onClick={openCreateModal} disabled>
										<Trans>Create Application</Trans>
									</Button>
								</div>
							</Tooltip>
						) : (
							<Button variant="primary" fitContainer={false} fitContent onClick={openCreateModal}>
								<Trans>Create Application</Trans>
							</Button>
						)}
						<a className={styles.documentationLink} href="https://fluxer.dev" target="_blank" rel="noreferrer">
							<BookOpenIcon weight="fill" size={18} className={styles.documentationIcon} />
							<Trans>Read the Documentation (fluxer.dev)</Trans>
						</a>
					</div>
					<ApplicationsList applications={store.applications} onSelectApplication={handleSelectApplication} />
				</SettingsTabSection>
			</SettingsTabContent>
		</SettingsTabContainer>
	);
});

export default ApplicationsTab;
