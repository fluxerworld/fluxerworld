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
import * as NagbarActionCreators from '@app/actions/NagbarActionCreators';
import {Nagbar} from '@app/components/layout/Nagbar';
import {NagbarButton} from '@app/components/layout/NagbarButton';
import {NagbarContent} from '@app/components/layout/NagbarContent';
import {UserSettingsModal} from '@app/components/modals/UserSettingsModal';
import UserStore from '@app/stores/UserStore';
import * as LocaleUtils from '@app/utils/LocaleUtils';
import {getFormattedDateTime} from '@fluxer/date_utils/src/DateFormatting';
import {formatNumber} from '@fluxer/number_utils/src/NumberFormatting';
import {Trans} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback} from 'react';

export const PendingBulkDeletionNagbar = observer(({isMobile}: {isMobile: boolean}) => {
	const pending = UserStore.currentUser?.getPendingBulkMessageDeletion();
	const locale = LocaleUtils.getCurrentLocale();
	const scheduleKey = pending?.scheduledAt.toISOString();
	const handleHideNagbar = useCallback(() => {
		if (!scheduleKey) {
			return;
		}

		NagbarActionCreators.dismissPendingBulkDeletionNagbar(scheduleKey);
	}, [scheduleKey]);

	if (!pending) {
		return null;
	}

	const channelCountLabel = formatNumber(pending.channelCount, locale);
	const messageCountLabel = formatNumber(pending.messageCount, locale);
	const scheduledLabel = getFormattedDateTime(pending.scheduledAt, locale);

	const openDeletionSettings = () => {
		ModalActionCreators.push(
			modal(() => <UserSettingsModal initialTab="privacy_safety" initialSubtab="data-deletion" />),
		);
	};

	return (
		<Nagbar
			isMobile={isMobile}
			backgroundColor="var(--status-danger)"
			textColor="#ffffff"
			dismissible
			onDismiss={handleHideNagbar}
		>
			<NagbarContent
				isMobile={isMobile}
				onDismiss={handleHideNagbar}
				message={
					<Trans>
						Deletion of <strong>{messageCountLabel}</strong> messages from <strong>{channelCountLabel}</strong> channels
						is scheduled for <strong>{scheduledLabel}</strong>. Cancel it from the Privacy Dashboard.
					</Trans>
				}
				actions={
					<NagbarButton isMobile={isMobile} onClick={openDeletionSettings}>
						<Trans>Review deletion</Trans>
					</NagbarButton>
				}
			/>
		</Nagbar>
	);
});
