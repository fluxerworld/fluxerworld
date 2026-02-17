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

import {
	PublicUserFlags,
	PublicUserFlagsDescriptions,
	UserFlags,
	UserFlagsDescriptions,
} from '@fluxer/constants/src/UserConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {
	createBitflagInt32Type,
	createBitflagStringType,
	MAX_STRING_PROCESSING_LENGTH,
	normalizeString,
	normalizeWhitespace,
	removeStandaloneSurrogates,
	stripInvisibles,
	stripVariationSelectors,
	withOpenApiType,
	withStringLengthRangeValidation,
} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

const EMAIL_LOCAL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
const DISCRIMINATOR_REGEX = /^\d{1,4}$/;
const FLUXER_TAG_REGEX = /^[a-zA-Z0-9_]+$/;

export const PHONE_E164_REGEX = /^\+[1-9]\d{1,14}$/;

function sanitizeUsername(value: string): string {
	if (value.length > MAX_STRING_PROCESSING_LENGTH) {
		throw new Error(ValidationErrorCodes.STRING_LENGTH_INVALID);
	}
	let s = normalizeString(value);
	s = removeStandaloneSurrogates(s);
	s = stripInvisibles(s);
	s = stripVariationSelectors(s);
	s = normalizeWhitespace(s);
	return s;
}

export const EmailType = withOpenApiType(
	z
		.string()
		.transform(normalizeString)
		.pipe(
			withStringLengthRangeValidation(
				z.string().email(ValidationErrorCodes.INVALID_EMAIL_FORMAT),
				1,
				254,
				ValidationErrorCodes.EMAIL_LENGTH_INVALID,
			),
		)
		.refine((value: string) => {
			const atIndex = value.indexOf('@');
			if (atIndex === -1) return false;
			const local = value.slice(0, atIndex);
			return EMAIL_LOCAL_REGEX.test(local);
		}, ValidationErrorCodes.INVALID_EMAIL_LOCAL_PART),
	'EmailType',
);

export const DiscriminatorType = z
	.union([z.string(), z.number()])
	.transform((value) => String(value))
	.pipe(z.string().regex(DISCRIMINATOR_REGEX, ValidationErrorCodes.DISCRIMINATOR_INVALID_FORMAT))
	.transform((value) => {
		return Number.parseInt(value, 10);
	});

export const UsernameType = withOpenApiType(
	z
		.string()
		.transform((value) => value.trim())
		.pipe(withStringLengthRangeValidation(z.string(), 1, 32, ValidationErrorCodes.USERNAME_LENGTH_INVALID))
		.refine((value) => FLUXER_TAG_REGEX.test(value), ValidationErrorCodes.USERNAME_INVALID_CHARACTERS)
		.refine((value) => {
			const lowerValue = value.toLowerCase();
			return lowerValue !== 'everyone' && lowerValue !== 'here';
		}, ValidationErrorCodes.USERNAME_RESERVED_VALUE)
		.refine((value) => {
			const lowerValue = value.toLowerCase();
			return !lowerValue.includes('fluxer') && !lowerValue.includes('system message');
		}, ValidationErrorCodes.USERNAME_CANNOT_CONTAIN_RESERVED_TERMS),
	'UsernameType',
);

export const GlobalNameType = z
	.string()
	.superRefine((value, ctx) => {
		if (value.length > MAX_STRING_PROCESSING_LENGTH) {
			ctx.addIssue({
				code: 'custom',
				message: ValidationErrorCodes.GLOBAL_NAME_LENGTH_INVALID,
				params: {min: 1, max: 32},
			});
			return z.NEVER;
		}
	})
	.transform(sanitizeUsername)
	.pipe(withStringLengthRangeValidation(z.string(), 1, 32, ValidationErrorCodes.GLOBAL_NAME_LENGTH_INVALID))
	.refine((value) => {
		const lowerValue = value.toLowerCase();
		return lowerValue !== 'everyone' && lowerValue !== 'here';
	}, ValidationErrorCodes.GLOBAL_NAME_RESERVED_VALUE)
	.refine((value) => {
		const lowerValue = value.toLowerCase();
		return !lowerValue.includes('system message');
	}, ValidationErrorCodes.GLOBAL_NAME_CANNOT_CONTAIN_RESERVED_TERMS);

export const PasswordType = withOpenApiType(
	z
		.string()
		.transform(normalizeString)
		.pipe(withStringLengthRangeValidation(z.string(), 8, 256, ValidationErrorCodes.PASSWORD_LENGTH_INVALID)),
	'PasswordType',
);

export const PhoneNumberType = withOpenApiType(
	z
		.string()
		.transform(normalizeString)
		.refine((value) => PHONE_E164_REGEX.test(value), ValidationErrorCodes.PHONE_NUMBER_INVALID_FORMAT),
	'PhoneNumberType',
);

export const WebhookNameType = z
	.string()
	.transform(normalizeString)
	.pipe(withStringLengthRangeValidation(z.string(), 1, 80, ValidationErrorCodes.WEBHOOK_NAME_LENGTH_INVALID));

export const UserFlagsSchema = withOpenApiType(
	createBitflagStringType(UserFlags, UserFlagsDescriptions, 'User bitflags (64-bit)', 'UserFlags'),
	'UserFlags',
);

export const PublicUserFlagsSchema = withOpenApiType(
	createBitflagInt32Type(PublicUserFlags, PublicUserFlagsDescriptions, 'Public user bitflags', 'PublicUserFlags'),
	'PublicUserFlags',
);
