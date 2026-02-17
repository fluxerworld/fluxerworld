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

import {useVoiceParticipantMenuData} from '@app/components/uikit/context_menu/items/VoiceParticipantMenuData';
import {MenuBottomSheet} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import type {UserRecord} from '@app/records/UserRecord';
import type {LivekitParticipantSnapshot} from '@app/stores/voice/VoiceParticipantManager';
import {observer} from 'mobx-react-lite';
import type React from 'react';

interface VoiceParticipantBottomSheetProps {
	isOpen: boolean;
	onClose: () => void;
	user: UserRecord;
	guildId?: string;
	connectionId?: string;
	isConnectionItem?: boolean;
	isParentGroupedItem?: boolean;
	participant?: LivekitParticipantSnapshot;
	streamKey?: string;
	isScreenShare?: boolean;
	isWatching?: boolean;
	hasScreenShareAudio?: boolean;
	isOwnScreenShare?: boolean;
	onStopWatching?: () => void;
}

export const VoiceParticipantBottomSheet: React.FC<VoiceParticipantBottomSheetProps> = observer(
	({
		isOpen,
		onClose,
		user,
		guildId,
		connectionId,
		isConnectionItem = false,
		isParentGroupedItem = false,
		streamKey,
		isScreenShare = false,
		isWatching = false,
		hasScreenShareAudio = false,
		isOwnScreenShare = false,
		onStopWatching,
	}) => {
		const {groups} = useVoiceParticipantMenuData({
			user,
			guildId,
			connectionId,
			isGroupedItem: isConnectionItem,
			isParentGroupedItem,
			streamKey,
			isScreenShare,
			isWatching,
			hasScreenShareAudio,
			isOwnScreenShare,
			onStopWatching,
			onClose,
		});

		return <MenuBottomSheet isOpen={isOpen} onClose={onClose} groups={groups} />;
	},
);
