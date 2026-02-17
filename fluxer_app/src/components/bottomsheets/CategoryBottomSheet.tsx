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
import {useCategoryMenuData} from '@app/components/uikit/context_menu/items/CategoryMenuData';
import {MenuBottomSheet} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import {useMuteSheet} from '@app/hooks/useMuteSheet';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useMemo} from 'react';

interface CategoryBottomSheetProps {
	isOpen: boolean;
	onClose: () => void;
	category: ChannelRecord;
}

export const CategoryBottomSheet: React.FC<CategoryBottomSheetProps> = observer(({isOpen, onClose, category}) => {
	const {t} = useLingui();

	const additionalMutePayload = useMemo(() => ({collapsed: true}), []);

	const {muteSheetOpen, openMuteSheet, closeMuteSheet, handleMute, handleUnmute, muteConfig} = useMuteSheet({
		guildId: category.guildId ?? null,
		channelId: category.id,
		additionalMutePayload,
	});

	const {groups, state} = useCategoryMenuData(category, {
		onClose,
		onOpenMuteSheet: openMuteSheet,
	});

	return (
		<>
			<MenuBottomSheet isOpen={isOpen} onClose={onClose} groups={groups} title={category.name ?? t`Category Options`} />

			<MuteDurationSheet
				isOpen={muteSheetOpen}
				onClose={closeMuteSheet}
				isMuted={state.isMuted}
				mutedText={state.mutedText}
				muteConfig={muteConfig}
				muteTitle={t`Mute Category`}
				unmuteTitle={t`Unmute Category`}
				onMute={handleMute}
				onUnmute={handleUnmute}
			/>
		</>
	);
});
