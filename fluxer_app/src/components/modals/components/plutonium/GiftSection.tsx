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

import {PricingCard} from '@app/components/modals/components/PricingCard';
import gridStyles from '@app/components/modals/components/PricingGrid.module.css';
import {PurchaseDisclaimer} from '@app/components/modals/components/PurchaseDisclaimer';
import styles from '@app/components/modals/components/plutonium/GiftSection.module.css';
import {PurchaseDisabledWrapper} from '@app/components/modals/components/plutonium/PurchaseDisabledWrapper';
import {SectionHeader} from '@app/components/modals/components/plutonium/SectionHeader';
import {Trans, useLingui} from '@lingui/react/macro';
import {ArrowDownIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';

interface GiftSectionProps {
	giftSectionRef: React.RefObject<HTMLDivElement | null>;
	monthlyPrice: string;
	yearlyPrice: string;
	loadingCheckout: boolean;
	handleSelectPlan: (plan: 'gift_1_month' | 'gift_1_year') => void;
	purchaseDisabled?: boolean;
	purchaseDisabledTooltip?: React.ReactNode;
}

export const GiftSection: React.FC<GiftSectionProps> = observer(
	({
		giftSectionRef,
		monthlyPrice,
		yearlyPrice,
		loadingCheckout,
		handleSelectPlan,
		purchaseDisabled = false,
		purchaseDisabledTooltip,
	}) => {
		const {t} = useLingui();
		const tooltipText: React.ReactNode = purchaseDisabledTooltip ?? t`Claim your account to purchase Fluxer Plutonium.`;

		return (
			<div ref={giftSectionRef}>
				<section className={styles.section}>
					<SectionHeader
						title={<Trans>Gift Plutonium</Trans>}
						description={
							<Trans>Share the Plutonium experience with your friends by purchasing a gift subscription.</Trans>
						}
					/>
					<div className={gridStyles.gridWrapper}>
						<div className={gridStyles.gridTwoColumns}>
							<PurchaseDisabledWrapper disabled={purchaseDisabled} tooltipText={tooltipText}>
								<PricingCard
									title={t`1 Year Gift`}
									price={yearlyPrice}
									period={t`one-time purchase`}
									badge={t`Save 17%`}
									onSelect={() => handleSelectPlan('gift_1_year')}
									buttonText={t`Buy Gift`}
									isLoading={loadingCheckout}
									disabled={purchaseDisabled}
								/>
							</PurchaseDisabledWrapper>
							<PurchaseDisabledWrapper disabled={purchaseDisabled} tooltipText={tooltipText}>
								<PricingCard
									title={t`1 Month Gift`}
									price={monthlyPrice}
									period={t`one-time purchase`}
									isPopular
									onSelect={() => handleSelectPlan('gift_1_month')}
									buttonText={t`Buy Gift`}
									isLoading={loadingCheckout}
									disabled={purchaseDisabled}
								/>
							</PurchaseDisabledWrapper>
						</div>
					</div>
					<div className={styles.footerContainer}>
						<PurchaseDisclaimer />
						<div className={styles.scrollPromptContainer}>
							<p className={styles.scrollPromptText}>
								<Trans>Scroll down to view all the sweet perks you get with Plutonium</Trans>
							</p>
							<ArrowDownIcon className={styles.scrollPromptIcon} weight="bold" />
						</div>
					</div>
				</section>
			</div>
		);
	},
);
