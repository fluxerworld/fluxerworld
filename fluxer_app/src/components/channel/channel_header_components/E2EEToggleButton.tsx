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

import {ChannelHeaderIcon} from '@app/components/channel/channel_header_components/ChannelHeaderIcon';
import E2EEStore from '@app/stores/E2EEStore';
import {useLingui} from '@lingui/react/macro';
import {LockKeyIcon, LockKeyOpenIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback} from 'react';

interface E2EEToggleButtonProps {
	channelId: string;
}

export const E2EEToggleButton: React.FC<E2EEToggleButtonProps> = observer(({channelId}) => {
	const {t} = useLingui();
	const enabled = E2EEStore.isChannelEncrypted(channelId);
	const ready = E2EEStore.isReady;

	const handleToggle = useCallback(() => {
		E2EEStore.setChannelEncrypted(channelId, !enabled);
	}, [channelId, enabled]);

	if (!ready) return null;

	return (
		<ChannelHeaderIcon
			icon={enabled ? LockKeyIcon : LockKeyOpenIcon}
			isSelected={enabled}
			label={enabled ? t`End-to-end encryption is on (click to disable for this DM)` : t`Enable end-to-end encryption for this DM`}
			onClick={handleToggle}
		/>
	);
});
