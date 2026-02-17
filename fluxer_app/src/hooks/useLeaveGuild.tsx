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

import * as GuildActionCreators from '@app/actions/GuildActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {GenericErrorModal} from '@app/components/alerts/GenericErrorModal';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {Logger} from '@app/lib/Logger';
import {Routes} from '@app/Routes';
import * as RouterUtils from '@app/utils/RouterUtils';
import {useLingui} from '@lingui/react/macro';
import {useCallback} from 'react';

const logger = new Logger('useLeaveGuild');

export const useLeaveGuild = () => {
	const {t} = useLingui();

	return useCallback(
		(guildId: string) => {
			ModalActionCreators.push(
				modal(() => (
					<ConfirmModal
						title={t`Leave Community`}
						description={t`Are you sure you want to leave this community? You will no longer be able to see any messages.`}
						primaryText={t`Leave Community`}
						primaryVariant="danger-primary"
						onPrimary={async () => {
							try {
								await GuildActionCreators.leave(guildId);
								RouterUtils.transitionTo(Routes.ME);
								ToastActionCreators.createToast({
									type: 'success',
									children: t`Left community`,
								});
							} catch (error) {
								logger.error('Failed to leave community', error);
								window.setTimeout(() => {
									ModalActionCreators.push(
										modal(() => (
											<GenericErrorModal
												title={t`Failed to Leave Community`}
												message={t`We couldn't remove you from the community at this time.`}
											/>
										)),
									);
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
