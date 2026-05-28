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

import {isAdultDomain} from '@fluxer/api/src/unfurler/AdultDomains';
import {describe, expect, it} from 'vitest';

describe('isAdultDomain', () => {
	it('matches a direct domain hit', () => {
		expect(isAdultDomain('pornhub.com')).toBe(true);
		expect(isAdultDomain('xvideos.com')).toBe(true);
		expect(isAdultDomain('redgifs.com')).toBe(true);
	});

	it('strips www. prefix before matching', () => {
		expect(isAdultDomain('www.pornhub.com')).toBe(true);
		expect(isAdultDomain('WWW.PORNHUB.COM')).toBe(true);
	});

	it('matches subdomains by walking up the hostname', () => {
		expect(isAdultDomain('m.pornhub.com')).toBe(true);
		expect(isAdultDomain('mobile.xvideos.com')).toBe(true);
		expect(isAdultDomain('fr.xhamster.com')).toBe(true);
		expect(isAdultDomain('deep.nested.sub.pornhub.com')).toBe(true);
	});

	it('is case-insensitive', () => {
		expect(isAdultDomain('PornHub.Com')).toBe(true);
		expect(isAdultDomain('M.PORNHUB.COM')).toBe(true);
	});

	it('does not match unrelated domains', () => {
		expect(isAdultDomain('google.com')).toBe(false);
		expect(isAdultDomain('youtube.com')).toBe(false);
		expect(isAdultDomain('wikipedia.org')).toBe(false);
		expect(isAdultDomain('fluxer.world')).toBe(false);
	});

	it('does not match mixed-content platforms (Reddit / Twitter / Bluesky / Mastodon)', () => {
		// These intentionally aren't in the list — per-post NSFW handling
		// is the right approach, not blanket domain blocking
		expect(isAdultDomain('reddit.com')).toBe(false);
		expect(isAdultDomain('twitter.com')).toBe(false);
		expect(isAdultDomain('x.com')).toBe(false);
		expect(isAdultDomain('bsky.app')).toBe(false);
		expect(isAdultDomain('mastodon.social')).toBe(false);
	});

	it('does not false-positive on overlapping but distinct domains', () => {
		// E.g. a domain ending in the same characters as an adult domain
		// without sharing the actual etld+1 should not match
		expect(isAdultDomain('notpornhub.com')).toBe(false);
		expect(isAdultDomain('xvideos.example.com')).toBe(false);
		expect(isAdultDomain('redgifs.org')).toBe(false);
	});

	it('matches rule34.xxx including subdomains', () => {
		expect(isAdultDomain('rule34.xxx')).toBe(true);
		expect(isAdultDomain('api.rule34.xxx')).toBe(true);
	});

	it('handles single-label hostnames without crashing', () => {
		expect(isAdultDomain('localhost')).toBe(false);
		expect(isAdultDomain('intranet')).toBe(false);
	});
});
