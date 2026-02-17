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

import type {ISmsService} from '@fluxer/sms/src/ISmsService';
import type {ISmsProvider} from '@fluxer/sms/src/providers/ISmsProvider';
import {UnavailableSmsProvider} from '@fluxer/sms/src/providers/UnavailableSmsProvider';

export class SmsService implements ISmsService {
	private readonly provider: ISmsProvider;

	constructor(provider: ISmsProvider = new UnavailableSmsProvider()) {
		this.provider = provider;
	}

	async startVerification(phone: string): Promise<void> {
		await this.provider.startVerification(phone);
	}

	async checkVerification(phone: string, code: string): Promise<boolean> {
		return this.provider.checkVerification(phone, code);
	}
}
