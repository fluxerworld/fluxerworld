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

import * as UserProfileActionCreators from '@app/actions/UserProfileActionCreators';
import {ViewProfileIcon} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import type {UserRecord} from '@app/records/UserRecord';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback} from 'react';

interface UserProfileMenuItemProps {
	user: UserRecord;
	guildId?: string;
	onClose: () => void;
}

export const UserProfileMenuItem: React.FC<UserProfileMenuItemProps> = observer(({user, guildId, onClose}) => {
	const {t} = useLingui();
	const handleViewProfile = useCallback(() => {
		onClose();
		UserProfileActionCreators.openUserProfile(user.id, guildId);
	}, [onClose, user.id, guildId]);

	return (
		<MenuItem icon={<ViewProfileIcon size={16} />} onClick={handleViewProfile}>
			{t`View Profile`}
		</MenuItem>
	);
});
