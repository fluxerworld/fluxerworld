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

import AuthenticationStore from '@app/stores/AuthenticationStore';
import UserStore from '@app/stores/UserStore';
import {parseQuery, tokenize} from '@app/utils/SearchQueryParser';
import type {User} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

const CURRENT_USER_ID = 'current-user-id';
const CURRENT_USER: User = {
	id: CURRENT_USER_ID,
	username: 'currentuser',
	discriminator: '0001',
	global_name: null,
	avatar: null,
	avatar_color: null,
	flags: 0,
};

describe('SearchQueryParser', () => {
	beforeEach(() => {
		AuthenticationStore.setUserId(CURRENT_USER_ID);
		UserStore.users = {};
		UserStore.cacheUsers([CURRENT_USER]);
	});

	afterEach(() => {
		AuthenticationStore.setUserId(null);
		UserStore.users = {};
	});

	it('resolves @me for from filters', () => {
		const params = parseQuery('from:@me');
		expect(params.authorId).toEqual([CURRENT_USER_ID]);
	});

	it('resolves @me for mentions filters regardless of case', () => {
		const params = parseQuery('mentions:@Me');
		expect(params.mentions).toEqual([CURRENT_USER_ID]);
	});

	it('resolves @me for exclude filters', () => {
		const params = parseQuery('-from:@me');
		expect(params.excludeAuthorId).toEqual([CURRENT_USER_ID]);
	});

	describe('tokenize exact phrases', () => {
		it('extracts a quoted phrase from mixed content', () => {
			const result = tokenize('hello "exact phrase" world');
			expect(result.content).toBe('hello world');
			expect(result.exactPhrases).toEqual(['exact phrase']);
		});

		it('extracts a standalone quoted phrase', () => {
			const result = tokenize('"foo bar"');
			expect(result.content).toBe('');
			expect(result.exactPhrases).toEqual(['foo bar']);
		});

		it('returns empty exactPhrases for unquoted content', () => {
			const result = tokenize('hello world');
			expect(result.content).toBe('hello world');
			expect(result.exactPhrases).toEqual([]);
		});

		it('extracts multiple quoted phrases', () => {
			const result = tokenize('"first phrase" "second phrase"');
			expect(result.content).toBe('');
			expect(result.exactPhrases).toEqual(['first phrase', 'second phrase']);
		});

		it('does not treat filter-key quoted values as exact phrases', () => {
			const result = tokenize('from:user "hello world"');
			expect(result.content).toBe('');
			expect(result.exactPhrases).toEqual(['hello world']);
			expect(result.tokens).toHaveLength(1);
			expect(result.tokens[0].key).toBe('from');
		});

		it('extracts a quoted phrase surrounded by unquoted content', () => {
			const result = tokenize('test "quoted" more');
			expect(result.content).toBe('test more');
			expect(result.exactPhrases).toEqual(['quoted']);
		});

		it('ignores empty quotes', () => {
			const result = tokenize('""');
			expect(result.content).toBe('');
			expect(result.exactPhrases).toEqual([]);
		});

		it('ignores whitespace-only quotes', () => {
			const result = tokenize('" "');
			expect(result.content).toBe('');
			expect(result.exactPhrases).toEqual([]);
		});

		it('handles mixed filters, content, and exact phrases', () => {
			const result = tokenize('hello from:@me "exact match" world');
			expect(result.content).toBe('hello world');
			expect(result.exactPhrases).toEqual(['exact match']);
			expect(result.tokens).toHaveLength(1);
			expect(result.tokens[0].key).toBe('from');
		});

		it('handles escaped quotes inside a phrase', () => {
			const result = tokenize('"hello \\"world\\""');
			expect(result.exactPhrases).toHaveLength(1);
			expect(result.exactPhrases[0]).toBe('hello "world"');
		});
	});

	describe('parseQuery exact phrases', () => {
		it('sets exactPhrases for a quoted phrase', () => {
			const params = parseQuery('"hello world"');
			expect(params.exactPhrases).toEqual(['hello world']);
			expect(params.content).toBeUndefined();
		});

		it('sets both content and exactPhrases', () => {
			const params = parseQuery('test "exact phrase"');
			expect(params.content).toBe('test');
			expect(params.exactPhrases).toEqual(['exact phrase']);
		});

		it('does not set exactPhrases for plain content', () => {
			const params = parseQuery('test');
			expect(params.content).toBe('test');
			expect(params.exactPhrases).toBeUndefined();
		});

		it('handles multiple exact phrases', () => {
			const params = parseQuery('"alpha" "beta"');
			expect(params.exactPhrases).toEqual(['alpha', 'beta']);
			expect(params.content).toBeUndefined();
		});

		it('combines filters with exact phrases', () => {
			const params = parseQuery('from:@me "important message"');
			expect(params.authorId).toEqual([CURRENT_USER_ID]);
			expect(params.exactPhrases).toEqual(['important message']);
			expect(params.content).toBeUndefined();
		});
	});
});
