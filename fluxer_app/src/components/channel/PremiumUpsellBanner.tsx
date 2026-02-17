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

import * as PremiumModalActionCreators from '@app/actions/PremiumModalActionCreators';
import styles from '@app/components/channel/PremiumUpsellBanner.module.css';
import {GuildIcon} from '@app/components/popouts/GuildIcon';
import {PlutoniumUpsell} from '@app/components/uikit/plutonium_upsell/PlutoniumUpsell';
import DismissedUpsellStore from '@app/stores/DismissedUpsellStore';
import GuildStore from '@app/stores/GuildStore';
import {Trans} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';

interface PremiumUpsellBannerProps {
	children?: React.ReactNode;
	message?: React.ReactNode;
	communityIds?: Array<string>;
	communityCount?: number;
	previewContent?: React.ReactNode;
}

const COMMUNITY_ICON_LIMIT = 4;

const mapGuildIdToIcon = (communityId: string) => {
	const guild = GuildStore.getGuild(communityId);
	return (
		<GuildIcon
			key={communityId}
			id={communityId}
			name={guild?.name ?? ''}
			icon={guild?.icon ?? null}
			sizePx={20}
			className={styles.communityIcon}
		/>
	);
};

export const PremiumUpsellBanner = observer(
	({children, message, communityIds, communityCount, previewContent}: PremiumUpsellBannerProps) => {
		if (DismissedUpsellStore.pickerPremiumUpsellDismissed) {
			return null;
		}

		const handleClick = () => {
			PremiumModalActionCreators.open();
		};

		const handleDismiss = () => {
			DismissedUpsellStore.dismissPickerPremiumUpsell();
		};

		const renderedCommunityIds = communityIds?.slice(0, COMMUNITY_ICON_LIMIT) ?? [];
		const extraCommunityCount =
			communityCount && communityCount > renderedCommunityIds.length ? communityCount - renderedCommunityIds.length : 0;

		return (
			<PlutoniumUpsell
				className={styles.banner}
				onButtonClick={handleClick}
				dismissible={true}
				onDismiss={handleDismiss}
			>
				<div className={styles.content}>
					<p className={styles.text}>
						{message ?? children ?? (
							<Trans>Unlock all custom emojis and stickers across all communities with Plutonium</Trans>
						)}
					</p>
					{renderedCommunityIds.length > 0 && (
						<div className={styles.communityRow}>
							{renderedCommunityIds.map(mapGuildIdToIcon)}
							{extraCommunityCount > 0 && <span className={styles.communityMore}>+{extraCommunityCount}</span>}
						</div>
					)}
					{previewContent && <div className={styles.previewRow}>{previewContent}</div>}
				</div>
			</PlutoniumUpsell>
		);
	},
);
