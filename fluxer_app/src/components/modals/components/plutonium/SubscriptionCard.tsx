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

import {PerksButton} from '@app/components/modals/components/PerksButton';
import type {GracePeriodInfo} from '@app/components/modals/components/plutonium/hooks/useSubscriptionStatus';
import styles from '@app/components/modals/components/plutonium/SubscriptionCard.module.css';
import {Button} from '@app/components/uikit/button/Button';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import type {UserRecord} from '@app/records/UserRecord';
import {getFormattedLongDate} from '@fluxer/date_utils/src/DateFormatting';
import {Trans, useLingui} from '@lingui/react/macro';
import {DotsThreeIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';

interface SubscriptionCardProps {
	currentUser: UserRecord;
	locale: string;
	isVisionary: boolean;
	isGiftSubscription: boolean;
	billingCycle: string | null;
	monthlyPrice: string;
	yearlyPrice: string;
	gracePeriodInfo: GracePeriodInfo;
	premiumWillCancel: boolean;
	subscriptionCardColorClass: string;
	subscriptionStatusColor: string;
	hasEverPurchased: boolean;
	shouldUseCancelQuickAction: boolean;
	shouldUseReactivateQuickAction: boolean;
	loadingPortal: boolean;
	loadingCancel: boolean;
	loadingReactivate: boolean;
	loadingRejoinCommunity: boolean;
	isCommunityMenuOpen: boolean;
	communityButtonRef: React.RefObject<HTMLButtonElement | null>;
	scrollToPerks: () => void;
	handlePerksKeyDown: (event: React.KeyboardEvent<HTMLSpanElement>) => void;
	navigateToRedeemGift: () => void;
	handleOpenCustomerPortal: () => void;
	handleReactivateSubscription: () => void;
	handleCancelSubscription: () => void;
	handleCommunityButtonPointerDown: (event: React.PointerEvent) => void;
	handleCommunityButtonClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
	purchaseDisabled?: boolean;
	purchaseDisabledTooltip?: React.ReactNode;
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = observer(
	({
		currentUser,
		locale,
		isVisionary,
		isGiftSubscription,
		billingCycle,
		monthlyPrice,
		yearlyPrice,
		gracePeriodInfo,
		premiumWillCancel,
		subscriptionCardColorClass,
		subscriptionStatusColor,
		hasEverPurchased,
		shouldUseCancelQuickAction,
		shouldUseReactivateQuickAction,
		loadingPortal,
		loadingCancel,
		loadingReactivate,
		loadingRejoinCommunity,
		isCommunityMenuOpen,
		communityButtonRef,
		scrollToPerks,
		handlePerksKeyDown,
		navigateToRedeemGift,
		handleOpenCustomerPortal,
		handleReactivateSubscription,
		handleCancelSubscription,
		handleCommunityButtonPointerDown,
		handleCommunityButtonClick,
		purchaseDisabled = false,
		purchaseDisabledTooltip,
	}) => {
		const {t} = useLingui();
		const {isInGracePeriod, isExpired: isFullyExpired, graceEndDate} = gracePeriodInfo;
		const tooltipText: string | (() => React.ReactNode) =
			purchaseDisabledTooltip != null
				? () => purchaseDisabledTooltip
				: t`Claim your account to purchase or redeem Fluxer Plutonium.`;

		const wrapIfDisabled = (element: React.ReactElement, key: string, disabled: boolean) =>
			disabled ? (
				<Tooltip key={key} text={tooltipText}>
					<div>{element}</div>
				</Tooltip>
			) : (
				element
			);

		return (
			<div className={clsx(styles.card, subscriptionCardColorClass)}>
				<div className={styles.grid}>
					<div className={styles.content}>
						<div className={styles.header}>
							<h3 className={styles.title}>
								{isVisionary ? <Trans>Visionary</Trans> : <Trans>Plutonium Subscription</Trans>}
							</h3>
							<div className={styles.badge} style={{color: subscriptionStatusColor}}>
								{isFullyExpired ? (
									<Trans>Expired</Trans>
								) : isInGracePeriod ? (
									<Trans>Grace Period</Trans>
								) : premiumWillCancel ? (
									<Trans>Canceling</Trans>
								) : isVisionary ? (
									<Trans>Lifetime</Trans>
								) : isGiftSubscription ? (
									<Trans>Gift</Trans>
								) : (
									<Trans>Active</Trans>
								)}
							</div>
						</div>

						<div className={styles.description}>
							{isFullyExpired ? (
								(() => {
									const expiredDate = graceEndDate ? getFormattedLongDate(graceEndDate, locale) : undefined;
									return (
										<Trans>
											Your subscription expired on <strong>{expiredDate}</strong>. You lost all{' '}
											<PerksButton onClick={scrollToPerks} onKeyDown={handlePerksKeyDown} />. You can reactivate at any
											time.
										</Trans>
									);
								})()
							) : isInGracePeriod ? (
								(() => {
									const graceDate = graceEndDate ? getFormattedLongDate(graceEndDate, locale) : undefined;
									return (
										<Trans>
											Your subscription ended, but you still have all{' '}
											<PerksButton onClick={scrollToPerks} onKeyDown={handlePerksKeyDown} /> until{' '}
											<strong>{graceDate}</strong>. Resubscribe to keep them.
										</Trans>
									);
								})()
							) : isGiftSubscription ? (
								(() => {
									const giftEndDate = currentUser.premiumUntil
										? getFormattedLongDate(new Date(currentUser.premiumUntil), locale)
										: undefined;
									return (
										<>
											<Trans>
												You have all <PerksButton onClick={scrollToPerks} onKeyDown={handlePerksKeyDown} /> via a{' '}
												<strong>gift subscription</strong> until <strong>{giftEndDate}</strong>. It{' '}
												<strong>won't renew</strong>.
											</Trans>
											<br />
											<Trans>
												You can redeem additional gift codes to <strong>extend</strong> your gift time.
											</Trans>
										</>
									);
								})()
							) : premiumWillCancel ? (
								(() => {
									const cancelDate = currentUser.premiumUntil
										? getFormattedLongDate(new Date(currentUser.premiumUntil), locale)
										: undefined;
									return (
										<Trans>
											Your subscription will cancel on <strong>{cancelDate}</strong>. You'll lose all{' '}
											<PerksButton onClick={scrollToPerks} onKeyDown={handlePerksKeyDown} /> after that date.
										</Trans>
									);
								})()
							) : isVisionary ? (
								<Trans>
									You have all <PerksButton onClick={scrollToPerks} onKeyDown={handlePerksKeyDown} /> forever. No
									subscriptions, no renewals.
								</Trans>
							) : billingCycle === 'monthly' ? (
								<Trans>
									You have all <PerksButton onClick={scrollToPerks} onKeyDown={handlePerksKeyDown} /> for{' '}
									<strong>{monthlyPrice}/month</strong>.
								</Trans>
							) : billingCycle === 'yearly' ? (
								<Trans>
									You have all <PerksButton onClick={scrollToPerks} onKeyDown={handlePerksKeyDown} /> for{' '}
									<strong>{yearlyPrice}/year</strong>.
								</Trans>
							) : (
								<Trans>
									You have all <PerksButton onClick={scrollToPerks} onKeyDown={handlePerksKeyDown} /> for your
									subscription period.
								</Trans>
							)}
						</div>

						{!isVisionary &&
							currentUser.premiumUntil &&
							!premiumWillCancel &&
							!isInGracePeriod &&
							!isFullyExpired &&
							!isGiftSubscription &&
							(() => {
								const renewalDate = getFormattedLongDate(new Date(currentUser.premiumUntil), locale);
								return (
									<div className={styles.renewalInfo}>
										<Trans>
											Renews on <strong>{renewalDate}</strong>.
										</Trans>
									</div>
								);
							})()}
					</div>

					<div className={styles.actions}>
						{isGiftSubscription ? (
							wrapIfDisabled(
								<Button
									variant="inverted"
									onClick={navigateToRedeemGift}
									small
									className={styles.actionButton}
									disabled={purchaseDisabled}
								>
									<Trans>Redeem Gift Code</Trans>
								</Button>,
								'redeem-gift',
								purchaseDisabled,
							)
						) : (
							<>
								{hasEverPurchased &&
									wrapIfDisabled(
										<Button
											variant="inverted"
											onClick={shouldUseReactivateQuickAction ? handleReactivateSubscription : handleOpenCustomerPortal}
											submitting={shouldUseReactivateQuickAction ? loadingReactivate : loadingPortal}
											small
											className={styles.actionButton}
											disabled={purchaseDisabled && shouldUseReactivateQuickAction}
										>
											{isFullyExpired ? (
												<Trans>Resubscribe</Trans>
											) : isInGracePeriod ? (
												<Trans>Resubscribe</Trans>
											) : premiumWillCancel ? (
												<Trans>Reactivate</Trans>
											) : isVisionary ? (
												<Trans>Open Customer Portal</Trans>
											) : (
												<Trans>Manage Subscription</Trans>
											)}
										</Button>,
										'manage-reactivate',
										purchaseDisabled && shouldUseReactivateQuickAction,
									)}

								{isVisionary && (
									<Button
										ref={communityButtonRef}
										variant="inverted"
										onPointerDownCapture={handleCommunityButtonPointerDown}
										onClick={handleCommunityButtonClick}
										submitting={loadingRejoinCommunity}
										small
										className={clsx(styles.actionButton, isCommunityMenuOpen && styles.communityButtonActive)}
										leftIcon={<DotsThreeIcon weight="bold" className={styles.iconSmall} />}
									>
										<Trans>Join Community</Trans>
									</Button>
								)}

								{shouldUseCancelQuickAction && (
									<Button
										variant="inverted"
										onClick={handleCancelSubscription}
										submitting={loadingCancel}
										small
										className={styles.actionButton}
									>
										<Trans>Cancel</Trans>
									</Button>
								)}
							</>
						)}
					</div>
				</div>
			</div>
		);
	},
);
