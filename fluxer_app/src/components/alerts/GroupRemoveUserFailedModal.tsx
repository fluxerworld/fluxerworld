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

import {GenericErrorModal} from '@app/components/alerts/GenericErrorModal';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type {ReactElement} from 'react';

interface GroupRemoveUserFailedModalProps {
	username: string;
}

export const GroupRemoveUserFailedModal = observer(({username}: GroupRemoveUserFailedModalProps) => {
	const {t} = useLingui();
	const message: ReactElement = (
		<Trans>
			We couldn't remove the user from the group at this time. <strong>{username}</strong> is still in the group.
		</Trans>
	);
	return <GenericErrorModal title={t`Failed to Remove from Group`} message={message} />;
});
