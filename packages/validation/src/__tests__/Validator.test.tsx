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

import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {createValidator} from '@fluxer/validation/src/Validator';
import {Hono} from 'hono';
import {describe, expect, it} from 'vitest';
import {z} from 'zod';

function createTestApp() {
	return new Hono();
}

describe('Validator middleware', () => {
	describe('JSON body validation', () => {
		it('should validate valid JSON body', async () => {
			const app = createTestApp();
			const schema = z.object({
				name: z.string(),
				age: z.number(),
			});

			app.post('/test', createValidator('json', schema), (c) => {
				const data = c.req.valid('json');
				return c.json(data);
			});

			const response = await app.request('/test', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({name: 'John', age: 30}),
			});

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body).toEqual({name: 'John', age: 30});
		});

		it('should throw InputValidationError for invalid JSON body', async () => {
			const app = createTestApp();
			const schema = z.object({
				name: z.string(),
				age: z.number(),
			});

			let thrownError: Error | null = null;

			app.post('/test', createValidator('json', schema), (c) => {
				return c.json({success: true});
			});

			app.onError((err) => {
				thrownError = err;
				if (err instanceof InputValidationError) {
					return new Response(JSON.stringify({error: 'validation_error'}), {status: 400});
				}
				return new Response('Internal error', {status: 500});
			});

			const response = await app.request('/test', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({name: 123, age: 'not a number'}),
			});

			expect(response.status).toBe(400);
			expect(thrownError).toBeInstanceOf(InputValidationError);
		});

		it('should handle empty JSON body as empty object', async () => {
			const app = createTestApp();
			const schema = z.object({}).optional();

			app.post('/test', createValidator('json', schema), (c) => {
				const data = c.req.valid('json');
				return c.json({received: data});
			});

			const response = await app.request('/test', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: '',
			});

			expect(response.status).toBe(200);
		});
	});

	describe('Query parameter validation', () => {
		it('should validate valid query parameters', async () => {
			const app = createTestApp();
			const schema = z.object({
				page: z.string(),
				limit: z.string(),
			});

			app.get('/test', createValidator('query', schema), (c) => {
				const data = c.req.valid('query');
				return c.json(data);
			});

			const response = await app.request('/test?page=1&limit=10');

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body).toEqual({page: '1', limit: '10'});
		});

		it('should throw InputValidationError for missing required query parameters', async () => {
			const app = createTestApp();
			const schema = z.object({
				page: z.string(),
				limit: z.string(),
			});

			let thrownError: Error | null = null;

			app.get('/test', createValidator('query', schema), (c) => {
				return c.json({success: true});
			});

			app.onError((err) => {
				thrownError = err;
				return new Response('Error', {status: 400});
			});

			const response = await app.request('/test?page=1');

			expect(response.status).toBe(400);
			expect(thrownError).toBeInstanceOf(InputValidationError);
		});

		it('should handle multiple values for same query parameter', async () => {
			const app = createTestApp();
			const schema = z.object({
				tags: z.array(z.string()),
			});

			app.get('/test', createValidator('query', schema), (c) => {
				const data = c.req.valid('query');
				return c.json(data);
			});

			const response = await app.request('/test?tags=a&tags=b&tags=c');

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body).toEqual({tags: ['a', 'b', 'c']});
		});
	});

	describe('Path parameter validation', () => {
		it('should validate valid path parameters', async () => {
			const app = createTestApp();
			const schema = z.object({
				id: z.string(),
			});

			app.get('/users/:id', createValidator('param', schema), (c) => {
				const data = c.req.valid('param');
				return c.json(data);
			});

			const response = await app.request('/users/123');

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body).toEqual({id: '123'});
		});

		it('should throw InputValidationError for invalid path parameters', async () => {
			const app = createTestApp();
			const schema = z.object({
				id: z.string().uuid(),
			});

			let thrownError: Error | null = null;

			app.get('/users/:id', createValidator('param', schema), (c) => {
				return c.json({success: true});
			});

			app.onError((err) => {
				thrownError = err;
				return new Response('Error', {status: 400});
			});

			const response = await app.request('/users/not-a-uuid');

			expect(response.status).toBe(400);
			expect(thrownError).toBeInstanceOf(InputValidationError);
		});
	});

	describe('Header validation', () => {
		it('should validate valid headers', async () => {
			const app = createTestApp();
			const schema = z.object({
				'x-api-key': z.string(),
			});

			app.get('/test', createValidator('header', schema), (c) => {
				const data = c.req.valid('header');
				return c.json({key: data['x-api-key']});
			});

			const response = await app.request('/test', {
				headers: {'X-Api-Key': 'secret-key'},
			});

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body).toEqual({key: 'secret-key'});
		});
	});

	describe('Empty string to null conversion', () => {
		it('should convert empty strings to null', async () => {
			const app = createTestApp();
			const schema = z.object({
				name: z.string(),
				bio: z.string().nullable(),
			});

			app.post('/test', createValidator('json', schema), (c) => {
				const data = c.req.valid('json');
				return c.json(data);
			});

			const response = await app.request('/test', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({name: 'John', bio: ''}),
			});

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body).toEqual({name: 'John', bio: null});
		});

		it('should convert nested empty strings to null', async () => {
			const app = createTestApp();
			const schema = z.object({
				user: z.object({
					name: z.string(),
					description: z.string().nullable(),
				}),
			});

			app.post('/test', createValidator('json', schema), (c) => {
				const data = c.req.valid('json');
				return c.json(data);
			});

			const response = await app.request('/test', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({user: {name: 'John', description: ''}}),
			});

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body).toEqual({user: {name: 'John', description: null}});
		});

		it('should convert empty arrays elements to null', async () => {
			const app = createTestApp();
			const schema = z.object({
				items: z.array(z.string().nullable()),
			});

			app.post('/test', createValidator('json', schema), (c) => {
				const data = c.req.valid('json');
				return c.json(data);
			});

			const response = await app.request('/test', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({items: ['a', '', 'b']}),
			});

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body).toEqual({items: ['a', null, 'b']});
		});
	});

	describe('Hook options', () => {
		it('should call pre hook before validation', async () => {
			const app = createTestApp();
			const schema = z.object({
				name: z.string(),
			});

			app.post(
				'/test',
				createValidator('json', schema, {
					pre: (value) => {
						const obj = value as Record<string, unknown>;
						return {...obj, name: String(obj.name).toUpperCase()};
					},
				}),
				(c) => {
					const data = c.req.valid('json');
					return c.json(data);
				},
			);

			const response = await app.request('/test', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({name: 'john'}),
			});

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body).toEqual({name: 'JOHN'});
		});

		it('should call post hook with validation result', async () => {
			const app = createTestApp();
			const schema = z.object({
				name: z.string(),
			});

			let postHookCalled = false;
			let postHookSuccess = false;

			app.post(
				'/test',
				createValidator('json', schema, {
					post: (result) => {
						postHookCalled = true;
						postHookSuccess = result.success;
						return undefined;
					},
				}),
				(c) => {
					const data = c.req.valid('json');
					return c.json(data);
				},
			);

			const response = await app.request('/test', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({name: 'John'}),
			});

			expect(response.status).toBe(200);
			expect(postHookCalled).toBe(true);
			expect(postHookSuccess).toBe(true);
		});

		it('should allow post hook to return custom response', async () => {
			const app = createTestApp();
			const schema = z.object({
				name: z.string(),
			});

			app.post(
				'/test',
				createValidator('json', schema, {
					post: () => {
						return new Response('Custom response', {status: 202});
					},
				}),
				(c) => {
					return c.json({reached: true});
				},
			);

			const response = await app.request('/test', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({name: 'John'}),
			});

			expect(response.status).toBe(202);
			const body = await response.text();
			expect(body).toBe('Custom response');
		});

		it('should support hook as function shorthand for post hook', async () => {
			const app = createTestApp();
			const schema = z.object({
				name: z.string(),
			});

			let hookCalled = false;

			app.post(
				'/test',
				createValidator('json', schema, (result) => {
					hookCalled = true;
					expect(result.success).toBe(true);
					return undefined;
				}),
				(c) => {
					const data = c.req.valid('json');
					return c.json(data);
				},
			);

			const response = await app.request('/test', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({name: 'John'}),
			});

			expect(response.status).toBe(200);
			expect(hookCalled).toBe(true);
		});
	});

	describe('Error details', () => {
		it('should include path in validation errors', async () => {
			const app = createTestApp();
			const schema = z.object({
				user: z.object({
					email: z.email(),
				}),
			});

			let capturedError: InputValidationError | null = null;

			app.post('/test', createValidator('json', schema), (c) => {
				return c.json({success: true});
			});

			app.onError((err) => {
				if (err instanceof InputValidationError) {
					capturedError = err;
				}
				return new Response('Error', {status: 400});
			});

			await app.request('/test', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({user: {email: 'invalid'}}),
			});

			expect(capturedError).toBeInstanceOf(InputValidationError);
			const localizedErrors = capturedError!.getLocalizedErrors();
			expect(localizedErrors).not.toBeNull();
			expect(localizedErrors![0].path).toBe('user.email');
			expect(localizedErrors![0].code).toBe(ValidationErrorCodes.INVALID_EMAIL_ADDRESS);
		});

		it('should include error code for too_small errors', async () => {
			const app = createTestApp();
			const schema = z.object({
				items: z.array(z.string()).min(3),
			});

			let capturedError: InputValidationError | null = null;

			app.post('/test', createValidator('json', schema), (c) => {
				return c.json({success: true});
			});

			app.onError((err) => {
				if (err instanceof InputValidationError) {
					capturedError = err;
				}
				return new Response('Error', {status: 400});
			});

			await app.request('/test', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({items: ['a']}),
			});

			expect(capturedError).toBeInstanceOf(InputValidationError);
			const localizedErrors = capturedError!.getLocalizedErrors();
			expect(localizedErrors).not.toBeNull();
			expect(localizedErrors![0].path).toBe('items');
			expect(localizedErrors![0].code).toBe(ValidationErrorCodes.INVALID_FORMAT);
		});

		it('should include error code for too_big errors', async () => {
			const app = createTestApp();
			const schema = z.object({
				count: z.number().max(10),
			});

			let capturedError: InputValidationError | null = null;

			app.post('/test', createValidator('json', schema), (c) => {
				return c.json({success: true});
			});

			app.onError((err) => {
				if (err instanceof InputValidationError) {
					capturedError = err;
				}
				return new Response('Error', {status: 400});
			});

			await app.request('/test', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({count: 100}),
			});

			expect(capturedError).toBeInstanceOf(InputValidationError);
			const localizedErrors = capturedError!.getLocalizedErrors();
			expect(localizedErrors).not.toBeNull();
			expect(localizedErrors![0].path).toBe('count');
			expect(localizedErrors![0].code).toBe(ValidationErrorCodes.INVALID_FORMAT);
		});

		it('should use root as path for top-level errors', async () => {
			const app = createTestApp();
			const schema = z.string();

			let capturedError: InputValidationError | null = null;

			app.post('/test', createValidator('json', schema), (c) => {
				return c.json({success: true});
			});

			app.onError((err) => {
				if (err instanceof InputValidationError) {
					capturedError = err;
				}
				return new Response('Error', {status: 400});
			});

			await app.request('/test', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({not: 'a string'}),
			});

			expect(capturedError).toBeInstanceOf(InputValidationError);
			const localizedErrors = capturedError!.getLocalizedErrors();
			expect(localizedErrors).not.toBeNull();
			expect(localizedErrors![0].path).toBe('root');
		});
	});

	describe('Form data validation', () => {
		it('should validate form data', async () => {
			const app = createTestApp();
			const schema = z.object({
				name: z.string(),
				email: z.email(),
			});

			app.post('/test', createValidator('form', schema), (c) => {
				const data = c.req.valid('form');
				return c.json(data);
			});

			const formData = new FormData();
			formData.append('name', 'John');
			formData.append('email', 'john@example.com');

			const response = await app.request('/test', {
				method: 'POST',
				body: formData,
			});

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body).toEqual({name: 'John', email: 'john@example.com'});
		});

		it('should handle array fields in form data', async () => {
			const app = createTestApp();
			const schema = z.object({
				'tags[]': z.array(z.string()),
			});

			app.post('/test', createValidator('form', schema), (c) => {
				const data = c.req.valid('form');
				return c.json(data);
			});

			const formData = new FormData();
			formData.append('tags[]', 'a');
			formData.append('tags[]', 'b');
			formData.append('tags[]', 'c');

			const response = await app.request('/test', {
				method: 'POST',
				body: formData,
			});

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body).toEqual({'tags[]': ['a', 'b', 'c']});
		});

		it('should handle duplicate non-array fields as arrays', async () => {
			const app = createTestApp();
			const schema = z.object({
				name: z.union([z.string(), z.array(z.string())]),
			});

			app.post('/test', createValidator('form', schema), (c) => {
				const data = c.req.valid('form');
				return c.json(data);
			});

			const formData = new FormData();
			formData.append('name', 'John');
			formData.append('name', 'Jane');

			const response = await app.request('/test', {
				method: 'POST',
				body: formData,
			});

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body).toEqual({name: ['John', 'Jane']});
		});
	});

	describe('Async validation', () => {
		it('should handle async schema validation', async () => {
			const app = createTestApp();
			const schema = z.object({
				name: z.string().refine(async (val) => val.length > 2, {
					message: ValidationErrorCodes.STRING_LENGTH_INVALID,
				}),
			});

			app.post('/test', createValidator('json', schema), (c) => {
				const data = c.req.valid('json');
				return c.json(data);
			});

			const response = await app.request('/test', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({name: 'John'}),
			});

			expect(response.status).toBe(200);
		});

		it('should handle async pre hook', async () => {
			const app = createTestApp();
			const schema = z.object({
				name: z.string(),
			});

			app.post(
				'/test',
				createValidator('json', schema, {
					pre: async (value) => {
						await new Promise((resolve) => setTimeout(resolve, 10));
						const obj = value as Record<string, unknown>;
						return {...obj, name: String(obj.name).toUpperCase()};
					},
				}),
				(c) => {
					const data = c.req.valid('json');
					return c.json(data);
				},
			);

			const response = await app.request('/test', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({name: 'john'}),
			});

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body).toEqual({name: 'JOHN'});
		});
	});
});
