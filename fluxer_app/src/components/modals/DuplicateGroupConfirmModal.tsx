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
import * as NavigationActionCreators from '@app/actions/NavigationActionCreators';
import {GroupDMAvatar} from '@app/components/common/GroupDMAvatar';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import styles from '@app/components/modals/DuplicateGroupConfirmModal.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import * as ChannelUtils from '@app/utils/ChannelUtils';
import {formatShortRelativeTime} from '@fluxer/date_utils/src/DateDuration';
import * as SnowflakeUtils from '@fluxer/snowflake/src/SnowflakeUtils';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback, useMemo} from 'react';

interface DuplicateGroupConfirmModalProps {
	channels: Array<ChannelRecord>;
	onConfirm: () => Promise<void> | void;
}

export const DuplicateGroupConfirmModal = observer(({channels, onConfirm}: DuplicateGroupConfirmModalProps) => {
	const {t} = useLingui();
	const handleChannelClick = useCallback((channelId: string) => {
		ModalActionCreators.pop();
		NavigationActionCreators.selectChannel(undefined, channelId);
	}, []);

	const description = useMemo(() => {
		return (
			<>
				<p className={styles.description}>
					<Trans>
						You already have a group with these users. Do you really want to create a new one? That&apos;s fine too!
					</Trans>
				</p>
				{channels.length > 0 && (
					<div className={styles.channelList}>
						{channels.map((channel) => {
							const lastActivitySnowflake = channel.lastMessageId ?? channel.id;
							const lastActiveText = formatShortRelativeTime(SnowflakeUtils.extractTimestamp(lastActivitySnowflake));
							const lastActiveLabel = lastActiveText || t`No activity yet`;

							return (
								<FocusRing key={channel.id} offset={-2}>
									<button type="button" className={styles.channelItem} onClick={() => handleChannelClick(channel.id)}>
										<div className={styles.avatarWrapper}>
											<GroupDMAvatar channel={channel} size={40} />
										</div>
										<div className={styles.channelDetails}>
											<span className={styles.channelName}>{ChannelUtils.getDMDisplayName(channel)}</span>
											<span className={styles.lastActive}>{lastActiveLabel}</span>
										</div>
									</button>
								</FocusRing>
							);
						})}
					</div>
				)}
			</>
		);
	}, [channels, handleChannelClick]);

	return (
		<ConfirmModal
			title={t`Confirm New Group`}
			description={description}
			primaryText={t`Create new group`}
			primaryVariant="primary"
			secondaryText={t`Cancel`}
			size="small"
			onPrimary={onConfirm}
		/>
	);
});
