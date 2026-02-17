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

import {Switch} from '@app/components/form/Switch';
import PrivacyPreferencesStore from '@app/stores/PrivacyPreferencesStore';
import {Trans} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback} from 'react';

export const ActiveNowTabContent: React.FC = observer(function ActiveNowTabContent() {
	const showActiveNow = PrivacyPreferencesStore.getShowActiveNow();

	const handleToggle = useCallback((value: boolean) => {
		PrivacyPreferencesStore.setShowActiveNow(value);
	}, []);

	return (
		<Switch
			label={<Trans>Show Active Now on the home screen</Trans>}
			description={
				<Trans>
					Show Active Now on the home screen to surface friends active in voice. You'll see a preview, the channel
					context, who's already there, and a quick way to join in.
				</Trans>
			}
			value={showActiveNow}
			onChange={handleToggle}
		/>
	);
});
