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

import type {UserID} from '@fluxer/api/src/BrandedTypes';
import {Config} from '@fluxer/api/src/Config';
import {Logger} from '@fluxer/api/src/Logger';
import type {User} from '@fluxer/api/src/models/User';
import type {ProductRegistry} from '@fluxer/api/src/stripe/ProductRegistry';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {type Currency, getCurrency} from '@fluxer/api/src/utils/CurrencyUtils';
import {UserFlags, UserPremiumTypes} from '@fluxer/constants/src/UserConstants';
import {PremiumPurchaseBlockedError} from '@fluxer/errors/src/domains/payment/PremiumPurchaseBlockedError';
import {StripeError} from '@fluxer/errors/src/domains/payment/StripeError';
import {StripeInvalidProductConfigurationError} from '@fluxer/errors/src/domains/payment/StripeInvalidProductConfigurationError';
import {StripeInvalidProductError} from '@fluxer/errors/src/domains/payment/StripeInvalidProductError';
import {StripeNoPurchaseHistoryError} from '@fluxer/errors/src/domains/payment/StripeNoPurchaseHistoryError';
import {StripePaymentNotAvailableError} from '@fluxer/errors/src/domains/payment/StripePaymentNotAvailableError';
import {UnclaimedAccountCannotMakePurchasesError} from '@fluxer/errors/src/domains/user/UnclaimedAccountCannotMakePurchasesError';
import {UnknownUserError} from '@fluxer/errors/src/domains/user/UnknownUserError';
import type Stripe from 'stripe';

const FIRST_REFUND_BLOCK_DAYS = 30;

export interface CreateCheckoutSessionParams {
	userId: UserID;
	priceId: string;
	isGift?: boolean;
}

export class StripeCheckoutService {
	constructor(
		private stripe: Stripe | null,
		private userRepository: IUserRepository,
		private productRegistry: ProductRegistry,
	) {}

	async createCheckoutSession({userId, priceId, isGift = false}: CreateCheckoutSessionParams): Promise<string> {
		if (!this.stripe) {
			throw new StripePaymentNotAvailableError();
		}

		const productInfo = this.productRegistry.getProduct(priceId);
		if (!productInfo) {
			Logger.error({priceId, userId}, 'Invalid or unknown price ID');
			throw new StripeInvalidProductError();
		}

		if (productInfo.isGift !== isGift) {
			Logger.error(
				{priceId, userId, expectedIsGift: productInfo.isGift, providedIsGift: isGift},
				'Gift parameter mismatch',
			);
			throw new StripeInvalidProductConfigurationError();
		}

		const user = await this.userRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}

		if (
			user.premiumType === UserPremiumTypes.LIFETIME &&
			this.productRegistry.isRecurringSubscription(productInfo) &&
			!productInfo.isGift
		) {
			throw new PremiumPurchaseBlockedError();
		}

		this.validateUserCanPurchase(user);

		const customerId = await this.ensureStripeCustomer(user);

		const checkoutMode: Stripe.Checkout.SessionCreateParams.Mode = this.productRegistry.isRecurringSubscription(
			productInfo,
		)
			? 'subscription'
			: 'payment';

		const checkoutParams: Stripe.Checkout.SessionCreateParams = {
			customer: customerId,
			line_items: [
				{
					price: priceId,
					quantity: 1,
				},
			],
			mode: checkoutMode,
			success_url: `${Config.endpoints.webApp}/premium-callback?status=success`,
			cancel_url: `${Config.endpoints.webApp}/premium-callback?status=cancel`,
			...(checkoutMode === 'payment'
				? {
						invoice_creation: {
							enabled: true,
						},
					}
				: {}),
			automatic_tax: {
				enabled: true,
			},
			customer_update: {
				address: 'auto',
			},
			allow_promotion_codes: true,
		};

		try {
			const session = await this.stripe.checkout.sessions.create(checkoutParams);
			if (!session.url) {
				Logger.error({userId, sessionId: session.id}, 'Stripe checkout session missing url');
				throw new StripeError('Stripe checkout session missing url');
			}

			await this.userRepository.createPayment({
				checkout_session_id: session.id,
				user_id: userId,
				price_id: priceId,
				product_type: productInfo.type,
				status: 'pending',
				is_gift: isGift,
				created_at: new Date(),
			});

			Logger.debug({userId, sessionId: session.id, productType: productInfo.type}, 'Checkout session created');

			return session.url;
		} catch (error: unknown) {
			Logger.error({error, userId}, 'Failed to create Stripe checkout session');
			const message = error instanceof Error ? error.message : 'Failed to create checkout session';
			throw new StripeError(message);
		}
	}

	async createCustomerPortalSession(userId: UserID): Promise<string> {
		if (!this.stripe) {
			throw new StripePaymentNotAvailableError();
		}

		const user = await this.userRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}

		if (!user.stripeCustomerId) {
			throw new StripeNoPurchaseHistoryError();
		}

		try {
			const session = await this.stripe.billingPortal.sessions.create({
				customer: user.stripeCustomerId,
				return_url: `${Config.endpoints.webApp}/premium-callback?status=closed-billing-portal`,
			});

			if (!session.url) {
				Logger.error({userId, customerId: user.stripeCustomerId}, 'Stripe customer portal session missing url');
				throw new StripeError('Stripe customer portal session missing url');
			}

			return session.url;
		} catch (error: unknown) {
			Logger.error({error, userId, customerId: user.stripeCustomerId}, 'Failed to create customer portal session');
			const message = error instanceof Error ? error.message : 'Failed to create customer portal session';
			throw new StripeError(message);
		}
	}

	getPriceIds(countryCode?: string): {
		monthly: string | null;
		yearly: string | null;
		gift_1_month: string | null;
		gift_1_year: string | null;
		currency: Currency;
	} {
		const currency = getCurrency(countryCode);
		const prices = Config.stripe.prices;

		if (currency === 'EUR') {
			if (!prices?.monthlyEur || !prices.yearlyEur || !prices.gift1MonthEur || !prices.gift1YearEur) {
				throw new StripeError('Stripe price ids missing for EUR');
			}
			return {
				monthly: prices.monthlyEur,
				yearly: prices.yearlyEur,
				gift_1_month: prices.gift1MonthEur,
				gift_1_year: prices.gift1YearEur,
				currency,
			};
		}

		if (!prices?.monthlyUsd || !prices.yearlyUsd || !prices.gift1MonthUsd || !prices.gift1YearUsd) {
			throw new StripeError('Stripe price ids missing for USD');
		}
		return {
			monthly: prices.monthlyUsd,
			yearly: prices.yearlyUsd,
			gift_1_month: prices.gift1MonthUsd,
			gift_1_year: prices.gift1YearUsd,
			currency,
		};
	}

	validateUserCanPurchase(user: User): void {
		if (user.isUnclaimedAccount()) {
			throw new UnclaimedAccountCannotMakePurchasesError();
		}

		if (user.flags & UserFlags.PREMIUM_PURCHASE_DISABLED) {
			throw new PremiumPurchaseBlockedError();
		}

		if (user.firstRefundAt) {
			const daysSinceFirstRefund = Math.floor((Date.now() - user.firstRefundAt.getTime()) / (1000 * 60 * 60 * 24));
			if (daysSinceFirstRefund < FIRST_REFUND_BLOCK_DAYS) {
				throw new PremiumPurchaseBlockedError();
			}
		}
	}

	private async ensureStripeCustomer(user: User): Promise<string> {
		if (user.stripeCustomerId) {
			return user.stripeCustomerId;
		}

		if (!this.stripe) {
			throw new StripePaymentNotAvailableError();
		}

		const customer = await this.stripe.customers.create({
			email: user.email ?? undefined,
			metadata: {
				userId: user.id.toString(),
			},
		});

		await this.userRepository.patchUpsert(
			user.id,
			{
				stripe_customer_id: customer.id,
			},
			user.toRow(),
		);

		Logger.debug({userId: user.id, customerId: customer.id}, 'Stripe customer created');

		return customer.id;
	}
}
