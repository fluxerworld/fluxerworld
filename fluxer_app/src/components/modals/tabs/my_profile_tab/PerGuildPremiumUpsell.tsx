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

import {PlutoniumUpsell} from '@app/components/uikit/plutonium_upsell/PlutoniumUpsell';
import {shouldShowPremiumFeatures} from '@app/utils/PremiumUtils';
import {Trans} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';

export const PerGuildPremiumUpsell = observer(() => {
	const showPremium = shouldShowPremiumFeatures();
	return (
		<PlutoniumUpsell>
			{showPremium ? (
				<Trans>
					Customizing your avatar, banner, accent color, and bio for individual communities requires Plutonium.
					Community nickname and pronouns are free for everyone.
				</Trans>
			) : (
				<Trans>
					Customizing your avatar, banner, accent color, and bio for individual communities is not enabled on this
					instance. Community nickname and pronouns are available for everyone.
				</Trans>
			)}
		</PlutoniumUpsell>
	);
});
