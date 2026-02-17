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

import * as AccessibilityActionCreators from '@app/actions/AccessibilityActionCreators';
import {Switch} from '@app/components/form/Switch';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';

export const ChannelListTabContent: React.FC = observer(() => {
	const {t} = useLingui();

	return (
		<Switch
			label={t`Show unread indicator on muted channels`}
			description={t`When enabled, muted channels show a faded unread indicator on the left side. Mentions still appear regardless of this setting.`}
			value={AccessibilityStore.showFadedUnreadOnMutedChannels}
			onChange={(value) => AccessibilityActionCreators.update({showFadedUnreadOnMutedChannels: value})}
		/>
	);
});
