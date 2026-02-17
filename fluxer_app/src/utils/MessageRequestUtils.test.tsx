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

import {buildMessageCreateRequest} from '@app/utils/MessageRequestUtils';
import {describe, expect, it} from 'vitest';

describe('MessageRequestUtils', () => {
	it('omits allowed_mentions when AllowedMentions matches defaults', () => {
		const request = buildMessageCreateRequest({
			content: 'hello',
			allowedMentions: {replied_user: true},
		});

		expect('allowed_mentions' in request).toBe(false);
	});

	it('includes allowed_mentions when parse is explicitly provided', () => {
		const request = buildMessageCreateRequest({
			content: 'hello',
			allowedMentions: {parse: []},
		});

		expect(request.allowed_mentions).toEqual({parse: []});
		expect((request as unknown as {allowedMentions?: unknown}).allowedMentions).toBeUndefined();
	});

	it('includes allowed_mentions when replied_user is explicitly disabled', () => {
		const request = buildMessageCreateRequest({
			content: 'hello',
			allowedMentions: {replied_user: false},
		});

		expect(request.allowed_mentions).toEqual({replied_user: false});
	});

	it('includes allowed_mentions when messageReference is present even with default values', () => {
		const request = buildMessageCreateRequest({
			content: 'hello',
			allowedMentions: {replied_user: true},
			messageReference: {channel_id: '123', message_id: '456', type: 0},
		});

		expect(request.allowed_mentions).toEqual({replied_user: true});
	});

	it('omits content when it is an empty string', () => {
		const request = buildMessageCreateRequest({
			content: '',
			messageReference: {channel_id: '123', message_id: '456', type: 0},
			allowedMentions: {replied_user: true},
		});

		expect(request.content).toBeUndefined();
		expect(request.message_reference).toEqual({channel_id: '123', message_id: '456', type: 0});
		expect(request.allowed_mentions).toEqual({replied_user: true});
	});
});
