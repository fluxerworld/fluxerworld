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

import type {HttpResponse} from '@app/lib/HttpClient';
import type {HttpError} from '@app/lib/HttpError';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import type {FieldValues, Path, UseFormReturn} from 'react-hook-form';

interface ValidationError {
	path: string;
	message: string;
}

interface APIErrorResponse {
	code: string;
	message: string;
	errors?: Array<ValidationError>;
}

interface HandleErrorOptions<T extends FieldValues> {
	pathMap?: Partial<Record<string, Path<T>>>;
}

function collectFormPaths(value: unknown, prefix: string, paths: Set<string>): void {
	if (Array.isArray(value)) {
		paths.add(prefix);
		for (let i = 0; i < value.length; i++) {
			collectFormPaths(value[i], `${prefix}.${i}`, paths);
		}
		return;
	}

	if (value && typeof value === 'object') {
		for (const [key, child] of Object.entries(value)) {
			const next = prefix ? `${prefix}.${key}` : key;
			paths.add(next);
			collectFormPaths(child, next, paths);
		}
		return;
	}

	if (prefix) {
		paths.add(prefix);
	}
}

function toCamelCaseSegment(value: string): string {
	return value.replace(/_([a-z])/g, (_match, char: string) => char.toUpperCase());
}

function toCamelCasePath(path: string): string {
	if (!path.includes('_') && !path.includes('.')) {
		return path;
	}
	return path
		.split('.')
		.map((segment) => (/^\d+$/.test(segment) ? segment : toCamelCaseSegment(segment)))
		.join('.');
}

export function handleError<T extends FieldValues>(
	i18n: I18n,
	form: UseFormReturn<T>,
	error: HttpResponse<unknown> | HttpError,
	defaultPath: Path<T>,
	options?: HandleErrorOptions<T>,
) {
	if ('body' in error && error.body) {
		const errorData = error.body as APIErrorResponse;

		if (errorData.code === APIErrorCodes.INVALID_FORM_BODY && errorData.errors?.length) {
			const formPaths = new Set<string>();
			collectFormPaths(form.getValues(), '', formPaths);

			const resolvedMessages = new Map<string, string>();
			const unknownMessages: Array<string> = [];

			for (const validationError of errorData.errors) {
				const rawPath = validationError.path;
				const message = validationError.message;

				const mappedPath = options?.pathMap?.[rawPath];
				const candidates = [mappedPath ? String(mappedPath) : null, rawPath, toCamelCasePath(rawPath)].filter(
					Boolean,
				) as Array<string>;

				const resolvedPath = candidates.find((candidate) => formPaths.has(candidate)) ?? null;
				if (resolvedPath) {
					const existing = resolvedMessages.get(resolvedPath);
					resolvedMessages.set(resolvedPath, existing ? `${existing} ${message}` : message);
				} else {
					unknownMessages.push(message);
				}
			}

			if (unknownMessages.length > 0) {
				const uniqueUnknown = Array.from(new Set(unknownMessages));
				const unknownCombined = uniqueUnknown.join(' ');
				const defaultKey = String(defaultPath);
				const existing = resolvedMessages.get(defaultKey);
				resolvedMessages.set(defaultKey, existing ? `${existing} ${unknownCombined}` : unknownCombined);
			}

			for (const [path, message] of resolvedMessages) {
				form.setError(path as Path<T>, {type: 'server', message});
			}
		} else if (errorData.message) {
			form.setError(defaultPath, {type: 'server', message: errorData.message});
		}
		return;
	}

	form.setError(defaultPath, {
		type: 'server',
		message: i18n._(msg`An unexpected error occurred. Please try again.`),
	});
}
