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

import type {Context, Env, Input, TypedResponse, ValidationTargets} from 'hono';
import type {ZodError, ZodType} from 'zod';

type HasUndefined<T> = undefined extends T ? true : false;

export type ValidatorSafeParseResult<T extends ZodType> =
	| {success: true; data: T['_output']}
	| {success: false; error: ZodError<T['_input']>};

export type ValidatorPostHookResult<O = Record<string, unknown>> = Response | undefined | TypedResponse<O>;

export type ValidatorPostHook<
	T extends ZodType,
	E extends Env,
	P extends string,
	Target extends keyof ValidationTargets = keyof ValidationTargets,
	V extends Input = Input,
	O = Record<string, unknown>,
> = (
	result: ValidatorSafeParseResult<T> & {target: Target},
	c: Context<E, P, V>,
) => ValidatorPostHookResult<O> | Promise<ValidatorPostHookResult<O>>;

export type ValidatorPreHook<
	E extends Env,
	P extends string,
	Target extends keyof ValidationTargets,
	V extends Input,
> = (value: unknown, c: Context<E, P, V>, target: Target) => unknown | Promise<unknown>;

export interface ValidatorOptions<
	T extends ZodType,
	E extends Env,
	P extends string,
	Target extends keyof ValidationTargets,
	V extends Input,
> {
	pre?: ValidatorPreHook<E, P, Target, V>;
	post?: ValidatorPostHook<T, E, P, Target, V>;
}

export type ValidatorHookOrOptions<
	T extends ZodType,
	E extends Env,
	P extends string,
	Target extends keyof ValidationTargets,
	V extends Input,
> = ValidatorPostHook<T, E, P, Target, V> | ValidatorOptions<T, E, P, Target, V>;

export type ValidatorInput<
	T extends ZodType,
	Target extends keyof ValidationTargets,
	In = T['_input'],
	Out = T['_output'],
> = {
	in: HasUndefined<In> extends true
		? {[K in Target]?: In extends ValidationTargets[K] ? In : {[K2 in keyof In]?: ValidationTargets[K][K2]}}
		: {[K in Target]: In extends ValidationTargets[K] ? In : {[K2 in keyof In]: ValidationTargets[K][K2]}};
	out: {[K in Target]: Out};
};
