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

import {FeatureComparisonTable} from '@app/components/modals/components/FeatureComparisonTable';
import styles from '@app/components/modals/components/PlutoniumContent.module.css';
import {PurchaseDisclaimer} from '@app/components/modals/components/PurchaseDisclaimer';
import {BottomCTASection} from '@app/components/modals/components/plutonium/BottomCTASection';
import {GiftInventoryBanner} from '@app/components/modals/components/plutonium/GiftInventoryBanner';
import {GiftSection} from '@app/components/modals/components/plutonium/GiftSection';
import {useCheckoutActions} from '@app/components/modals/components/plutonium/hooks/useCheckoutActions';
import {useCommunityActions} from '@app/components/modals/components/plutonium/hooks/useCommunityActions';
import {usePremiumData} from '@app/components/modals/components/plutonium/hooks/usePremiumData';
import {useSubscriptionActions} from '@app/components/modals/components/plutonium/hooks/useSubscriptionActions';
import {useSubscriptionStatus} from '@app/components/modals/components/plutonium/hooks/useSubscriptionStatus';
import {PlutoniumUpsellBanner} from '@app/components/modals/components/plutonium/PlutoniumUpsellBanner';
import {PricingSection} from '@app/components/modals/components/plutonium/PricingSection';
import {PurchaseHistorySection} from '@app/components/modals/components/plutonium/PurchaseHistorySection';
import {SectionHeader} from '@app/components/modals/components/plutonium/SectionHeader';
import {SubscriptionCard} from '@app/components/modals/components/plutonium/SubscriptionCard';
import {ComponentDispatch} from '@app/lib/ComponentDispatch';
import GeoIPStore from '@app/stores/GeoIPStore';
import GuildStore from '@app/stores/GuildStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import UserStore from '@app/stores/UserStore';
import * as LocaleUtils from '@app/utils/LocaleUtils';
import {getFormattedPrice, PricingTier} from '@app/utils/PricingUtils';
import {GuildFeatures} from '@fluxer/constants/src/GuildConstants';
import {Trans} from '@lingui/react/macro';
import {CrownIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useMemo, useRef, useState} from 'react';

interface PlutoniumContentProps {
	defaultGiftMode?: boolean;
}

export const PlutoniumContent = observer(({defaultGiftMode = false}: PlutoniumContentProps) => {
	const currentUser = UserStore.currentUser;
	const locale = LocaleUtils.getCurrentLocale();
	const mobileLayoutState = MobileLayoutStore;

	const [isGiftMode, setIsGiftMode] = useState(defaultGiftMode);
	const giftSectionRef = useRef<HTMLDivElement | null>(null);
	const perksSectionRef = useRef<HTMLDivElement | null>(null);

	const countryCode = GeoIPStore.countryCode;
	const guilds = GuildStore.getGuilds();

	const visionaryGuild = useMemo(() => {
		return guilds.find((guild) => guild.features.has(GuildFeatures.VISIONARY));
	}, [guilds]);

	const operatorGuild = useMemo(() => {
		return guilds.find((guild) => guild.features.has(GuildFeatures.OPERATOR));
	}, [guilds]);

	const subscriptionStatus = useSubscriptionStatus(currentUser);
	const {priceIds} = usePremiumData(countryCode);
	const {
		loadingPortal,
		loadingCancel,
		loadingReactivate,
		handleOpenCustomerPortal,
		handleCancelSubscription,
		handleReactivateSubscription,
	} = useSubscriptionActions();
	const {
		loadingRejoinCommunity,
		isCommunityMenuOpen,
		communityButtonRef,
		handleCommunityButtonPointerDown,
		handleCommunityButtonClick,
	} = useCommunityActions(visionaryGuild, operatorGuild);
	const {loadingCheckout, handleSelectPlan} = useCheckoutActions(
		priceIds,
		subscriptionStatus.isGiftSubscription,
		mobileLayoutState.enabled,
	);

	const isClaimed = currentUser?.isClaimed() ?? false;
	const purchaseDisabled = !isClaimed;
	const purchaseDisabledTooltip = <Trans>Claim your account to purchase Fluxer Plutonium.</Trans>;
	const handleSelectPlanGuarded = useCallback(
		(plan: 'monthly' | 'yearly' | 'gift_1_month' | 'gift_1_year') => {
			if (purchaseDisabled) return;
			handleSelectPlan(plan);
		},
		[handleSelectPlan, purchaseDisabled],
	);

	const monthlyPrice = useMemo(() => getFormattedPrice(PricingTier.Monthly, countryCode), [countryCode]);
	const yearlyPrice = useMemo(() => getFormattedPrice(PricingTier.Yearly, countryCode), [countryCode]);

	const scrollToPerks = useCallback(() => {
		perksSectionRef.current?.scrollIntoView({behavior: 'auto', block: 'start'});
	}, []);

	const handlePerksKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLSpanElement>) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				scrollToPerks();
			}
		},
		[scrollToPerks],
	);

	const navigateToRedeemGift = useCallback(() => {
		ComponentDispatch.dispatch('USER_SETTINGS_TAB_SELECT', {tab: 'gift_inventory'});
	}, []);

	if (!currentUser) return null;

	if (defaultGiftMode) {
		return (
			<div className={styles.giftModeContainer}>
				<PlutoniumUpsellBanner />

				<GiftSection
					giftSectionRef={giftSectionRef}
					monthlyPrice={monthlyPrice}
					yearlyPrice={yearlyPrice}
					loadingCheckout={loadingCheckout}
					handleSelectPlan={handleSelectPlan}
				/>

				<div ref={perksSectionRef}>
					<section className={styles.perksSection}>
						<SectionHeader title={<Trans>Free vs Plutonium</Trans>} />
						<div className={styles.comparisonTableContainer}>
							<FeatureComparisonTable />
						</div>
					</section>
				</div>
			</div>
		);
	}

	return (
		<div className={styles.mainContainer}>
			<GiftInventoryBanner currentUser={currentUser} />

			<div className={styles.header}>
				<div className={styles.iconContainer}>
					<CrownIcon className={styles.icon} weight="fill" />
				</div>
				<h1 className={styles.title}>
					<Trans>Fluxer Plutonium</Trans>
				</h1>
				<p className={styles.description}>
					<Trans>
						Unlock higher limits and exclusive features while supporting an independent communication platform.
					</Trans>
				</p>
			</div>

			{subscriptionStatus.hasEverPurchased && (
				<PurchaseHistorySection loadingPortal={loadingPortal} handleOpenCustomerPortal={handleOpenCustomerPortal} />
			)}

			{subscriptionStatus.shouldShowPremiumCard && (
				<section className={styles.subscriptionSection}>
					<SubscriptionCard
						currentUser={currentUser}
						locale={locale}
						isVisionary={subscriptionStatus.isVisionary}
						isGiftSubscription={subscriptionStatus.isGiftSubscription}
						billingCycle={subscriptionStatus.billingCycle}
						monthlyPrice={monthlyPrice}
						yearlyPrice={yearlyPrice}
						gracePeriodInfo={subscriptionStatus.gracePeriodInfo}
						premiumWillCancel={subscriptionStatus.premiumWillCancel}
						subscriptionCardColorClass={subscriptionStatus.subscriptionCardColorClass}
						subscriptionStatusColor={subscriptionStatus.subscriptionStatusColor}
						hasEverPurchased={subscriptionStatus.hasEverPurchased}
						shouldUseCancelQuickAction={subscriptionStatus.shouldUseCancelQuickAction}
						shouldUseReactivateQuickAction={subscriptionStatus.shouldUseReactivateQuickAction}
						loadingPortal={loadingPortal}
						loadingCancel={loadingCancel}
						loadingReactivate={loadingReactivate}
						loadingRejoinCommunity={loadingRejoinCommunity}
						isCommunityMenuOpen={isCommunityMenuOpen}
						communityButtonRef={communityButtonRef}
						scrollToPerks={scrollToPerks}
						handlePerksKeyDown={handlePerksKeyDown}
						navigateToRedeemGift={navigateToRedeemGift}
						handleOpenCustomerPortal={handleOpenCustomerPortal}
						handleReactivateSubscription={handleReactivateSubscription}
						handleCancelSubscription={handleCancelSubscription}
						handleCommunityButtonPointerDown={handleCommunityButtonPointerDown}
						handleCommunityButtonClick={handleCommunityButtonClick}
						purchaseDisabled={purchaseDisabled}
						purchaseDisabledTooltip={purchaseDisabledTooltip}
					/>
					<div className={styles.disclaimerContainer}>
						<PurchaseDisclaimer align="center" isPremium />
					</div>
				</section>
			)}

			{!subscriptionStatus.shouldShowPremiumCard ? (
				<PricingSection
					isGiftMode={isGiftMode}
					setIsGiftMode={setIsGiftMode}
					monthlyPrice={monthlyPrice}
					yearlyPrice={yearlyPrice}
					loadingCheckout={loadingCheckout}
					handleSelectPlan={handleSelectPlanGuarded}
					purchaseDisabled={purchaseDisabled}
					purchaseDisabledTooltip={purchaseDisabledTooltip}
				/>
			) : (
				<GiftSection
					giftSectionRef={giftSectionRef}
					monthlyPrice={monthlyPrice}
					yearlyPrice={yearlyPrice}
					loadingCheckout={loadingCheckout}
					handleSelectPlan={handleSelectPlanGuarded}
					purchaseDisabled={purchaseDisabled}
					purchaseDisabledTooltip={purchaseDisabledTooltip}
				/>
			)}

			<div ref={perksSectionRef}>
				<section className={styles.perksSection}>
					<SectionHeader title={<Trans>Free vs Plutonium</Trans>} />
					<div className={styles.comparisonTableContainer}>
						<FeatureComparisonTable />
					</div>
				</section>
			</div>

			{!subscriptionStatus.isPremium && (
				<BottomCTASection
					isGiftMode={isGiftMode}
					monthlyPrice={monthlyPrice}
					yearlyPrice={yearlyPrice}
					loadingCheckout={loadingCheckout}
					handleSelectPlan={handleSelectPlanGuarded}
					purchaseDisabled={purchaseDisabled}
					purchaseDisabledTooltip={purchaseDisabledTooltip}
				/>
			)}
		</div>
	);
});
