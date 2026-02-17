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

import type {ChannelID, MessageID, UserID} from '@fluxer/api/src/BrandedTypes';
import type {GiftCodeRow, PaymentBySubscriptionRow, PaymentRow} from '@fluxer/api/src/database/types/PaymentTypes';
import type {PushSubscriptionRow, RecentMentionRow} from '@fluxer/api/src/database/types/UserTypes';
import type {GiftCode} from '@fluxer/api/src/models/GiftCode';
import type {Payment} from '@fluxer/api/src/models/Payment';
import type {PushSubscription} from '@fluxer/api/src/models/PushSubscription';
import type {RecentMention} from '@fluxer/api/src/models/RecentMention';
import type {SavedMessage} from '@fluxer/api/src/models/SavedMessage';
import type {VisionarySlot} from '@fluxer/api/src/models/VisionarySlot';
import {GiftCodeRepository} from '@fluxer/api/src/user/repositories/GiftCodeRepository';
import type {IUserContentRepository} from '@fluxer/api/src/user/repositories/IUserContentRepository';
import {PaymentRepository} from '@fluxer/api/src/user/repositories/PaymentRepository';
import {PushSubscriptionRepository} from '@fluxer/api/src/user/repositories/PushSubscriptionRepository';
import {RecentMentionRepository} from '@fluxer/api/src/user/repositories/RecentMentionRepository';
import {SavedMessageRepository} from '@fluxer/api/src/user/repositories/SavedMessageRepository';
import {VisionarySlotRepository} from '@fluxer/api/src/user/repositories/VisionarySlotRepository';

export class UserContentRepository implements IUserContentRepository {
	private giftCodeRepository: GiftCodeRepository;
	private paymentRepository: PaymentRepository;
	private pushSubscriptionRepository: PushSubscriptionRepository;
	private recentMentionRepository: RecentMentionRepository;
	private savedMessageRepository: SavedMessageRepository;
	private visionarySlotRepository: VisionarySlotRepository;

	constructor() {
		this.giftCodeRepository = new GiftCodeRepository();
		this.paymentRepository = new PaymentRepository();
		this.pushSubscriptionRepository = new PushSubscriptionRepository();
		this.recentMentionRepository = new RecentMentionRepository();
		this.savedMessageRepository = new SavedMessageRepository();
		this.visionarySlotRepository = new VisionarySlotRepository();
	}

	async createGiftCode(data: GiftCodeRow): Promise<void> {
		return this.giftCodeRepository.createGiftCode(data);
	}

	async findGiftCode(code: string): Promise<GiftCode | null> {
		return this.giftCodeRepository.findGiftCode(code);
	}

	async findGiftCodeByPaymentIntent(paymentIntentId: string): Promise<GiftCode | null> {
		return this.giftCodeRepository.findGiftCodeByPaymentIntent(paymentIntentId);
	}

	async findGiftCodesByCreator(userId: UserID): Promise<Array<GiftCode>> {
		return this.giftCodeRepository.findGiftCodesByCreator(userId);
	}

	async redeemGiftCode(code: string, userId: UserID): Promise<{applied: boolean}> {
		return this.giftCodeRepository.redeemGiftCode(code, userId);
	}

	async updateGiftCode(code: string, data: Partial<GiftCodeRow>): Promise<void> {
		return this.giftCodeRepository.updateGiftCode(code, data);
	}

	async linkGiftCodeToCheckoutSession(code: string, checkoutSessionId: string): Promise<void> {
		return this.giftCodeRepository.linkGiftCodeToCheckoutSession(code, checkoutSessionId);
	}

	async createPayment(data: {
		checkout_session_id: string;
		user_id: UserID;
		price_id: string;
		product_type: string;
		status: string;
		is_gift: boolean;
		created_at: Date;
	}): Promise<void> {
		return this.paymentRepository.createPayment(data);
	}

	async updatePayment(data: Partial<PaymentRow> & {checkout_session_id: string}): Promise<{applied: boolean}> {
		return this.paymentRepository.updatePayment(data);
	}

	async getPaymentByCheckoutSession(checkoutSessionId: string): Promise<Payment | null> {
		return this.paymentRepository.getPaymentByCheckoutSession(checkoutSessionId);
	}

	async getPaymentByPaymentIntent(paymentIntentId: string): Promise<Payment | null> {
		return this.paymentRepository.getPaymentByPaymentIntent(paymentIntentId);
	}

	async getSubscriptionInfo(subscriptionId: string): Promise<PaymentBySubscriptionRow | null> {
		return this.paymentRepository.getSubscriptionInfo(subscriptionId);
	}

	async listPushSubscriptions(userId: UserID): Promise<Array<PushSubscription>> {
		return this.pushSubscriptionRepository.listPushSubscriptions(userId);
	}

	async createPushSubscription(data: PushSubscriptionRow): Promise<PushSubscription> {
		return this.pushSubscriptionRepository.createPushSubscription(data);
	}

	async deletePushSubscription(userId: UserID, subscriptionId: string): Promise<void> {
		return this.pushSubscriptionRepository.deletePushSubscription(userId, subscriptionId);
	}

	async getBulkPushSubscriptions(userIds: Array<UserID>): Promise<Map<UserID, Array<PushSubscription>>> {
		return this.pushSubscriptionRepository.getBulkPushSubscriptions(userIds);
	}

	async deleteAllPushSubscriptions(userId: UserID): Promise<void> {
		return this.pushSubscriptionRepository.deleteAllPushSubscriptions(userId);
	}

	async getRecentMention(userId: UserID, messageId: MessageID): Promise<RecentMention | null> {
		return this.recentMentionRepository.getRecentMention(userId, messageId);
	}

	async listRecentMentions(
		userId: UserID,
		includeEveryone: boolean = true,
		includeRole: boolean = true,
		includeGuilds: boolean = true,
		limit: number = 25,
		before?: MessageID,
	): Promise<Array<RecentMention>> {
		return this.recentMentionRepository.listRecentMentions(
			userId,
			includeEveryone,
			includeRole,
			includeGuilds,
			limit,
			before,
		);
	}

	async createRecentMention(mention: RecentMentionRow): Promise<RecentMention> {
		return this.recentMentionRepository.createRecentMention(mention);
	}

	async createRecentMentions(mentions: Array<RecentMentionRow>): Promise<void> {
		return this.recentMentionRepository.createRecentMentions(mentions);
	}

	async deleteRecentMention(mention: RecentMention): Promise<void> {
		return this.recentMentionRepository.deleteRecentMention(mention);
	}

	async deleteAllRecentMentions(userId: UserID): Promise<void> {
		return this.recentMentionRepository.deleteAllRecentMentions(userId);
	}

	async listSavedMessages(userId: UserID, limit: number = 25, before?: MessageID): Promise<Array<SavedMessage>> {
		return this.savedMessageRepository.listSavedMessages(userId, limit, before);
	}

	async createSavedMessage(userId: UserID, channelId: ChannelID, messageId: MessageID): Promise<SavedMessage> {
		return this.savedMessageRepository.createSavedMessage(userId, channelId, messageId);
	}

	async deleteSavedMessage(userId: UserID, messageId: MessageID): Promise<void> {
		return this.savedMessageRepository.deleteSavedMessage(userId, messageId);
	}

	async deleteAllSavedMessages(userId: UserID): Promise<void> {
		return this.savedMessageRepository.deleteAllSavedMessages(userId);
	}

	async listVisionarySlots(): Promise<Array<VisionarySlot>> {
		return this.visionarySlotRepository.listVisionarySlots();
	}

	async expandVisionarySlots(byCount: number): Promise<void> {
		return this.visionarySlotRepository.expandVisionarySlots(byCount);
	}

	async shrinkVisionarySlots(toCount: number): Promise<void> {
		return this.visionarySlotRepository.shrinkVisionarySlots(toCount);
	}

	async reserveVisionarySlot(slotIndex: number, userId: UserID): Promise<void> {
		return this.visionarySlotRepository.reserveVisionarySlot(slotIndex, userId);
	}

	async unreserveVisionarySlot(slotIndex: number, userId: UserID): Promise<void> {
		return this.visionarySlotRepository.unreserveVisionarySlot(slotIndex, userId);
	}
}
