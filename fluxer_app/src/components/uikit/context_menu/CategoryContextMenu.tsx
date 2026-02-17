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
import {useCategoryMenuData} from '@app/components/uikit/context_menu/items/CategoryMenuData';
import {MuteCategoryMenuItem} from '@app/components/uikit/context_menu/items/CategoryMenuItems';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useMemo} from 'react';

interface CategoryContextMenuProps {
	category: ChannelRecord;
	onClose: () => void;
}

export const CategoryContextMenu: React.FC<CategoryContextMenuProps> = observer(({category, onClose}) => {
	const {t} = useLingui();

	const {groups} = useCategoryMenuData(category, {onClose});

	const excludeLabels = useMemo(() => [t`Mute Category`, t`Unmute Category`], [t]);

	return (
		<>
			<DataMenuRenderer groups={groups} excludeLabels={excludeLabels} />

			<MenuGroup>
				<MuteCategoryMenuItem category={category} onClose={onClose} />
			</MenuGroup>
		</>
	);
});
