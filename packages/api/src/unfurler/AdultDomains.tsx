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

// Static list of well-known adult-content domains. Used by the unfurler
// to skip embed generation for links to these sites when the message
// context isn't NSFW-allowed (non-NSFW channel in a non-age-restricted
// guild with default content filter).
//
// Scope rules:
//   - Only domains whose primary purpose is adult content
//   - Skip mixed-content platforms (Reddit, Twitter/X, Bluesky, Mastodon)
//     where SFW + NSFW share the same host — those need per-post tag
//     handling, not blanket domain blocking
//   - Skip paywalled creator platforms (OnlyFans, Fansly) — the public
//     URL is usually just a profile teaser; the actual content is
//     gated behind login. Profile-page embeds aren't the same problem
//
// Maintenance: add new domains here as they surface. Conservative
// additions are safer than aggressive — false-positives degrade
// legitimate user experience while false-negatives are caught by
// existing channel-level moderation.
const ADULT_DOMAINS: ReadonlySet<string> = new Set([
	// Video tube sites
	'pornhub.com',
	'xvideos.com',
	'xhamster.com',
	'xnxx.com',
	'redtube.com',
	'youporn.com',
	'tube8.com',
	'spankbang.com',
	'eporner.com',
	'thisvid.com',
	// GIF / clip hosts
	'redgifs.com',
	'gfycat.com', // shut down but still in some old links
	// Live cam platforms
	'chaturbate.com',
	'bongacams.com',
	'stripchat.com',
	'camsoda.com',
	'myfreecams.com',
	// Image boards / archives
	'rule34.xxx',
	'rule34.us',
	'rule34hentai.net',
	'e621.net',
	'e926.net', // SFW-tag-only sister site but signals adult-adjacent
	'gelbooru.com',
	'paheal.net',
	// Adult forums / archives
	'literotica.com',
	'asstr.org',
	// Dating / hookup (NSFW-by-default)
	'adultfriendfinder.com',
	'ashleymadison.com',
]);

// Returns true if the given hostname is — or is a subdomain of — a
// domain in the adult list. Case-insensitive, strips leading www.
export function isAdultDomain(hostname: string): boolean {
	const normalized = hostname.toLowerCase().replace(/^www\./, '');
	if (ADULT_DOMAINS.has(normalized)) return true;
	// Walk up the dot-separated parts to catch subdomains
	// (m.pornhub.com, mobile.xvideos.com, fr.xhamster.com, etc.)
	const parts = normalized.split('.');
	for (let i = 1; i < parts.length - 1; i++) {
		const candidate = parts.slice(i).join('.');
		if (ADULT_DOMAINS.has(candidate)) return true;
	}
	return false;
}
