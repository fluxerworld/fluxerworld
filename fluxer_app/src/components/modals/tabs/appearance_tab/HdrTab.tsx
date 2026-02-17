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
import type {RadioOption} from '@app/components/uikit/radio_group/RadioGroup';
import {RadioGroup} from '@app/components/uikit/radio_group/RadioGroup';
import AccessibilityStore, {HdrDisplayMode} from '@app/stores/AccessibilityStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';

export function shouldShowHdrSettings(): boolean {
	return !MobileLayoutStore.isMobileLayout();
}

export const HdrTabContent: React.FC = observer(() => {
	const {t} = useLingui();
	const hdrDisplayMode = AccessibilityStore.hdrDisplayMode;

	const hdrOptions: ReadonlyArray<RadioOption<HdrDisplayMode>> = [
		{
			value: HdrDisplayMode.FULL,
			name: t`Full Dynamic Range`,
			desc: t`Display HDR images at full brightness and color range.`,
		},
		{
			value: HdrDisplayMode.STANDARD,
			name: t`Standard Range`,
			desc: t`Tone-map HDR images to standard range, reducing peak brightness.`,
		},
	];

	return (
		<RadioGroup
			options={hdrOptions}
			value={hdrDisplayMode}
			onChange={(value) => {
				AccessibilityActionCreators.update({hdrDisplayMode: value});
			}}
			aria-label={t`High dynamic range display mode`}
		/>
	);
});
