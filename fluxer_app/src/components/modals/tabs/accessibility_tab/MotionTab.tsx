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

export const MotionTabContent: React.FC = observer(() => {
	const {t} = useLingui();
	const syncReducedMotionWithSystem = AccessibilityStore.syncReducedMotionWithSystem;
	const reducedMotionOverride = AccessibilityStore.reducedMotionOverride;

	return (
		<>
			<Switch
				label={t`Sync reduced motion setting with system`}
				description={t`Automatically use your system's reduced motion preference, or customize it below.`}
				value={syncReducedMotionWithSystem}
				onChange={(value) => AccessibilityActionCreators.update({syncReducedMotionWithSystem: value})}
			/>

			<Switch
				label={t`Reduce Motion`}
				description={
					syncReducedMotionWithSystem
						? t`Disable animations and transitions. Currently controlled by your system setting.`
						: t`Disable animations and transitions throughout the app.`
				}
				value={syncReducedMotionWithSystem ? AccessibilityStore.useReducedMotion : (reducedMotionOverride ?? false)}
				disabled={syncReducedMotionWithSystem}
				onChange={(value) => AccessibilityActionCreators.update({reducedMotionOverride: value})}
			/>
		</>
	);
});
