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

import {HttpStatus} from '@fluxer/constants/src/HttpConstants';
import {FluxerError} from '@fluxer/errors/src/FluxerError';
import {
	BadGatewayError,
	BadRequestError,
	ConflictError,
	ForbiddenError,
	GatewayTimeoutError,
	GoneError,
	InternalServerError,
	MethodNotAllowedError,
	NotFoundError,
	NotImplementedError,
	ServiceUnavailableError,
	UnauthorizedError,
} from '@fluxer/errors/src/HttpErrors';
import {describe, expect, it} from 'vitest';

describe('HttpErrors', () => {
	describe('BadRequestError', () => {
		it('should have status 400 and default code/message', () => {
			const error = new BadRequestError();

			expect(error.status).toBe(HttpStatus.BAD_REQUEST);
			expect(error.code).toBe('BAD_REQUEST');
			expect(error.message).toBe('Bad Request');
			expect(error.name).toBe('BadRequestError');
		});

		it('should allow custom code', () => {
			const error = new BadRequestError({code: 'INVALID_INPUT'});

			expect(error.code).toBe('INVALID_INPUT');
			expect(error.message).toBe('Bad Request');
		});

		it('should allow custom message', () => {
			const error = new BadRequestError({message: 'Invalid request payload'});

			expect(error.code).toBe('BAD_REQUEST');
			expect(error.message).toBe('Invalid request payload');
		});

		it('should allow custom code and message', () => {
			const error = new BadRequestError({
				code: 'VALIDATION_FAILED',
				message: 'Request validation failed',
			});

			expect(error.code).toBe('VALIDATION_FAILED');
			expect(error.message).toBe('Request validation failed');
		});

		it('should include data', () => {
			const error = new BadRequestError({
				data: {field: 'email', reason: 'invalid format'},
			});

			expect(error.data).toEqual({field: 'email', reason: 'invalid format'});
		});

		it('should include headers', () => {
			const error = new BadRequestError({
				headers: {'X-Error-Type': 'validation'},
			});

			expect(error.headers).toEqual({'X-Error-Type': 'validation'});
		});

		it('should include cause', () => {
			const cause = new Error('Original error');
			const error = new BadRequestError({cause});

			expect(error.cause).toBe(cause);
		});

		it('should be instance of FluxerError', () => {
			const error = new BadRequestError();
			expect(error).toBeInstanceOf(FluxerError);
		});
	});

	describe('UnauthorizedError', () => {
		it('should have status 401 and default code/message', () => {
			const error = new UnauthorizedError();

			expect(error.status).toBe(HttpStatus.UNAUTHORIZED);
			expect(error.code).toBe('UNAUTHORIZED');
			expect(error.message).toBe('Unauthorized');
			expect(error.name).toBe('UnauthorizedError');
		});

		it('should allow custom code', () => {
			const error = new UnauthorizedError({code: 'INVALID_TOKEN'});

			expect(error.code).toBe('INVALID_TOKEN');
		});

		it('should include WWW-Authenticate header', () => {
			const error = new UnauthorizedError({
				headers: {'WWW-Authenticate': 'Bearer realm="api"'},
			});

			expect(error.headers).toEqual({'WWW-Authenticate': 'Bearer realm="api"'});
		});
	});

	describe('ForbiddenError', () => {
		it('should have status 403 and default code/message', () => {
			const error = new ForbiddenError();

			expect(error.status).toBe(HttpStatus.FORBIDDEN);
			expect(error.code).toBe('FORBIDDEN');
			expect(error.message).toBe('Forbidden');
			expect(error.name).toBe('ForbiddenError');
		});

		it('should allow custom code for permission errors', () => {
			const error = new ForbiddenError({code: 'MISSING_PERMISSIONS'});

			expect(error.code).toBe('MISSING_PERMISSIONS');
		});
	});

	describe('NotFoundError', () => {
		it('should have status 404 and default code/message', () => {
			const error = new NotFoundError();

			expect(error.status).toBe(HttpStatus.NOT_FOUND);
			expect(error.code).toBe('NOT_FOUND');
			expect(error.message).toBe('Not Found');
			expect(error.name).toBe('NotFoundError');
		});

		it('should allow custom code for resource not found', () => {
			const error = new NotFoundError({code: 'UNKNOWN_USER'});

			expect(error.code).toBe('UNKNOWN_USER');
		});
	});

	describe('MethodNotAllowedError', () => {
		it('should have status 405 and default code/message', () => {
			const error = new MethodNotAllowedError();

			expect(error.status).toBe(HttpStatus.METHOD_NOT_ALLOWED);
			expect(error.code).toBe('METHOD_NOT_ALLOWED');
			expect(error.message).toBe('Method Not Allowed');
			expect(error.name).toBe('MethodNotAllowedError');
		});

		it('should include Allow header', () => {
			const error = new MethodNotAllowedError({
				headers: {Allow: 'GET, POST'},
			});

			expect(error.headers).toEqual({Allow: 'GET, POST'});
		});
	});

	describe('ConflictError', () => {
		it('should have status 409 and default code/message', () => {
			const error = new ConflictError();

			expect(error.status).toBe(HttpStatus.CONFLICT);
			expect(error.code).toBe('CONFLICT');
			expect(error.message).toBe('Conflict');
			expect(error.name).toBe('ConflictError');
		});

		it('should allow custom code for conflict scenarios', () => {
			const error = new ConflictError({code: 'USERNAME_TAKEN'});

			expect(error.code).toBe('USERNAME_TAKEN');
		});
	});

	describe('GoneError', () => {
		it('should have status 410 and default code/message', () => {
			const error = new GoneError();

			expect(error.status).toBe(HttpStatus.GONE);
			expect(error.code).toBe('GONE');
			expect(error.message).toBe('Gone');
			expect(error.name).toBe('GoneError');
		});

		it('should allow custom code for deleted resources', () => {
			const error = new GoneError({code: 'RESOURCE_DELETED'});

			expect(error.code).toBe('RESOURCE_DELETED');
		});
	});

	describe('InternalServerError', () => {
		it('should have status 500 and default code/message', () => {
			const error = new InternalServerError();

			expect(error.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
			expect(error.code).toBe('INTERNAL_SERVER_ERROR');
			expect(error.message).toBe('Internal Server Error');
			expect(error.name).toBe('InternalServerError');
		});

		it('should allow custom code', () => {
			const error = new InternalServerError({code: 'DATABASE_ERROR'});

			expect(error.code).toBe('DATABASE_ERROR');
		});

		it('should preserve cause for debugging', () => {
			const cause = new Error('Database connection failed');
			const error = new InternalServerError({cause});

			expect(error.cause).toBe(cause);
		});
	});

	describe('NotImplementedError', () => {
		it('should have status 501 and default code/message', () => {
			const error = new NotImplementedError();

			expect(error.status).toBe(HttpStatus.NOT_IMPLEMENTED);
			expect(error.code).toBe('NOT_IMPLEMENTED');
			expect(error.message).toBe('Not Implemented');
			expect(error.name).toBe('NotImplementedError');
		});
	});

	describe('ServiceUnavailableError', () => {
		it('should have status 503 and default code/message', () => {
			const error = new ServiceUnavailableError();

			expect(error.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
			expect(error.code).toBe('SERVICE_UNAVAILABLE');
			expect(error.message).toBe('Service Unavailable');
			expect(error.name).toBe('ServiceUnavailableError');
		});

		it('should include Retry-After header', () => {
			const error = new ServiceUnavailableError({
				headers: {'Retry-After': '300'},
			});

			expect(error.headers).toEqual({'Retry-After': '300'});
		});
	});

	describe('BadGatewayError', () => {
		it('should have status 502 and default code/message', () => {
			const error = new BadGatewayError();

			expect(error.status).toBe(HttpStatus.BAD_GATEWAY);
			expect(error.code).toBe('BAD_GATEWAY');
			expect(error.message).toBe('Bad Gateway');
			expect(error.name).toBe('BadGatewayError');
		});
	});

	describe('GatewayTimeoutError', () => {
		it('should have status 504 and default code/message', () => {
			const error = new GatewayTimeoutError();

			expect(error.status).toBe(HttpStatus.GATEWAY_TIMEOUT);
			expect(error.code).toBe('GATEWAY_TIMEOUT');
			expect(error.message).toBe('Gateway Timeout');
			expect(error.name).toBe('GatewayTimeoutError');
		});
	});

	describe('error inheritance', () => {
		it('all HTTP errors should extend FluxerError', () => {
			const errors = [
				new BadRequestError(),
				new UnauthorizedError(),
				new ForbiddenError(),
				new NotFoundError(),
				new MethodNotAllowedError(),
				new ConflictError(),
				new GoneError(),
				new InternalServerError(),
				new NotImplementedError(),
				new ServiceUnavailableError(),
				new BadGatewayError(),
				new GatewayTimeoutError(),
			];

			for (const error of errors) {
				expect(error).toBeInstanceOf(FluxerError);
				expect(error).toBeInstanceOf(Error);
			}
		});
	});

	describe('response generation', () => {
		it('should generate correct response for each error type', async () => {
			const testCases = [
				{error: new BadRequestError(), expectedStatus: 400},
				{error: new UnauthorizedError(), expectedStatus: 401},
				{error: new ForbiddenError(), expectedStatus: 403},
				{error: new NotFoundError(), expectedStatus: 404},
				{error: new MethodNotAllowedError(), expectedStatus: 405},
				{error: new ConflictError(), expectedStatus: 409},
				{error: new GoneError(), expectedStatus: 410},
				{error: new InternalServerError(), expectedStatus: 500},
				{error: new NotImplementedError(), expectedStatus: 501},
				{error: new BadGatewayError(), expectedStatus: 502},
				{error: new ServiceUnavailableError(), expectedStatus: 503},
				{error: new GatewayTimeoutError(), expectedStatus: 504},
			];

			for (const {error, expectedStatus} of testCases) {
				const response = error.getResponse();
				expect(response.status).toBe(expectedStatus);
				expect(response.headers.get('Content-Type')).toBe('application/json');

				const body = await response.json();
				expect(body).toHaveProperty('code');
				expect(body).toHaveProperty('message');
			}
		});
	});
});
