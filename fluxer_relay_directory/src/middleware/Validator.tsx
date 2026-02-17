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

import type {Context, Env, Input, MiddlewareHandler, ValidationTargets} from 'hono';
import type {ZodError, ZodType} from 'zod';

interface ValidationError {
	path: string;
	message: string;
	code: string;
}

type HasUndefined<T> = undefined extends T ? true : false;

export const Validator = <
	T extends ZodType,
	Target extends keyof ValidationTargets,
	E extends Env,
	P extends string,
	In = T['_input'],
	Out = T['_output'],
	I extends Input = {
		in: HasUndefined<In> extends true
			? {[K in Target]?: In extends ValidationTargets[K] ? In : {[K2 in keyof In]?: ValidationTargets[K][K2]}}
			: {[K in Target]: In extends ValidationTargets[K] ? In : {[K2 in keyof In]: ValidationTargets[K][K2]}};
		out: {[K in Target]: Out};
	},
	V extends I = I,
>(
	target: Target,
	schema: T,
): MiddlewareHandler<E, P, V> => {
	return async (c, next): Promise<Response | undefined> => {
		let value: unknown;
		switch (target) {
			case 'json':
				try {
					value = await c.req.json<unknown>();
				} catch {
					value = {};
				}
				break;
			case 'query':
				value = Object.fromEntries(
					Object.entries(c.req.queries()).map(([k, v]) => (v.length === 1 ? [k, v[0]] : [k, v])),
				);
				break;
			case 'param':
				value = c.req.param();
				break;
			case 'header':
				value = c.req.header();
				break;
			default:
				value = {};
		}

		const result = await schema.safeParseAsync(value);

		if (!result.success) {
			const errors: Array<ValidationError> = [];
			const zodError = result.error as ZodError;

			for (const issue of zodError.issues) {
				const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
				errors.push({path, message: issue.message, code: issue.code});
			}

			return (c as Context).json(
				{
					error: 'Validation failed',
					code: 'VALIDATION_ERROR',
					errors,
				},
				400,
			);
		}

		c.req.addValidatedData(target, result.data as ValidationTargets[Target]);
		await next();
		return;
	};
};
