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

import * as RelationshipActionCreators from '@app/actions/RelationshipActionCreators';
import {BaseChangeNicknameModal} from '@app/components/modals/BaseChangeNicknameModal';
import type {UserRecord} from '@app/records/UserRecord';
import RelationshipStore from '@app/stores/RelationshipStore';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback} from 'react';

interface ChangeFriendNicknameModalProps {
	user: UserRecord;
}

export const ChangeFriendNicknameModal: React.FC<ChangeFriendNicknameModalProps> = observer(({user}) => {
	const relationship = RelationshipStore.getRelationship(user.id);
	const currentNick = relationship?.nickname ?? '';

	const handleSave = useCallback(
		async (nick: string | null) => {
			await RelationshipActionCreators.updateFriendNickname(user.id, nick);
		},
		[user.id],
	);

	return <BaseChangeNicknameModal currentNick={currentNick} displayName={user.displayName} onSave={handleSave} />;
});
