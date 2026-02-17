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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

export interface HelpArticleMetadata {
	slug: string;
	title: string;
	description: string;
	category: string;
	lastUpdated: string;
}

export const HELP_ARTICLE_METADATA: ReadonlyArray<HelpArticleMetadata> = [
	{
		slug: 'regional-restrictions',
		title: 'Regional restrictions',
		description:
			'How regional age verification laws affect your access to Fluxer, which regions are currently affected, and what restrictions apply.',
		category: 'Platform',
		lastUpdated: '2026-02-16',
	},
	{
		slug: 'attachment-expiry',
		title: 'How attachment expiry works',
		description: 'How we set attachment expiry, how access can extend it, and what to do before a file is removed.',
		category: 'Files',
		lastUpdated: '2026-02-16',
	},
	{
		slug: 'delete-account',
		title: 'How to delete or disable your account',
		description: 'How to permanently delete or temporarily disable your Fluxer account, and what happens to your data.',
		category: 'Account',
		lastUpdated: '2026-02-16',
	},
	{
		slug: 'data-deletion',
		title: 'Requesting data deletion',
		description: 'How to delete your messages and other data from Fluxer.',
		category: 'Account',
		lastUpdated: '2026-02-16',
	},
	{
		slug: 'data-export',
		title: 'Exporting your account data',
		description: 'How to request and download a complete export of your Fluxer data.',
		category: 'Account',
		lastUpdated: '2026-02-16',
	},
	{
		slug: 'change-date-of-birth',
		title: 'How to change your date of birth',
		description: 'How to update your date of birth on Fluxer by contacting our support team.',
		category: 'Account',
		lastUpdated: '2026-02-16',
	},
	{
		slug: 'report-bug',
		title: 'Reporting a bug',
		description: 'How to file clear, high-quality bug reports for Fluxer Support or our GitHub.',
		category: 'Support',
		lastUpdated: '2026-02-16',
	},
	{
		slug: 'copyright',
		title: 'Copyright and IP policy',
		description: 'How to report suspected copyright or intellectual property violations on Fluxer.',
		category: 'Legal',
		lastUpdated: '2026-02-16',
	},
	{
		slug: 'data-retention',
		title: 'How long Fluxer keeps your information',
		description: 'How long Fluxer retains different types of information and why we keep it.',
		category: 'Privacy',
		lastUpdated: '2026-02-16',
	},
	{
		slug: 'dsa-dispute-resolution',
		title: 'EU DSA dispute resolution options',
		description: 'How EU users covered by the Digital Services Act can exercise their rights on Fluxer.',
		category: 'Legal',
		lastUpdated: '2026-02-16',
	},
	{
		slug: 'visionary',
		title: 'What was Fluxer Visionary?',
		description:
			'Fluxer Visionary was a limited lifetime Plutonium offering that sold out in February 2026. Learn about the numbered badge and what Visionary includes.',
		category: 'Premium',
		lastUpdated: '2026-02-17',
	},
];

export function getHelpArticleMetadata(slug: string): HelpArticleMetadata | null {
	return HELP_ARTICLE_METADATA.find((article) => article.slug === slug) ?? null;
}
