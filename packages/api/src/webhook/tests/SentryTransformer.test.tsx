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

import {transform} from '@fluxer/api/src/webhook/transformers/SentryTransformer';
import type {SentryWebhook} from '@fluxer/schema/src/domains/webhook/SentryWebhookSchemas';
import {describe, expect, it} from 'vitest';

function createBaseIssue(overrides: Partial<NonNullable<SentryWebhook['data']>['issue']> = {}) {
	return {
		id: '123456',
		shortId: 'PROJ-ABC',
		title: 'TypeError: Cannot read property of undefined',
		culprit: 'src/components/App.tsx in handleClick',
		permalink: 'https://sentry.io/organizations/org/issues/123456/',
		level: 'error',
		status: 'unresolved',
		platform: 'javascript',
		project: {
			id: 'project-123',
			name: 'Frontend App',
			slug: 'frontend-app',
			platform: 'javascript',
		},
		type: 'error',
		metadata: {
			value: 'Cannot read property of undefined',
			type: 'TypeError',
		},
		count: '42',
		userCount: 15,
		firstSeen: '2024-01-15T10:30:00Z',
		lastSeen: '2024-01-15T14:45:00Z',
		...overrides,
	};
}

describe('Sentry Transformer', () => {
	describe('transform', () => {
		it('transforms an error level issue created event', async () => {
			const payload: SentryWebhook = {
				action: 'created',
				data: {
					issue: createBaseIssue(),
				},
			};

			const result = await transform('created', payload);

			expect(result).not.toBeNull();
			expect(result?.title).toContain('TypeError: Cannot read property');
			expect(result?.url).toBe('https://sentry.io/organizations/org/issues/123456/');
			expect(result?.color).toBe(0xeb4841);
			expect(result?.fields).toHaveLength(4);

			const culpritField = result?.fields?.find((f) => f.name === 'Culprit');
			expect(culpritField?.value).toContain('handleClick');

			const projectField = result?.fields?.find((f) => f.name === 'Project');
			expect(projectField?.value).toBe('Frontend App');
			expect(projectField?.inline).toBe(true);

			const levelField = result?.fields?.find((f) => f.name === 'Level');
			expect(levelField?.value).toBe('ERROR');
			expect(levelField?.inline).toBe(true);

			const idField = result?.fields?.find((f) => f.name === 'ID');
			expect(idField?.value).toBe('PROJ-ABC');
			expect(idField?.inline).toBe(true);
		});

		it('transforms a warning level issue with correct color', async () => {
			const payload: SentryWebhook = {
				action: 'created',
				data: {
					issue: createBaseIssue({level: 'warning'}),
				},
			};

			const result = await transform('created', payload);

			expect(result).not.toBeNull();
			expect(result?.color).toBe(0xfcbd1f);

			const levelField = result?.fields?.find((f) => f.name === 'Level');
			expect(levelField?.value).toBe('WARNING');
		});

		it('transforms an info level issue with correct color', async () => {
			const payload: SentryWebhook = {
				action: 'created',
				data: {
					issue: createBaseIssue({level: 'info'}),
				},
			};

			const result = await transform('created', payload);

			expect(result).not.toBeNull();
			expect(result?.color).toBe(0x369df7);

			const levelField = result?.fields?.find((f) => f.name === 'Level');
			expect(levelField?.value).toBe('INFO');
		});

		it('transforms a debug level issue with correct color', async () => {
			const payload: SentryWebhook = {
				action: 'created',
				data: {
					issue: createBaseIssue({level: 'debug'}),
				},
			};

			const result = await transform('created', payload);

			expect(result).not.toBeNull();
			expect(result?.color).toBe(0x6c7293);

			const levelField = result?.fields?.find((f) => f.name === 'Level');
			expect(levelField?.value).toBe('DEBUG');
		});

		it('uses default color for unknown level', async () => {
			const payload: SentryWebhook = {
				action: 'created',
				data: {
					issue: createBaseIssue({level: 'critical'}),
				},
			};

			const result = await transform('created', payload);

			expect(result).not.toBeNull();
			expect(result?.color).toBe(0x369df7);
		});

		it('handles issue without culprit', async () => {
			const payload: SentryWebhook = {
				action: 'created',
				data: {
					issue: createBaseIssue({culprit: undefined}),
				},
			};

			const result = await transform('created', payload);

			expect(result).not.toBeNull();
			const culpritField = result?.fields?.find((f) => f.name === 'Culprit');
			expect(culpritField?.value).toBe('Unknown');
		});

		it('returns null for non-created event types', async () => {
			const payload: SentryWebhook = {
				action: 'resolved',
				data: {
					issue: createBaseIssue(),
				},
			};

			const result = await transform('resolved', payload);
			expect(result).toBeNull();
		});

		it('returns null when action does not match created', async () => {
			const payload: SentryWebhook = {
				action: 'ignored',
				data: {
					issue: createBaseIssue(),
				},
			};

			const result = await transform('created', payload);
			expect(result).toBeNull();
		});

		it('returns null when data is missing', async () => {
			const payload: SentryWebhook = {
				action: 'created',
			};

			const result = await transform('created', payload);
			expect(result).toBeNull();
		});

		it('returns null when issue is missing from data', async () => {
			const payload: SentryWebhook = {
				action: 'created',
				data: {} as SentryWebhook['data'],
			};

			const result = await transform('created', payload);
			expect(result).toBeNull();
		});

		it('truncates long titles', async () => {
			const longTitle =
				'This is a very long error message that exceeds the maximum allowed length for the embed title field and should be truncated appropriately';
			const payload: SentryWebhook = {
				action: 'created',
				data: {
					issue: createBaseIssue({title: longTitle}),
				},
			};

			const result = await transform('created', payload);

			expect(result).not.toBeNull();
			expect(result?.title?.length).toBeLessThanOrEqual(70);
		});

		it('truncates long culprit values', async () => {
			const longCulprit =
				'src/very/deep/nested/directory/structure/components/features/authentication/handlers/UserAuthenticationHandler.tsx in handleUserAuthenticationWithMultipleProviders';
			const payload: SentryWebhook = {
				action: 'created',
				data: {
					issue: createBaseIssue({culprit: longCulprit}),
				},
			};

			const result = await transform('created', payload);

			expect(result).not.toBeNull();
			const culpritField = result?.fields?.find((f) => f.name === 'Culprit');
			expect(culpritField?.value.length).toBeLessThanOrEqual(1024);
		});

		it('handles complex real-world Sentry webhook payload', async () => {
			const payload: SentryWebhook = {
				action: 'created',
				installation: {
					uuid: 'installation-uuid-123',
				},
				data: {
					issue: {
						id: '4567890123',
						shortId: 'BACKEND-XYZ',
						title: 'ConnectionError: Database connection timed out',
						culprit: 'lib/database/connection.py in connect',
						permalink: 'https://sentry.io/organizations/mycompany/issues/4567890123/',
						level: 'error',
						status: 'unresolved',
						platform: 'python',
						project: {
							id: 'proj-456',
							name: 'Backend API',
							slug: 'backend-api',
							platform: 'python',
						},
						type: 'error',
						metadata: {
							value: 'Database connection timed out',
							type: 'ConnectionError',
						},
						count: '156',
						userCount: 89,
						firstSeen: '2024-01-15T08:00:00Z',
						lastSeen: '2024-01-15T16:30:00Z',
					},
				},
				actor: {
					type: 'application',
					id: 'actor-id',
					name: 'sentry-app',
				},
			};

			const result = await transform('created', payload);

			expect(result).not.toBeNull();
			expect(result?.title).toContain('ConnectionError');
			expect(result?.url).toContain('mycompany');
			expect(result?.color).toBe(0xeb4841);

			const projectField = result?.fields?.find((f) => f.name === 'Project');
			expect(projectField?.value).toBe('Backend API');

			const idField = result?.fields?.find((f) => f.name === 'ID');
			expect(idField?.value).toBe('BACKEND-XYZ');
		});

		it('returns null for unknown event types', async () => {
			const payload: SentryWebhook = {
				action: 'created',
				data: {
					issue: createBaseIssue(),
				},
			};

			const result = await transform('unknown_event', payload);
			expect(result).toBeNull();
		});

		it('returns null for assigned event type', async () => {
			const payload: SentryWebhook = {
				action: 'assigned',
				data: {
					issue: createBaseIssue(),
				},
			};

			const result = await transform('assigned', payload);
			expect(result).toBeNull();
		});

		it('returns null for ignored event type', async () => {
			const payload: SentryWebhook = {
				action: 'ignored',
				data: {
					issue: createBaseIssue(),
				},
			};

			const result = await transform('ignored', payload);
			expect(result).toBeNull();
		});
	});
});
