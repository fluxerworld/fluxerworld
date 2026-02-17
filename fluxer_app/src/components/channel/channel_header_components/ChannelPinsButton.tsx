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

import {ChannelPinsBottomSheet} from '@app/components/bottomsheets/ChannelPinsBottomSheet';
import styles from '@app/components/channel/ChannelHeader.module.css';
import {ChannelHeaderIcon} from '@app/components/channel/channel_header_components/ChannelHeaderIcon';
import {ChannelPinsPopout} from '@app/components/popouts/ChannelPinsPopout';
import {Popout} from '@app/components/uikit/popout/Popout';
import {usePopout} from '@app/hooks/usePopout';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import ReadStateStore from '@app/stores/ReadStateStore';
import {useLingui} from '@lingui/react/macro';
import {PushPinIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useCallback, useState} from 'react';

interface ChannelPinsButtonProps {
	channel: ChannelRecord;
}

export const ChannelPinsButton = observer(({channel}: ChannelPinsButtonProps) => {
	const {t} = useLingui();
	const {isOpen, openProps} = usePopout('channel-pins');
	const isMobile = MobileLayoutStore.isMobileLayout();
	const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
	const hasUnreadPins = ReadStateStore.hasUnreadPins(channel.id);

	const handleClick = useCallback(() => {
		if (isMobile) {
			setIsBottomSheetOpen(true);
		}
	}, [isMobile]);

	const indicator = hasUnreadPins ? <div className={styles.unreadPinIndicator} /> : null;

	if (isMobile) {
		return (
			<>
				<div className={styles.iconButtonWrapper}>
					<ChannelHeaderIcon
						icon={PushPinIcon}
						label={t`Pinned Messages`}
						isSelected={isBottomSheetOpen}
						onClick={handleClick}
						keybindAction="toggle_pins_popout"
					/>
					{indicator}
				</div>
				<ChannelPinsBottomSheet
					isOpen={isBottomSheetOpen}
					onClose={() => setIsBottomSheetOpen(false)}
					channel={channel}
				/>
			</>
		);
	}

	return (
		<Popout
			{...openProps}
			render={() => <ChannelPinsPopout channel={channel} />}
			position="bottom-end"
			subscribeTo="CHANNEL_PINS_OPEN"
		>
			<div className={styles.iconButtonWrapper}>
				<ChannelHeaderIcon
					icon={PushPinIcon}
					label={t`Pinned Messages`}
					isSelected={isOpen}
					keybindAction="toggle_pins_popout"
				/>
				{indicator}
			</div>
		</Popout>
	);
});
