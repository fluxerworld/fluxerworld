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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import {z} from 'zod';

type BodyPrimitive = string | File;
type BodyValue = BodyPrimitive | Array<BodyPrimitive>;
export type ParsedBody = Record<string, BodyValue | undefined>;

const StringSchema = z.string();

export function getOptionalString(body: ParsedBody, key: string): string | undefined {
	const value = body[key];
	if (value === undefined) return undefined;
	if (Array.isArray(value)) {
		const first = value[0];
		return typeof first === 'string' ? first : undefined;
	}
	return typeof value === 'string' ? value : undefined;
}

export function getRequiredString(body: ParsedBody, key: string): string | null {
	const value = getOptionalString(body, key);
	const parsed = StringSchema.safeParse(value);
	return parsed.success && parsed.data.trim() !== '' ? parsed.data : null;
}

export function getStringArray(body: ParsedBody, key: string): Array<string> {
	const value = body[key];
	if (value === undefined) return [];
	const items = Array.isArray(value) ? value : [value];
	return items.flatMap((item) => (typeof item === 'string' && item !== '' ? [item] : []));
}

export function parseDelimitedStringList(value: string | undefined): Array<string> {
	if (!value) return [];
	return value
		.split(/[\n,]/)
		.map((item) => item.trim())
		.filter((item) => item !== '');
}
