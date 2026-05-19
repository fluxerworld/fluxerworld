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

import {createHmac, timingSafeEqual} from 'node:crypto';
import {createUserID, type UserID} from '@fluxer/api/src/BrandedTypes';
import {Config} from '@fluxer/api/src/Config';
import {Logger} from '@fluxer/api/src/Logger';
import type {StripeGiftService} from '@fluxer/api/src/stripe/services/StripeGiftService';
import type {StripePremiumService} from '@fluxer/api/src/stripe/services/StripePremiumService';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {UserPremiumTypes} from '@fluxer/constants/src/UserConstants';

export interface PolarWebhookHeaders {
	id: string;         // webhook-id header
	timestamp: string;  // webhook-timestamp header
	signature: string;  // webhook-signature header (may be multi-value)
}

interface PolarSubscriptionData {
	id: string;
	status: string;
	customer_id?: string;
	product_id: string;
	cancel_at_period_end?: boolean;
	current_period_end?: string | null;
	metadata?: Record<string, unknown>;
	[k: string]: unknown;
}

interface PolarOrderData {
	id: string;
	status: string;
	subscription_id?: string | null;
	product_id: string;
	customer_id?: string;
	amount: number;
	currency: string;
	metadata?: Record<string, unknown>;
	[k: string]: unknown;
}

/**
 * Verifies + dispatches Polar webhook events.
 *
 * Signature format: standardwebhooks (https://www.standardwebhooks.com/).
 * Headers: webhook-id, webhook-timestamp, webhook-signature.
 * Signed payload: `${id}.${timestamp}.${rawBody}` → HMAC-SHA256 → base64.
 */
export class PolarWebhookService {
	constructor(
		private readonly premiumService: StripePremiumService,
		private readonly giftService: StripeGiftService,
		private readonly userRepository: IUserRepository,
	) {}

	async handleWebhook(params: {rawBody: string; headers: PolarWebhookHeaders}): Promise<void> {
		const {eventType, data} = this.verifyAndParse(params);
		Logger.debug({eventType}, 'Processing Polar webhook');
		try {
			await this.dispatch(eventType, data);
		} catch (err) {
			Logger.error({err, eventType}, 'Polar webhook handler failed');
			throw err;
		}
	}

	verifyAndParse(params: {
		rawBody: string;
		headers: PolarWebhookHeaders;
	}): {eventType: string; data: unknown} {
		const secret = Config.polar.webhookSecret;
		if (!secret) throw new Error('Polar webhook secret not configured');

		const {id, timestamp, signature} = params.headers;
		if (!id || !timestamp || !signature) {
			throw new Error('Polar webhook: missing signature headers');
		}

		// Polar's JS SDK does: new Webhook(btoa(secret)) — i.e. it
		// base64-encodes the *full* secret (prefix and all) and passes
		// that to standardwebhooks. standardwebhooks then base64-decodes
		// back to the original bytes, so the effective HMAC key is the
		// UTF-8 bytes of the full secret including the `polar_whs_`
		// prefix. We keep a few fallback interpretations for robustness.
		const stripped = secret.replace(/^polar_whs_/, '').replace(/^whsec_/, '');
		const keyCandidates: Buffer[] = [
			Buffer.from(secret, 'utf8'),          // full secret incl. prefix — Polar's actual behaviour
			Buffer.from(stripped, 'utf8'),        // stripped, raw bytes
			Buffer.from(stripped, 'base64'),      // stripped, base64-decoded (standardwebhooks default)
		];

		const signedPayload = `${id}.${timestamp}.${params.rawBody}`;

		// Header can carry multiple space-separated signatures like "v1,abc v1,def"
		const candidates = signature
			.split(' ')
			.map((part) => part.replace(/^v1,/, ''))
			.map((s) => s.trim())
			.filter(Boolean);

		let matched = false;
		outer: for (const key of keyCandidates) {
			const expected = createHmac('sha256', key).update(signedPayload).digest('base64');
			for (const candidate of candidates) {
				try {
					const c = Buffer.from(candidate, 'base64');
					const e = Buffer.from(expected, 'base64');
					if (c.length === e.length && timingSafeEqual(c, e)) {
						matched = true;
						break outer;
					}
				} catch {
					// skip malformed candidate
				}
			}
		}

		if (!matched) {
			const computed = keyCandidates.map((k) =>
				createHmac('sha256', k).update(signedPayload).digest('base64'),
			);
			Logger.warn(
				{
					id,
					timestamp,
					bodyLen: params.rawBody.length,
					received: candidates,
					computedFullSecret: computed[0],
					computedStrippedUtf8: computed[1],
					computedStrippedBase64: computed[2],
				},
				'Polar webhook signature mismatch — debug',
			);
			throw new Error('Polar webhook: signature mismatch');
		}

		const parsed = JSON.parse(params.rawBody) as {type: string; data: unknown};
		return {eventType: parsed.type, data: parsed.data};
	}

	private async dispatch(eventType: string, data: unknown): Promise<void> {
		switch (eventType) {
			// ── Subscriptions ───────────────────────────────────────
			// Polar's subscription lifecycle events. We grant/revoke
			// premium on the authoritative ones; the rest are logged
			// for observability.
			case 'subscription.active':
				// First time the subscription enters active state after
				// successful payment. `order.paid` fires in parallel for
				// the same event — grant on order.paid to keep a single
				// source-of-truth and avoid double-grants.
				Logger.debug({data}, 'Polar subscription.active');
				return;

			case 'subscription.created':
			case 'subscription.updated':
			case 'subscription.uncanceled':
				// No state change from our side — the user's premium
				// window is driven by order.paid / subscription.revoked.
				Logger.debug({eventType}, 'Polar subscription lifecycle (no-op)');
				return;

			case 'subscription.canceled':
				// User (or us) set cancel_at_period_end=true. Premium
				// continues until the period ends and subscription.revoked
				// fires; nothing to do here beyond logging.
				Logger.debug({data}, 'Polar subscription.canceled (cancel scheduled)');
				return;

			case 'subscription.past_due':
				Logger.warn({data}, 'Polar subscription past due');
				return;

			case 'subscription.revoked': {
				const sub = data as PolarSubscriptionData;
				const userId = await this.resolveUserId(sub);
				if (!userId) {
					Logger.warn({subscriptionId: sub.id}, 'subscription.revoked: could not resolve user');
					return;
				}
				await this.premiumService.revokePremium(userId);
				Logger.debug({userId: userId.toString(), subscriptionId: sub.id}, 'Premium revoked via Polar');
				return;
			}

			// ── Orders (both one-time and recurring payments) ───────
			case 'order.paid': {
				const order = data as PolarOrderData;
				const kind = this.readMetaString(order.metadata, 'kind');
				const userId = await this.resolveUserId(order);
				if (!userId) {
					Logger.warn({orderId: order.id}, 'order.paid: could not resolve user');
					return;
				}
				const product = this.resolveProductTier(order.product_id);
				if (!product) {
					Logger.warn({orderId: order.id, productId: order.product_id}, 'order.paid: unknown product');
					return;
				}
				if (kind === 'gift') {
					// Mint a gift code for the purchaser. correlationId =
					// Polar order id so duplicate webhook deliveries are
					// idempotent (mintGiftCodeDirect checks for an existing
					// payment row keyed on the same id).
					const code = await this.giftService.mintGiftCodeDirect({
						purchaserId: userId,
						durationMonths: product.durationMonths,
						correlationId: order.id,
					});
					// Also mark user as has_ever_purchased so the UX can
					// distinguish first-time vs returning customers.
					const u = await this.userRepository.findUnique(userId);
					if (u && !u.hasEverPurchased) {
						await this.userRepository.patchUpsert(
							userId,
							{has_ever_purchased: true},
							u.toRow(),
						);
					}
					Logger.debug(
						{orderId: order.id, userId: userId.toString(), code, months: product.durationMonths},
						'Polar gift code minted',
					);
					return;
				}
				// Subscription-backed order (initial or renewal).
				await this.premiumService.grantPremium(
					userId,
					UserPremiumTypes.SUBSCRIPTION as 1 | 2,
					product.durationMonths,
					product.billingCycle,
					true,
				);
				// Persist the subscription id so cancel/reactivate/portal
				// operations can find it later. We reuse stripeSubscriptionId
				// as the payment-provider-agnostic pointer for now.
				if (order.subscription_id) {
					const user = await this.userRepository.findUnique(userId);
					if (user && user.stripeSubscriptionId !== order.subscription_id) {
						await this.userRepository.patchUpsert(
							userId,
							{stripe_subscription_id: order.subscription_id},
							user.toRow(),
						);
					}
				}
				Logger.debug(
					{userId: userId.toString(), orderId: order.id, months: product.durationMonths},
					'Premium granted via Polar order.paid',
				);
				return;
			}

			case 'order.created':
			case 'order.updated':
				Logger.debug({eventType}, 'Polar order lifecycle (no-op)');
				return;

			case 'order.refunded':
			case 'refund.created':
			case 'refund.updated':
				// Refund semantics are product-dependent; for MVP we log.
				// Follow-up: revoke premium on gift refund / flag the user.
				Logger.warn({eventType, data}, 'Polar refund event — manual review');
				return;

			case 'checkout.updated':
				// Useful for debug only; the canonical signals are
				// subscription.revoked and order.paid.
				return;

			default:
				Logger.debug({eventType}, 'Polar: unhandled event type');
				return;
		}
	}

	/**
	 * Pull fluxer_user_id out of Polar event metadata (set at checkout
	 * session creation time in PolarCheckoutService).
	 */
	private async resolveUserId(data: {
		metadata?: Record<string, unknown>;
		customer_id?: string;
	}): Promise<UserID | null> {
		const fromMeta = this.readMetaString(data.metadata, 'fluxer_user_id');
		if (fromMeta) return this.castUserId(fromMeta);
		// Fallback: look up by Polar customer id if we ever store it.
		// Not implemented yet — checkout always sets customer_external_id
		// to the Fluxer user id, which Polar mirrors into metadata via
		// our own metadata field above.
		return null;
	}

	private castUserId(raw: string): UserID | null {
		try {
			return createUserID(BigInt(raw));
		} catch {
			return null;
		}
	}

	private readMetaString(
		meta: Record<string, unknown> | undefined,
		key: string,
	): string | null {
		const v = meta?.[key];
		return typeof v === 'string' && v.length > 0 ? v : null;
	}

	/**
	 * Map a Polar product id → tier info. Keyed off the config ids we set
	 * up during Polar onboarding.
	 */
	private resolveProductTier(productId: string): {
		kind: 'monthly_subscription' | 'yearly_subscription' | 'gift_1_month' | 'gift_1_year';
		durationMonths: number;
		billingCycle: 'monthly' | 'yearly' | null;
	} | null {
		const p = Config.polar.products;
		if (productId === p.monthlySubscription) {
			return {kind: 'monthly_subscription', durationMonths: 1, billingCycle: 'monthly'};
		}
		if (productId === p.yearlySubscription) {
			return {kind: 'yearly_subscription', durationMonths: 12, billingCycle: 'yearly'};
		}
		if (productId === p.gift1Month) {
			return {kind: 'gift_1_month', durationMonths: 1, billingCycle: null};
		}
		if (productId === p.gift1Year) {
			return {kind: 'gift_1_year', durationMonths: 12, billingCycle: null};
		}
		return null;
	}
}
