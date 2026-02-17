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

export type MeilisearchFilter = string;

function quoteString(value: string): string {
	// Meilisearch filter syntax expects double-quoted strings.
	return JSON.stringify(value);
}

function formatScalar(value: string | number | boolean): string {
	if (typeof value === 'string') {
		return quoteString(value);
	}
	if (typeof value === 'boolean') {
		return value ? 'true' : 'false';
	}
	return String(value);
}

export function meiliEquals(field: string, value: string | number | boolean): MeilisearchFilter {
	return `${field} = ${formatScalar(value)}`;
}

export function meiliNotEquals(field: string, value: string | number | boolean): MeilisearchFilter {
	return `${field} != ${formatScalar(value)}`;
}

export function meiliGte(field: string, value: number): MeilisearchFilter {
	return `${field} >= ${value}`;
}

export function meiliLte(field: string, value: number): MeilisearchFilter {
	return `${field} <= ${value}`;
}

export function meiliIsNull(field: string): MeilisearchFilter {
	return `${field} IS NULL`;
}

export function meiliIsNotNull(field: string): MeilisearchFilter {
	return `${field} IS NOT NULL`;
}

export function meiliOrEquals(field: string, values: Array<string | number | boolean>): MeilisearchFilter | undefined {
	if (values.length === 0) {
		return undefined;
	}
	if (values.length === 1) {
		const value = values[0];
		if (value === undefined) {
			return undefined;
		}
		return meiliEquals(field, value);
	}
	return `(${values.map((v) => meiliEquals(field, v)).join(' OR ')})`;
}

export function meiliAndEquals(field: string, values: Array<string | number | boolean>): Array<MeilisearchFilter> {
	// For array fields, "field = value" checks membership. Joining with AND gives "contains all".
	return values.map((v) => meiliEquals(field, v));
}

export function meiliExcludeAny(field: string, values: Array<string | number | boolean>): Array<MeilisearchFilter> {
	// For array fields, "NOT field = value" excludes documents whose array contains value.
	return values.map((v) => `NOT (${meiliEquals(field, v)})`);
}

export function compactFilters(filters: Array<MeilisearchFilter | undefined>): Array<MeilisearchFilter> {
	return filters.filter((f): f is MeilisearchFilter => f !== undefined && f !== '');
}
