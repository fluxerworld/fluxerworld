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

import {createInputValidationError} from '@fluxer/validation/src/validator/ValidatorErrorFactory';
import {extractValidatorRequestValue} from '@fluxer/validation/src/validator/ValidatorRequestValue';
import type {
	ValidatorHookOrOptions,
	ValidatorInput,
	ValidatorOptions,
	ValidatorPostHookResult,
} from '@fluxer/validation/src/validator/ValidatorTypes';
import {normalizeValidatorValue} from '@fluxer/validation/src/validator/ValidatorValueNormalizer';
import {initializeFluxerErrorMap} from '@fluxer/validation/src/ZodErrorMap';
import type {Env, Input, MiddlewareHandler, ValidationTargets} from 'hono';
import type {ZodType} from 'zod';

function resolveValidatorOptions<
	T extends ZodType,
	E extends Env,
	P extends string,
	Target extends keyof ValidationTargets,
	V extends Input,
>(hookOrOptions?: ValidatorHookOrOptions<T, E, P, Target, V>): ValidatorOptions<T, E, P, Target, V> {
	if (typeof hookOrOptions === 'function') {
		return {post: hookOrOptions};
	}
	return hookOrOptions ?? {};
}

function isResponseWithResponseProperty(value: unknown): value is {response: Response} {
	return typeof value === 'object' && value !== null && 'response' in value && value.response instanceof Response;
}

function resolvePostHookResponse<O>(hookResult: ValidatorPostHookResult<O>): Response | undefined {
	if (hookResult === undefined) {
		return undefined;
	}
	if (hookResult instanceof Response) {
		return hookResult;
	}
	if (isResponseWithResponseProperty(hookResult)) {
		return hookResult.response;
	}
	return undefined;
}

export function createValidator<
	T extends ZodType,
	Target extends keyof ValidationTargets,
	E extends Env,
	P extends string,
	In = T['_input'],
	Out = T['_output'],
	I extends Input = ValidatorInput<T, Target, In, Out>,
	V extends I = I,
>(target: Target, schema: T, hookOrOptions?: ValidatorHookOrOptions<T, E, P, Target, V>): MiddlewareHandler<E, P, V> {
	initializeFluxerErrorMap();
	const options = resolveValidatorOptions(hookOrOptions);

	return async (c, next): Promise<Response | undefined> => {
		let value = await extractValidatorRequestValue(c, target);

		if (options.pre) {
			value = await options.pre(value, c, target);
		}

		const transformedValue = normalizeValidatorValue(value);

		const result = await schema.safeParseAsync(transformedValue);

		if (options.post) {
			const hookResponse = resolvePostHookResponse(await options.post({...result, target}, c));
			if (hookResponse !== undefined) {
				return hookResponse;
			}
		}

		if (!result.success) {
			throw createInputValidationError(result.error.issues);
		}

		c.req.addValidatedData(target, result.data as ValidationTargets[Target]);
		await next();
		return;
	};
}
