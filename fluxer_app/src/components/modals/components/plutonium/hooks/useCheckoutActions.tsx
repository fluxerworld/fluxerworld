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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import type {PriceIds} from '@app/actions/PremiumActionCreators';
import * as PremiumActionCreators from '@app/actions/PremiumActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {HttpError} from '@app/lib/HttpError';
import {Logger} from '@app/lib/Logger';
import {openExternalUrl} from '@app/utils/NativeUtils';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {useLingui} from '@lingui/react/macro';
import {useCallback, useState} from 'react';

const logger = new Logger('useCheckoutActions');

type Plan = 'monthly' | 'yearly' | 'gift_1_month' | 'gift_1_year';

export const useCheckoutActions = (priceIds: PriceIds | null, isGiftSubscription: boolean, mobileEnabled: boolean) => {
	const {t} = useLingui();
	const [loadingCheckout, setLoadingCheckout] = useState(false);

	const handleCheckoutError = useCallback(
		(error: unknown) => {
			logger.error('Failed to create checkout session', error);

			if (error instanceof HttpError) {
				const body = error.body;
				if (body && typeof body === 'object' && 'code' in body && typeof body.code === 'string') {
					if (body.code === APIErrorCodes.PREMIUM_PURCHASE_BLOCKED) {
						ToastActionCreators.error(
							t`You're already Lifetime. Starting a new subscription isn't allowed. You can still buy gifts for others.`,
						);
						return;
					}
				}
			}

			ToastActionCreators.error(t`Failed to start checkout. Please try again.`);
		},
		[t],
	);

	const handleSelectPlan = useCallback(
		async (plan: Plan) => {
			if (loadingCheckout) return;

			logger.info('Plan selected', {plan, isGiftSubscription});

			if (isGiftSubscription && (plan === 'monthly' || plan === 'yearly')) {
				ToastActionCreators.error(
					t`You're currently on a gift subscription. It won't renew. You can redeem more gift codes to extend it. Recurring subscriptions can be started after your gift time ends.`,
				);
				return;
			}

			if (!priceIds) {
				logger.error('Price IDs not loaded yet');
				ToastActionCreators.error(t`Please wait for pricing information to load.`);
				return;
			}

			const planConfig: Record<Plan, {id: string | null; gift?: boolean}> = {
				monthly: {id: priceIds.monthly ?? null},
				yearly: {id: priceIds.yearly ?? null},
				gift_1_month: {id: priceIds.gift_1_month ?? null, gift: true},
				gift_1_year: {id: priceIds.gift_1_year ?? null, gift: true},
			};

			const selected = planConfig[plan];
			const priceId = selected.id;
			const isGift = selected.gift ?? false;

			if (!priceId) {
				logger.error('Price ID not available for plan', {plan});
				ToastActionCreators.error(t`This plan is not available at the moment. Please contact support.`);
				return;
			}

			setLoadingCheckout(true);
			try {
				const checkoutUrl = await PremiumActionCreators.createCheckoutSession(priceId, isGift);

				if (mobileEnabled) {
					ModalActionCreators.push(
						modal(() => (
							<ConfirmModal
								title={t`Complete Payment`}
								description={t`You are now navigating to Stripe to complete the payment. Return to Fluxer once you've completed it!`}
								primaryText={t`OK`}
								primaryVariant="primary"
								secondaryText={t`Cancel`}
								onPrimary={() => {
									void openExternalUrl(checkoutUrl);
								}}
							/>
						)),
					);
				} else {
					await openExternalUrl(checkoutUrl);
				}
			} catch (error) {
				handleCheckoutError(error);
			} finally {
				setLoadingCheckout(false);
			}
		},
		[handleCheckoutError, loadingCheckout, priceIds, isGiftSubscription, mobileEnabled, t],
	);

	return {
		loadingCheckout,
		handleSelectPlan,
	};
};
