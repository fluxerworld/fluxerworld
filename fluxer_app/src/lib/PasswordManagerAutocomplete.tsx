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

import type React from 'react';

const CREDENTIAL_INPUT_TYPES = new Set(['email', 'password']);

export interface PasswordManagerIgnoreAttributes {
	autoComplete?: string;
	'data-1p-ignore'?: string;
	'data-op-ignore'?: string;
	'data-lpignore'?: string;
	'data-bwignore'?: string;
	'data-form-type'?: string;
	'data-protonpass-ignore'?: string;
}

export type InputWithPasswordManagerIgnoreAttributes = React.InputHTMLAttributes<HTMLInputElement> &
	PasswordManagerIgnoreAttributes;

export type TextareaWithPasswordManagerIgnoreAttributes = React.TextareaHTMLAttributes<HTMLTextAreaElement> &
	PasswordManagerIgnoreAttributes;

export const PASSWORD_MANAGER_IGNORE_ATTRIBUTES: PasswordManagerIgnoreAttributes = {
	autoComplete: 'off',
	'data-1p-ignore': 'true',
	'data-op-ignore': 'true',
	'data-lpignore': 'true',
	'data-bwignore': 'true',
	'data-form-type': 'other',
	'data-protonpass-ignore': 'true',
};

export function shouldApplyPasswordManagerIgnoreAttributes(type: React.HTMLInputTypeAttribute | undefined): boolean {
	const normalizedType = (type ?? 'text').toLowerCase();
	return !CREDENTIAL_INPUT_TYPES.has(normalizedType);
}
