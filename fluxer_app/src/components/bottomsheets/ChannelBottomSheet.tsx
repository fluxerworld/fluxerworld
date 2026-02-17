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
import {useChannelMenuData} from '@app/components/uikit/context_menu/items/ChannelMenuData';
import {MenuBottomSheet} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import {useMuteSheet} from '@app/hooks/useMuteSheet';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {GuildRecord} from '@app/records/GuildRecord';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';

interface ChannelBottomSheetProps {
	isOpen: boolean;
	onClose: () => void;
	channel: ChannelRecord;
	guild?: GuildRecord;
}

export const ChannelBottomSheet: React.FC<ChannelBottomSheetProps> = observer(({isOpen, onClose, channel, guild}) => {
	const {t} = useLingui();

	const {muteSheetOpen, muteConfig, openMuteSheet, closeMuteSheet, handleMute, handleUnmute} = useMuteSheet({
		guildId: guild?.id ?? null,
		channelId: channel.id,
	});

	const {groups, state} = useChannelMenuData(channel, guild, {
		onClose,
		onOpenMuteSheet: openMuteSheet,
	});

	return (
		<>
			<MenuBottomSheet isOpen={isOpen} onClose={onClose} groups={groups} title={channel.name ?? t`Channel Options`} />

			<MuteDurationSheet
				isOpen={muteSheetOpen}
				onClose={closeMuteSheet}
				isMuted={state.isMuted}
				mutedText={state.mutedText}
				muteConfig={muteConfig}
				muteTitle={t`Mute Channel`}
				unmuteTitle={t`Unmute Channel`}
				onMute={handleMute}
				onUnmute={handleUnmute}
			/>
		</>
	);
});
