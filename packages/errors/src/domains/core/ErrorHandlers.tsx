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

import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {Locales} from '@fluxer/constants/src/Locales';
import {OAuth2Error} from '@fluxer/errors/src/domains/auth/OAuth2Error';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {
	getErrorRecord,
	hasApiErrorCode,
	resolveApiErrorCode,
	resolveErrorData,
	resolveErrorHeaders,
	resolveErrorMessage,
	resolveErrorStatus,
	resolveMessageVariables,
} from '@fluxer/errors/src/error_handling/ErrorIntrospection';
import {createJsonErrorResponse} from '@fluxer/errors/src/error_handling/ErrorResponse';
import {FluxerError} from '@fluxer/errors/src/FluxerError';
import {ErrorCodeToI18nKey} from '@fluxer/errors/src/i18n/ErrorCodeMappings';
import {getErrorMessage} from '@fluxer/errors/src/i18n/ErrorI18n';
import type {ErrorI18nKey} from '@fluxer/errors/src/i18n/ErrorI18nTypes.generated';
import type {BaseHonoEnv, ErrorI18nService} from '@fluxer/hono_types/src/HonoTypes';
import {createLogger} from '@fluxer/logger/src/Logger';
import {captureException} from '@fluxer/sentry/src/Sentry';
import {recordCounter} from '@fluxer/telemetry/src/Metrics';
import type {Context} from 'hono';
import {HTTPException} from 'hono/http-exception';

const logger = createLogger('errors');
const LOCALE_LOOKUP = new Map<string, string>(Object.values(Locales).map((locale) => [locale.toLowerCase(), locale]));

function isExpectedError(err: Error): boolean {
	return 'isExpected' in err && Boolean(err.isExpected);
}

function resolveLocaleFromAcceptLanguage(acceptLanguageHeader: string | undefined): string | undefined {
	if (!acceptLanguageHeader) {
		return undefined;
	}

	for (const entry of acceptLanguageHeader.split(',')) {
		const localeToken = entry.split(';')[0]?.trim().toLowerCase();
		if (!localeToken) {
			continue;
		}

		const exactMatch = LOCALE_LOOKUP.get(localeToken);
		if (exactMatch) {
			return exactMatch;
		}

		const baseToken = localeToken.split('-')[0];
		if (!baseToken) {
			continue;
		}

		if (baseToken === 'en') {
			return Locales.EN_US;
		}

		const baseMatch = LOCALE_LOOKUP.get(baseToken);
		if (baseMatch) {
			return baseMatch;
		}
	}

	return undefined;
}

function getI18nContext<E extends BaseHonoEnv>(
	ctx: Context<E>,
): {
	errorI18nService: ErrorI18nService | undefined;
	locale: string;
} {
	const requestLocale = ctx.get('requestLocale');
	const locale = requestLocale ?? resolveLocaleFromAcceptLanguage(ctx.req.header('accept-language')) ?? Locales.EN_US;

	return {
		errorI18nService: ctx.get('errorI18nService'),
		locale,
	};
}

function resolveLocalizedMessageWithoutService(
	code: string,
	locale: string,
	variables: Record<string, unknown> | undefined,
	fallbackMessage: string | undefined,
): string {
	const i18nKey = ErrorCodeToI18nKey[code as keyof typeof ErrorCodeToI18nKey] ?? (code as ErrorI18nKey);
	return getErrorMessage(i18nKey, locale, variables, fallbackMessage);
}

function resolveLocalizedMessage(
	errorI18nService: ErrorI18nService | undefined,
	code: string,
	locale: string,
	variables: Record<string, unknown> | undefined,
	fallbackMessage: string | undefined,
): string {
	if (errorI18nService) {
		return errorI18nService.getMessage(code, locale, variables, fallbackMessage);
	}
	return resolveLocalizedMessageWithoutService(code, locale, variables, fallbackMessage);
}

function handleLocalizedValidationErrors<E extends BaseHonoEnv>(
	err: InputValidationError,
	ctx: Context<E>,
): Response | null {
	if (!err.localizedErrors) {
		return null;
	}

	try {
		const {errorI18nService, locale} = getI18nContext(ctx);

		const resolvedErrors = err.localizedErrors.map((e) => ({
			path: e.path,
			message: resolveLocalizedMessage(errorI18nService, e.code, locale, e.variables, e.code),
			code: e.code,
		}));

		logger.debug({locale, errors: resolvedErrors}, 'Resolved localized validation errors');

		const localizedMessage = resolveLocalizedMessage(
			errorI18nService,
			APIErrorCodes.INVALID_FORM_BODY,
			locale,
			undefined,
			'Input Validation Error',
		);

		for (const error of resolvedErrors) {
			const pathForMetrics = error.path as string | Array<string> | undefined;
			const fieldPath = pathForMetrics
				? typeof pathForMetrics === 'string'
					? pathForMetrics
					: pathForMetrics.join('.')
				: 'unknown';
			recordCounter({
				name: 'validation.error',
				dimensions: {
					error_code: error.code,
					field: fieldPath,
					endpoint: ctx.req.path,
				},
			});
		}

		return createJsonErrorResponse({
			status: 400,
			code: APIErrorCodes.INVALID_FORM_BODY,
			message: localizedMessage,
			data: {errors: resolvedErrors},
		});
	} catch {
		logger.warn({err}, 'Failed to resolve localized validation errors, falling back to default error response');
		return null;
	}
}

function handleFluxerError<E extends BaseHonoEnv>(err: FluxerError, ctx: Context<E>): Response {
	if (err instanceof InputValidationError) {
		const localizedResponse = handleLocalizedValidationErrors(err, ctx);
		if (localizedResponse) {
			return localizedResponse;
		}
	}

	const {errorI18nService, locale} = getI18nContext(ctx);
	const resolvedMessage = resolveLocalizedMessage(
		errorI18nService,
		err.code,
		locale,
		err.messageVariables,
		err.message,
	);

	return createJsonErrorResponse({
		status: err.status,
		code: err.code,
		message: resolvedMessage,
		data: err.data,
		headers: err.headers,
	});
}

function handleKnownErrorCode<E extends BaseHonoEnv>(err: unknown, errorCode: string, ctx: Context<E>): Response {
	const {errorI18nService, locale} = getI18nContext(ctx);
	const resolvedMessage = resolveLocalizedMessage(
		errorI18nService,
		errorCode,
		locale,
		resolveMessageVariables(err),
		resolveErrorMessage(err),
	);

	const status = resolveErrorStatus(err) ?? (errorCode === APIErrorCodes.GENERAL_ERROR ? 500 : 400);

	return createJsonErrorResponse({
		status,
		code: errorCode,
		message: resolvedMessage,
		data: resolveErrorData(err),
		headers: resolveErrorHeaders(err),
	});
}

const HTTP_STATUS_TO_ERROR_CODE: Partial<Record<number, string>> = {
	400: APIErrorCodes.BAD_REQUEST,
	403: APIErrorCodes.FORBIDDEN,
	404: APIErrorCodes.NOT_FOUND,
	405: APIErrorCodes.METHOD_NOT_ALLOWED,
	409: APIErrorCodes.CONFLICT,
	410: APIErrorCodes.GONE,
	500: APIErrorCodes.INTERNAL_SERVER_ERROR,
	501: APIErrorCodes.NOT_IMPLEMENTED,
	502: APIErrorCodes.BAD_GATEWAY,
	503: APIErrorCodes.SERVICE_UNAVAILABLE,
	504: APIErrorCodes.GATEWAY_TIMEOUT,
};

function handleHTTPException<E extends BaseHonoEnv>(err: HTTPException, ctx: Context<E>): Response {
	const errorRecord = getErrorRecord(err);
	if (errorRecord && typeof errorRecord.code === 'string' && hasApiErrorCode(errorRecord.code)) {
		const {errorI18nService, locale} = getI18nContext(ctx);
		const resolvedMessage = resolveLocalizedMessage(
			errorI18nService,
			errorRecord.code,
			locale,
			resolveMessageVariables(err),
			err.message,
		);

		return createJsonErrorResponse({
			status: err.status,
			code: errorRecord.code,
			message: resolvedMessage,
			data: resolveErrorData(err),
			headers: resolveErrorHeaders(err),
		});
	}

	const code = HTTP_STATUS_TO_ERROR_CODE[err.status] ?? APIErrorCodes.GENERAL_ERROR;
	const {errorI18nService, locale} = getI18nContext(ctx);
	const resolvedMessage = resolveLocalizedMessage(errorI18nService, code, locale, undefined, err.message);

	return createJsonErrorResponse({
		status: err.status,
		code,
		message: resolvedMessage,
	});
}

function handleUnexpectedError<E extends BaseHonoEnv>(ctx: Context<E>): Response {
	const code = APIErrorCodes.INTERNAL_SERVER_ERROR;
	const {errorI18nService, locale} = getI18nContext(ctx);
	const resolvedMessage = resolveLocalizedMessage(errorI18nService, code, locale, undefined, undefined);

	return createJsonErrorResponse({
		status: 500,
		code,
		message: resolvedMessage,
	});
}

export function AppErrorHandler<E extends BaseHonoEnv = BaseHonoEnv>(
	err: Error,
	ctx: Context<E>,
): Response | Promise<Response> {
	if (!(err instanceof FluxerError || isExpectedError(err))) {
		captureException(err);
	}

	if (err instanceof OAuth2Error) {
		return err.getResponse();
	}

	if (err instanceof FluxerError) {
		return handleFluxerError(err, ctx);
	}

	const errorCode = resolveApiErrorCode(err);
	if (errorCode) {
		return handleKnownErrorCode(err, errorCode, ctx);
	}

	if (err instanceof HTTPException) {
		return handleHTTPException(err, ctx);
	}

	if (isExpectedError(err)) {
		logger.warn({err}, 'Expected error occurred');
		return createJsonErrorResponse({
			status: 400,
			code: APIErrorCodes.GENERAL_ERROR,
			message: err.message,
		});
	}

	logger.error({err}, 'Unhandled error occurred');
	return handleUnexpectedError(ctx);
}

export function AppNotFoundHandler<E extends BaseHonoEnv = BaseHonoEnv>(ctx: Context<E>): Response | Promise<Response> {
	const code = APIErrorCodes.NOT_FOUND;
	const {errorI18nService, locale} = getI18nContext(ctx);
	const resolvedMessage = resolveLocalizedMessage(errorI18nService, code, locale, undefined, undefined);

	return createJsonErrorResponse({
		status: 404,
		code,
		message: resolvedMessage,
	});
}
