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

import {MentionUserIcon} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {ComponentDispatch} from '@app/lib/ComponentDispatch';
import type {UserRecord} from '@app/records/UserRecord';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback} from 'react';

interface MentionUserMenuItemProps {
	user: UserRecord;
	onClose: () => void;
}

export const MentionUserMenuItem: React.FC<MentionUserMenuItemProps> = observer(({user, onClose}) => {
	const {t} = useLingui();
	const handleMentionUser = useCallback(() => {
		onClose();
		ComponentDispatch.dispatch('INSERT_MENTION', {userId: user.id});
	}, [user.id, onClose]);

	return (
		<MenuItem icon={<MentionUserIcon size={16} />} onClick={handleMentionUser}>
			{t`Mention`}
		</MenuItem>
	);
});
