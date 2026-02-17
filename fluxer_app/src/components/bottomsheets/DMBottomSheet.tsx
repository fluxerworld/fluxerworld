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

import {MuteDurationSheet} from '@app/components/bottomsheets/MuteDurationSheet';
import {useDMMenuData} from '@app/components/uikit/context_menu/items/DMMenuData';
import {MenuBottomSheet} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import {useMuteSheet} from '@app/hooks/useMuteSheet';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {UserRecord} from '@app/records/UserRecord';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';

interface DMBottomSheetProps {
	isOpen: boolean;
	onClose: () => void;
	channel: ChannelRecord;
	recipient?: UserRecord | null;
}

export const DMBottomSheet: React.FC<DMBottomSheetProps> = observer(({isOpen, onClose, channel, recipient}) => {
	const {t} = useLingui();

	const {muteSheetOpen, openMuteSheet, closeMuteSheet, handleMute, handleUnmute, muteConfig} = useMuteSheet({
		guildId: null,
		channelId: channel.id,
		onClose,
	});

	const {groups, isMuted, mutedText} = useDMMenuData(channel, recipient, {
		onClose,
		onOpenMuteSheet: openMuteSheet,
	});

	return (
		<>
			<MenuBottomSheet isOpen={isOpen} onClose={onClose} groups={groups} />

			<MuteDurationSheet
				isOpen={muteSheetOpen}
				onClose={closeMuteSheet}
				isMuted={isMuted}
				mutedText={mutedText}
				muteConfig={muteConfig}
				muteTitle={t`Mute Conversation`}
				unmuteTitle={t`Unmute Conversation`}
				onMute={handleMute}
				onUnmute={handleUnmute}
			/>
		</>
	);
});
