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

import crypto from 'node:crypto';
import {createTestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {createUserID} from '@fluxer/api/src/BrandedTypes';
import {Config} from '@fluxer/api/src/Config';
import {mockStripeWebhookSecret, restoreStripeWebhookSecret} from '@fluxer/api/src/stripe/tests/StripeWebhookTestUtils';
import {createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {
	createMockWebhookPayload,
	type StripeWebhookEventData,
} from '@fluxer/api/src/test/msw/handlers/StripeApiHandlers';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {PaymentRepository} from '@fluxer/api/src/user/repositories/PaymentRepository';
import {UserRepository} from '@fluxer/api/src/user/repositories/UserRepository';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {DeletionReasons} from '@fluxer/constants/src/Core';
import {UserFlags, UserPremiumTypes} from '@fluxer/constants/src/UserConstants';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

interface UserDataExistsResponse {
	user_exists: boolean;
	has_deleted_flag: boolean;
	has_self_deleted_flag: boolean;
	pending_deletion_at: string | null;
	deletion_reason_code: string | null;
	flags: string;
}

describe('Stripe Webhook Dispute Events', () => {
	let harness: Awaited<ReturnType<typeof createApiTestHarness>>;

	beforeAll(async () => {
		harness = await createApiTestHarness();
		mockStripeWebhookSecret('whsec_test_dispute');
	});

	afterAll(async () => {
		await harness.shutdown();
		restoreStripeWebhookSecret();
	});

	beforeEach(async () => {
		await harness.resetData();
	});

	function createWebhookSignature(payload: string, timestamp: number, secret: string): string {
		const signedPayload = `${timestamp}.${payload}`;
		const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
		return `t=${timestamp},v1=${signature}`;
	}

	async function sendWebhook(eventData: StripeWebhookEventData): Promise<{received: boolean}> {
		const {payload, timestamp} = createMockWebhookPayload(eventData);
		const signature = createWebhookSignature(payload, timestamp, Config.stripe.webhookSecret!);

		return createBuilder<{received: boolean}>(harness, '')
			.post('/stripe/webhook')
			.header('stripe-signature', signature)
			.header('content-type', 'application/json')
			.body(payload)
			.execute();
	}

	async function sendWebhookExpectStripeError(eventData: StripeWebhookEventData): Promise<void> {
		const {payload, timestamp} = createMockWebhookPayload(eventData);
		const signature = createWebhookSignature(payload, timestamp, Config.stripe.webhookSecret!);

		await createBuilder(harness, '')
			.post('/stripe/webhook')
			.header('stripe-signature', signature)
			.header('content-type', 'application/json')
			.body(payload)
			.expect(400, APIErrorCodes.STRIPE_ERROR)
			.execute();
	}

	describe('charge.dispute.created', () => {
		test('schedules account deletion on chargeback for direct purchase', async () => {
			const purchaser = await createTestAccount(harness);
			const paymentIntentId = 'pi_test_chargeback_123';
			const paymentRepo = new PaymentRepository();

			await paymentRepo.createPayment({
				checkout_session_id: 'cs_test_chargeback',
				user_id: createUserID(BigInt(purchaser.userId)),
				price_id: 'price_test_monthly',
				product_type: 'monthly_subscription',
				status: 'completed',
				is_gift: false,
				created_at: new Date(),
			});

			await paymentRepo.updatePayment({
				checkout_session_id: 'cs_test_chargeback',
				payment_intent_id: paymentIntentId,
			});

			const eventData: StripeWebhookEventData = {
				type: 'charge.dispute.created',
				data: {
					object: {
						id: 'dp_test_123',
						payment_intent: paymentIntentId,
						status: 'needs_response',
					},
				},
			};

			await sendWebhook(eventData);

			const updatedUser = await createBuilderWithoutAuth<UserDataExistsResponse>(harness)
				.get(`/test/users/${purchaser.userId}/data-exists`)
				.execute();

			expect(updatedUser.has_deleted_flag).toBe(true);
			expect(updatedUser.deletion_reason_code).toBe(DeletionReasons.BILLING_DISPUTE_OR_ABUSE);
			expect(updatedUser.pending_deletion_at).not.toBeNull();

			const deletionDate = new Date(updatedUser.pending_deletion_at!);
			const now = new Date();
			const daysDifference = (deletionDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
			expect(daysDifference).toBeGreaterThan(28);
			expect(daysDifference).toBeLessThan(32);
		});

		test('revokes premium and schedules deletion for gift chargeback', async () => {
			const purchaser = await createTestAccount(harness);
			const redeemer = await createTestAccount(harness);
			const paymentIntentId = 'pi_test_gift_chargeback_123';
			const giftCode = 'GIFT_CHARGEBACK_TEST';
			const userRepository = new UserRepository();
			const paymentRepo = new PaymentRepository();

			await userRepository.createGiftCode({
				code: giftCode,
				duration_months: 1,
				created_at: new Date(),
				created_by_user_id: createUserID(BigInt(purchaser.userId)),
				redeemed_at: new Date(),
				redeemed_by_user_id: createUserID(BigInt(redeemer.userId)),
				stripe_payment_intent_id: paymentIntentId,
				visionary_sequence_number: null,
				checkout_session_id: null,
				version: 1,
			});

			await paymentRepo.createPayment({
				checkout_session_id: 'cs_test_gift_chargeback',
				user_id: createUserID(BigInt(purchaser.userId)),
				price_id: 'price_test_monthly',
				product_type: 'monthly_subscription',
				status: 'completed',
				is_gift: true,
				created_at: new Date(),
			});

			await paymentRepo.updatePayment({
				checkout_session_id: 'cs_test_gift_chargeback',
				payment_intent_id: paymentIntentId,
				gift_code: giftCode,
			});

			await createBuilder(harness, redeemer.token)
				.post(`/test/users/${redeemer.userId}/premium`)
				.body({
					premium_type: UserPremiumTypes.SUBSCRIPTION,
					premium_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
				})
				.execute();

			const redeemerBeforeDispute = await createBuilder<{premium_type: number}>(harness, redeemer.token)
				.get('/users/@me')
				.execute();
			expect(redeemerBeforeDispute.premium_type).toBe(UserPremiumTypes.SUBSCRIPTION);

			const eventData: StripeWebhookEventData = {
				type: 'charge.dispute.created',
				data: {
					object: {
						id: 'dp_test_gift_123',
						payment_intent: paymentIntentId,
						status: 'needs_response',
					},
				},
			};

			await sendWebhook(eventData);

			const redeemerAfterDispute = await createBuilder<{premium_type: number}>(harness, redeemer.token)
				.get('/users/@me')
				.execute();
			expect(redeemerAfterDispute.premium_type).toBe(UserPremiumTypes.NONE);

			const purchaserAfterDispute = await createBuilderWithoutAuth<UserDataExistsResponse>(harness)
				.get(`/test/users/${purchaser.userId}/data-exists`)
				.execute();

			expect(purchaserAfterDispute.has_deleted_flag).toBe(true);
			expect(purchaserAfterDispute.deletion_reason_code).toBe(DeletionReasons.BILLING_DISPUTE_OR_ABUSE);
			expect(purchaserAfterDispute.pending_deletion_at).not.toBeNull();
		});

		test('handles dispute for payment intent not found gracefully', async () => {
			const eventData: StripeWebhookEventData = {
				type: 'charge.dispute.created',
				data: {
					object: {
						id: 'dp_test_unknown',
						payment_intent: 'pi_test_does_not_exist',
						status: 'needs_response',
					},
				},
			};

			await sendWebhookExpectStripeError(eventData);
		});
	});

	describe('charge.dispute.closed', () => {
		test('unsuspends account when chargeback is won', async () => {
			const purchaser = await createTestAccount(harness);
			const paymentIntentId = 'pi_test_dispute_won_123';
			const paymentRepo = new PaymentRepository();

			await paymentRepo.createPayment({
				checkout_session_id: 'cs_test_dispute_won',
				user_id: createUserID(BigInt(purchaser.userId)),
				price_id: 'price_test_monthly',
				product_type: 'monthly_subscription',
				status: 'completed',
				is_gift: false,
				created_at: new Date(),
			});

			await paymentRepo.updatePayment({
				checkout_session_id: 'cs_test_dispute_won',
				payment_intent_id: paymentIntentId,
			});

			await createBuilderWithoutAuth(harness)
				.patch(`/test/users/${purchaser.userId}/flags`)
				.body({flags: Number(UserFlags.DELETED)})
				.execute();

			const userRepository = new UserRepository();
			const userId = createUserID(BigInt(purchaser.userId));
			const user = await userRepository.findUnique(userId);
			await userRepository.patchUpsert(
				userId,
				{
					deletion_reason_code: DeletionReasons.BILLING_DISPUTE_OR_ABUSE,
					pending_deletion_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
				},
				user!.toRow(),
			);

			const userBeforeWin = await createBuilderWithoutAuth<UserDataExistsResponse>(harness)
				.get(`/test/users/${purchaser.userId}/data-exists`)
				.execute();
			expect(userBeforeWin.has_deleted_flag).toBe(true);
			expect(userBeforeWin.deletion_reason_code).toBe(DeletionReasons.BILLING_DISPUTE_OR_ABUSE);

			const eventData: StripeWebhookEventData = {
				type: 'charge.dispute.closed',
				data: {
					object: {
						id: 'dp_test_won',
						payment_intent: paymentIntentId,
						status: 'won',
					},
				},
			};

			await sendWebhook(eventData);

			const userAfterWin = await createBuilderWithoutAuth<UserDataExistsResponse>(harness)
				.get(`/test/users/${purchaser.userId}/data-exists`)
				.execute();

			expect(userAfterWin.has_deleted_flag).toBe(false);
			expect(userAfterWin.deletion_reason_code).toBeNull();
			expect(userAfterWin.pending_deletion_at).toBeNull();
		});

		test('does not unsuspend when chargeback is lost', async () => {
			const purchaser = await createTestAccount(harness);
			const paymentIntentId = 'pi_test_dispute_lost_123';
			const paymentRepo = new PaymentRepository();

			await paymentRepo.createPayment({
				checkout_session_id: 'cs_test_dispute_lost',
				user_id: createUserID(BigInt(purchaser.userId)),
				price_id: 'price_test_monthly',
				product_type: 'monthly_subscription',
				status: 'completed',
				is_gift: false,
				created_at: new Date(),
			});

			await paymentRepo.updatePayment({
				checkout_session_id: 'cs_test_dispute_lost',
				payment_intent_id: paymentIntentId,
			});

			await createBuilderWithoutAuth(harness)
				.patch(`/test/users/${purchaser.userId}/flags`)
				.body({flags: Number(UserFlags.DELETED)})
				.execute();

			const userRepository = new UserRepository();
			const userId = createUserID(BigInt(purchaser.userId));
			const user = await userRepository.findUnique(userId);
			await userRepository.patchUpsert(
				userId,
				{
					deletion_reason_code: DeletionReasons.BILLING_DISPUTE_OR_ABUSE,
					pending_deletion_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
				},
				user!.toRow(),
			);

			const eventData: StripeWebhookEventData = {
				type: 'charge.dispute.closed',
				data: {
					object: {
						id: 'dp_test_lost',
						payment_intent: paymentIntentId,
						status: 'lost',
					},
				},
			};

			await sendWebhook(eventData);

			const userAfterLoss = await createBuilderWithoutAuth<UserDataExistsResponse>(harness)
				.get(`/test/users/${purchaser.userId}/data-exists`)
				.execute();

			expect(userAfterLoss.has_deleted_flag).toBe(true);
			expect(userAfterLoss.deletion_reason_code).toBe(DeletionReasons.BILLING_DISPUTE_OR_ABUSE);
			expect(userAfterLoss.pending_deletion_at).not.toBeNull();
		});

		test('handles dispute closed for payment intent not found gracefully', async () => {
			const eventData: StripeWebhookEventData = {
				type: 'charge.dispute.closed',
				data: {
					object: {
						id: 'dp_test_unknown_closed',
						payment_intent: 'pi_test_does_not_exist',
						status: 'won',
					},
				},
			};

			await sendWebhookExpectStripeError(eventData);
		});
	});
});
