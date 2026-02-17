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

import {PurchaseDisclaimer} from '@app/components/modals/components/PurchaseDisclaimer';
import styles from '@app/components/modals/components/plutonium/BottomCTASection.module.css';
import {PurchaseDisabledWrapper} from '@app/components/modals/components/plutonium/PurchaseDisabledWrapper';
import {Button} from '@app/components/uikit/button/Button';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';

interface BottomCTASectionProps {
	isGiftMode: boolean;
	monthlyPrice: string;
	yearlyPrice: string;
	loadingCheckout: boolean;
	handleSelectPlan: (plan: 'monthly' | 'yearly' | 'gift_1_month' | 'gift_1_year') => void;
	purchaseDisabled?: boolean;
	purchaseDisabledTooltip?: React.ReactNode;
}

export const BottomCTASection: React.FC<BottomCTASectionProps> = observer(
	({
		isGiftMode,
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
			<div className={styles.container}>
				<h2 className={styles.title}>
					{isGiftMode ? <Trans>Ready to Buy a Gift?</Trans> : <Trans>Ready to Upgrade?</Trans>}
				</h2>
				<div className={styles.buttonContainer}>
					{!isGiftMode ? (
						<>
							<PurchaseDisabledWrapper disabled={purchaseDisabled} tooltipText={tooltipText}>
								<Button
									variant="secondary"
									onClick={() => handleSelectPlan('monthly')}
									submitting={loadingCheckout}
									className={styles.button}
									disabled={purchaseDisabled}
								>
									<Trans>Monthly {monthlyPrice}</Trans>
								</Button>
							</PurchaseDisabledWrapper>
							<PurchaseDisabledWrapper disabled={purchaseDisabled} tooltipText={tooltipText}>
								<Button
									variant="primary"
									onClick={() => handleSelectPlan('yearly')}
									submitting={loadingCheckout}
									className={styles.button}
									disabled={purchaseDisabled}
								>
									<Trans>Yearly {yearlyPrice}</Trans>
								</Button>
							</PurchaseDisabledWrapper>
						</>
					) : (
						<>
							<PurchaseDisabledWrapper disabled={purchaseDisabled} tooltipText={tooltipText}>
								<Button
									variant="secondary"
									onClick={() => handleSelectPlan('gift_1_year')}
									submitting={loadingCheckout}
									className={styles.button}
									disabled={purchaseDisabled}
								>
									<Trans>1 Year {yearlyPrice}</Trans>
								</Button>
							</PurchaseDisabledWrapper>
							<PurchaseDisabledWrapper disabled={purchaseDisabled} tooltipText={tooltipText}>
								<Button
									variant="primary"
									onClick={() => handleSelectPlan('gift_1_month')}
									submitting={loadingCheckout}
									className={styles.button}
									disabled={purchaseDisabled}
								>
									<Trans>1 Month {monthlyPrice}</Trans>
								</Button>
							</PurchaseDisabledWrapper>
						</>
					)}
				</div>
				<PurchaseDisclaimer />
			</div>
		);
	},
);
