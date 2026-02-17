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

import * as ChannelActionCreators from '@app/actions/ChannelActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {GroupLeaveFailedModal} from '@app/components/alerts/GroupLeaveFailedModal';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {Checkbox} from '@app/components/uikit/checkbox/Checkbox';
import {Logger} from '@app/lib/Logger';
import {Routes} from '@app/Routes';
import SelectedChannelStore from '@app/stores/SelectedChannelStore';
import * as RouterUtils from '@app/utils/RouterUtils';
import {ME} from '@fluxer/constants/src/AppConstants';
import {useLingui} from '@lingui/react/macro';
import {useCallback} from 'react';

const logger = new Logger('useLeaveGroup');

export const useLeaveGroup = () => {
	const {t} = useLingui();

	return useCallback(
		(channelId: string) => {
			ModalActionCreators.push(
				modal(() => (
					<ConfirmModal
						title={t`Leave Group`}
						description={t`Are you sure you want to leave this group? You will no longer be able to see any messages.`}
						primaryText={t`Leave Group`}
						primaryVariant="danger-primary"
						checkboxContent={<Checkbox>{t`Leave without notifying other members`}</Checkbox>}
						onPrimary={async (checkboxChecked = false) => {
							try {
								await ChannelActionCreators.remove(channelId, checkboxChecked);
								const selectedChannel = SelectedChannelStore.selectedChannelIds.get(ME);
								if (selectedChannel === channelId) {
									RouterUtils.transitionTo(Routes.ME);
								}
								ToastActionCreators.createToast({
									type: 'success',
									children: t`Left group`,
								});
							} catch (error) {
								logger.error('Failed to leave group', error);
								window.setTimeout(() => {
									ModalActionCreators.push(modal(() => <GroupLeaveFailedModal />));
								}, 0);
							}
						}}
					/>
				)),
			);
		},
		[t],
	);
};
