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

declare const LanguageCodeBrand: unique symbol;
export type LanguageCode = string & {readonly __brand: typeof LanguageCodeBrand};
export type BadgeValue = number | -1;
export interface MediaDimensions {
	maxWidth: number;
	maxHeight: number;
}

export type ResponseInterceptor = (
	response: {
		ok: boolean;
		status: number;
		headers: Record<string, string>;
		body: unknown;
		text?: string;
	},
	retryWithHeaders: (
		headers: Record<string, string>,
		overrideInterceptor?: ResponseInterceptor,
	) => Promise<{ok: boolean; status: number; headers: Record<string, string>; body: unknown; text?: string}>,
	reject: (error: Error) => void,
) =>
	| boolean
	| Promise<{ok: boolean; status: number; headers: Record<string, string>; body: unknown; text?: string}>
	| undefined;
