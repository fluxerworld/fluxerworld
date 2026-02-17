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

import type {Context, Env, Input, ValidationTargets} from 'hono';
import {getCookie} from 'hono/cookie';

type FormDataEntryValue = File | string;
type FormValue = FormDataEntryValue | Array<FormDataEntryValue>;

async function extractJsonValue<E extends Env, P extends string, V extends Input>(
	c: Context<E, P, V>,
): Promise<unknown> {
	try {
		return await c.req.json<unknown>();
	} catch {
		return {};
	}
}

async function extractFormValue<E extends Env, P extends string, V extends Input>(
	c: Context<E, P, V>,
): Promise<unknown> {
	const formData = await c.req.formData();
	const form: Record<string, FormValue> = {};

	formData.forEach((value, key) => {
		const existingValue = form[key];
		if (key.endsWith('[]')) {
			const list = Array.isArray(existingValue) ? existingValue : existingValue !== undefined ? [existingValue] : [];
			list.push(value);
			form[key] = list;
			return;
		}
		if (Array.isArray(existingValue)) {
			existingValue.push(value);
			return;
		}
		if (existingValue !== undefined) {
			form[key] = [existingValue, value];
			return;
		}
		form[key] = value;
	});

	return form;
}

function extractQueryValue<E extends Env, P extends string, V extends Input>(c: Context<E, P, V>): unknown {
	return Object.fromEntries(
		Object.entries(c.req.queries()).map(([key, values]) => (values.length === 1 ? [key, values[0]] : [key, values])),
	);
}

export async function extractValidatorRequestValue<
	E extends Env,
	P extends string,
	V extends Input,
	Target extends keyof ValidationTargets,
>(c: Context<E, P, V>, target: Target): Promise<unknown> {
	switch (target) {
		case 'json':
			return extractJsonValue(c);
		case 'form':
			return extractFormValue(c);
		case 'query':
			return extractQueryValue(c);
		case 'param':
			return c.req.param();
		case 'header':
			return c.req.header();
		case 'cookie':
			return getCookie(c);
		default:
			return {};
	}
}
