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

import {modal, push} from '@app/actions/ModalActionCreators';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {PremiumModal} from '@app/components/modals/PremiumModal';
import UserStore from '@app/stores/UserStore';
import {Limits} from '@app/utils/limits/UserLimits';
import {shouldShowPremiumFeatures} from '@app/utils/PremiumUtils';
import {MAX_FAVORITE_MEMES_PREMIUM} from '@fluxer/constants/src/LimitConstants';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';

export const MaxFavoriteMemesModal = observer(() => {
	const {t} = useLingui();
	const currentUser = UserStore.currentUser;
	const showPremium = shouldShowPremiumFeatures();
	const premiumLimit = Limits.getPremiumValue('max_favorite_memes', MAX_FAVORITE_MEMES_PREMIUM);
	const maxFavoriteMemes = currentUser?.maxFavoriteMemes ?? premiumLimit;
	const canUpgradeFavoriteMemes = maxFavoriteMemes < premiumLimit;

	const freeItemsText =
		maxFavoriteMemes === 1 ? t`${maxFavoriteMemes} saved media item` : t`${maxFavoriteMemes} saved media items`;

	if (!showPremium) {
		return (
			<ConfirmModal
				title={t`Saved media limit reached`}
				description={t`You've reached the maximum limit of ${freeItemsText}. This limit is configured by your instance administrator.`}
				primaryText={t`Understood`}
				onPrimary={() => {}}
			/>
		);
	}

	if (!canUpgradeFavoriteMemes) {
		const description =
			maxFavoriteMemes === 1
				? t`You've reached the maximum limit of ${maxFavoriteMemes} saved media item. To add more, you'll need to remove some existing items from your collection.`
				: t`You've reached the maximum limit of ${maxFavoriteMemes} saved media items. To add more, you'll need to remove some existing items from your collection.`;

		return <ConfirmModal title={t`Saved media limit reached`} description={description} secondaryText={t`Close`} />;
	}

	const premiumItemsText =
		premiumLimit === 1 ? t`${premiumLimit} saved media item` : t`${premiumLimit} saved media items`;

	const freeDescription = t`You've reached the maximum limit of ${freeItemsText} for free users. Upgrade to Plutonium to increase your limit to ${premiumItemsText}!`;

	return (
		<ConfirmModal
			title={t`Saved media limit reached`}
			description={freeDescription}
			primaryText={t`Upgrade to Plutonium`}
			primaryVariant="primary"
			onPrimary={() => {
				window.setTimeout(() => {
					push(modal(() => <PremiumModal />));
				}, 0);
			}}
			secondaryText={t`Maybe Later`}
		/>
	);
});
