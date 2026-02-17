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

import {DataMenuRenderer} from '@app/components/uikit/context_menu/DataMenuRenderer';
import {useGuildMenuData} from '@app/components/uikit/context_menu/items/GuildMenuData';
import {MuteCommunityMenuItem} from '@app/components/uikit/context_menu/items/GuildMenuItems';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import type {GuildRecord} from '@app/records/GuildRecord';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useMemo} from 'react';

interface GuildContextMenuProps {
	guild: GuildRecord;
	onClose: () => void;
}

export const GuildContextMenu: React.FC<GuildContextMenuProps> = observer(({guild, onClose}) => {
	const {t} = useLingui();

	const {groups} = useGuildMenuData(guild, {onClose});

	const excludeLabels = useMemo(() => [t`Mute Community`, t`Unmute Community`], [t]);

	return (
		<>
			<DataMenuRenderer groups={groups} excludeLabels={excludeLabels} />

			<MenuGroup>
				<MuteCommunityMenuItem guild={guild} onClose={onClose} />
			</MenuGroup>
		</>
	);
});
