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
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import {Logger} from '@fluxer/api/src/Logger';
import type {User} from '@fluxer/api/src/models/User';
import {
	getPrimarySubscriptionItem,
	getSubscriptionItemPeriodEndUnix,
} from '@fluxer/api/src/stripe/StripeSubscriptionPeriod';
import {addMonthsClamp} from '@fluxer/api/src/stripe/StripeUtils';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {mapUserToPrivateResponse} from '@fluxer/api/src/user/UserMappers';
import type {ICacheService} from '@fluxer/cache/src/ICacheService';
import {NoActiveSubscriptionError} from '@fluxer/errors/src/domains/payment/NoActiveSubscriptionError';
import {StripeError} from '@fluxer/errors/src/domains/payment/StripeError';
import {StripeNoActiveSubscriptionError} from '@fluxer/errors/src/domains/payment/StripeNoActiveSubscriptionError';
import {StripeNoSubscriptionError} from '@fluxer/errors/src/domains/payment/StripeNoSubscriptionError';
import {StripePaymentNotAvailableError} from '@fluxer/errors/src/domains/payment/StripePaymentNotAvailableError';
import {StripeSubscriptionAlreadyCancelingError} from '@fluxer/errors/src/domains/payment/StripeSubscriptionAlreadyCancelingError';
import {StripeSubscriptionNotCancelingError} from '@fluxer/errors/src/domains/payment/StripeSubscriptionNotCancelingError';
import {UnknownUserError} from '@fluxer/errors/src/domains/user/UnknownUserError';
import {seconds} from 'itty-time';
import type Stripe from 'stripe';

export class StripeSubscriptionService {
	constructor(
		private stripe: Stripe | null,
		private userRepository: IUserRepository,
		private cacheService: ICacheService,
		private gatewayService: IGatewayService,
	) {}

	async cancelSubscriptionAtPeriodEnd(userId: UserID): Promise<void> {
		if (!this.stripe) {
			throw new StripePaymentNotAvailableError();
		}

		const user = await this.userRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}

		if (!user.stripeSubscriptionId) {
			throw new StripeNoActiveSubscriptionError();
		}

		if (user.premiumWillCancel) {
			throw new StripeSubscriptionAlreadyCancelingError();
		}

		try {
			await this.stripe.subscriptions.update(user.stripeSubscriptionId, {
				cancel_at_period_end: true,
			});

			const updatedUser = await this.userRepository.patchUpsert(
				userId,
				{
					premium_will_cancel: true,
				},
				user.toRow(),
			);

			await this.dispatchUser(updatedUser);

			Logger.debug({userId, subscriptionId: user.stripeSubscriptionId}, 'Subscription set to cancel at period end');
		} catch (error: unknown) {
			Logger.error(
				{error, userId, subscriptionId: user.stripeSubscriptionId},
				'Failed to cancel subscription at period end',
			);
			const message = error instanceof Error ? error.message : 'Failed to cancel subscription';
			throw new StripeError(message);
		}
	}

	async reactivateSubscription(userId: UserID): Promise<void> {
		if (!this.stripe) {
			throw new StripePaymentNotAvailableError();
		}

		const user = await this.userRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}

		if (!user.stripeSubscriptionId) {
			throw new StripeNoSubscriptionError();
		}

		if (!user.premiumWillCancel) {
			throw new StripeSubscriptionNotCancelingError();
		}

		try {
			await this.stripe.subscriptions.update(user.stripeSubscriptionId, {
				cancel_at_period_end: false,
			});

			const updatedUser = await this.userRepository.patchUpsert(
				userId,
				{
					premium_will_cancel: false,
				},
				user.toRow(),
			);

			await this.dispatchUser(updatedUser);

			Logger.debug({userId, subscriptionId: user.stripeSubscriptionId}, 'Subscription reactivated');
		} catch (error: unknown) {
			Logger.error({error, userId, subscriptionId: user.stripeSubscriptionId}, 'Failed to reactivate subscription');
			const message = error instanceof Error ? error.message : 'Failed to reactivate subscription';
			throw new StripeError(message);
		}
	}

	async extendSubscriptionWithGiftTrial(user: User, durationMonths: number, idempotencyKey: string): Promise<void> {
		if (!this.stripe || !user.stripeSubscriptionId) {
			throw new NoActiveSubscriptionError();
		}

		const appliedKey = `gift_trial_applied:${user.id}:${idempotencyKey}`;
		const inflightKey = `gift_trial_inflight:${user.id}:${idempotencyKey}`;

		if (await this.cacheService.get<boolean>(appliedKey)) {
			Logger.debug({userId: user.id, idempotencyKey}, 'Gift trial extension already applied (idempotent hit)');
			return;
		}
		if (await this.cacheService.get<boolean>(inflightKey)) {
			Logger.debug({userId: user.id, idempotencyKey}, 'Gift trial extension in-flight; skipping duplicate');
			return;
		}
		await this.cacheService.set(inflightKey, seconds('1 minute'));

		try {
			const subscription = await this.stripe.subscriptions.retrieve(user.stripeSubscriptionId);

			const currentTrialEnd = subscription.trial_end;
			const item = getPrimarySubscriptionItem(subscription);
			const currentPeriodEnd = getSubscriptionItemPeriodEndUnix(item);
			const baseUnix = currentTrialEnd ?? currentPeriodEnd;

			if (!baseUnix) {
				throw new StripeError('Subscription has no trial_end or current_period_end');
			}

			const baseDate = new Date(baseUnix * 1000);
			const newTrialEnd = addMonthsClamp(baseDate, durationMonths);
			const newTrialEndUnix = Math.floor(newTrialEnd.getTime() / 1000);

			await this.stripe.subscriptions.update(user.stripeSubscriptionId, {
				trial_end: newTrialEndUnix,
				proration_behavior: 'none',
			});

			await this.cacheService.set(appliedKey, seconds('365 days'));

			Logger.debug(
				{
					userId: user.id,
					subscriptionId: user.stripeSubscriptionId,
					baseDate,
					newTrialEnd,
					durationMonths,
					idempotencyKey,
				},
				'Extended subscription with gift trial period',
			);
		} catch (error: unknown) {
			Logger.error(
				{error, userId: user.id, subscriptionId: user.stripeSubscriptionId, idempotencyKey},
				'Failed to extend subscription with gift trial',
			);
			const message = error instanceof Error ? error.message : 'Failed to extend subscription with gift';
			throw new StripeError(message);
		} finally {
			await this.cacheService.delete(inflightKey);
		}
	}

	private async dispatchUser(user: User): Promise<void> {
		await this.gatewayService.dispatchPresence({
			userId: user.id,
			event: 'USER_UPDATE',
			data: mapUserToPrivateResponse(user),
		});
	}
}
