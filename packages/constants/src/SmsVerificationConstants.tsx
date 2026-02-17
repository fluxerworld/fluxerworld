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

export const SMS_VERIFICATION_CODE_LENGTH = 6;
export const SMS_VERIFICATION_TTL_SECONDS = 600;
export const SMS_VERIFICATION_CACHE_PREFIX = 'sms:verification:';
export const SMS_VERIFICATION_MESSAGE_TEMPLATE =
	'Your Fluxer verification code is {code}. It expires in {minutes} minutes.';
export const SMS_TWILIO_DEFAULT_VERIFY_API_URL = 'https://verify.twilio.com/v2';
export const SMS_MASK_VISIBLE_PREFIX_LENGTH = 6;
export const SMS_TEST_VERIFICATION_CODE = '123456';
