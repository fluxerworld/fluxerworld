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

import {SYSTEM_USER_ID} from '@fluxer/api/src/constants/Core';
import type {GiftCodeRow} from '@fluxer/api/src/database/types/PaymentTypes';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import * as RandomUtils from '@fluxer/api/src/utils/RandomUtils';

const CODE_LENGTH = 32;
const MAX_GENERATION_ATTEMPTS = 100;

export class AdminCodeGenerationService {
	constructor(private readonly userRepository: IUserRepository) {}

	async generateGiftCodes(count: number, durationMonths: number): Promise<Array<string>> {
		const codes: Array<string> = [];

		for (let i = 0; i < count; i += 1) {
			const code = await this.generateUniqueGiftCode();
			const giftCodeRow: GiftCodeRow = {
				code,
				duration_months: durationMonths,
				created_at: new Date(),
				created_by_user_id: SYSTEM_USER_ID,
				redeemed_at: null,
				redeemed_by_user_id: null,
				stripe_payment_intent_id: null,
				visionary_sequence_number: null,
				checkout_session_id: null,
				version: 1,
			};
			await this.userRepository.createGiftCode(giftCodeRow);
			codes.push(code);
		}

		return codes;
	}

	private async generateUniqueGiftCode(): Promise<string> {
		for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
			const candidate = RandomUtils.randomString(CODE_LENGTH);
			const exists = await this.userRepository.findGiftCode(candidate);
			if (!exists) {
				return candidate;
			}
		}
		throw new Error(
			`Failed to generate unique gift code after ${MAX_GENERATION_ATTEMPTS} attempts. ` +
				'This may indicate a high collision rate or database issues.',
		);
	}
}
