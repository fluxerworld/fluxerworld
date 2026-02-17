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

import {getHelpArticles} from '@fluxer/marketing/src/help/HelpContentLoader';
import {getPolicies} from '@fluxer/marketing/src/policies/PolicyContentLoader';

interface UrlEntry {
	loc: string;
	changefreq: string;
	priority: string;
}

export function generateSitemap(baseUrl: string): string {
	const urls = generateUrls(baseUrl);
	const urlEntries = urls
		.map(
			(entry) => `  <url>
    <loc>${entry.loc}</loc>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
		)
		.join('\n');

	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

function generateUrls(baseUrl: string): ReadonlyArray<UrlEntry> {
	const staticPages: ReadonlyArray<UrlEntry> = [
		{loc: baseUrl, changefreq: 'weekly', priority: '1.0'},
		{loc: `${baseUrl}/policies`, changefreq: 'monthly', priority: '0.6'},
		{loc: `${baseUrl}/terms`, changefreq: 'monthly', priority: '0.5'},
		{loc: `${baseUrl}/privacy`, changefreq: 'monthly', priority: '0.5'},
		{loc: `${baseUrl}/security`, changefreq: 'monthly', priority: '0.5'},
		{loc: `${baseUrl}/guidelines`, changefreq: 'monthly', priority: '0.7'},
		{loc: `${baseUrl}/company-information`, changefreq: 'monthly', priority: '0.4'},
		{loc: `${baseUrl}/careers`, changefreq: 'weekly', priority: '0.6'},
		{loc: `${baseUrl}/download`, changefreq: 'weekly', priority: '0.9'},
		{loc: `${baseUrl}/plutonium`, changefreq: 'weekly', priority: '0.8'},
		{loc: `${baseUrl}/partners`, changefreq: 'monthly', priority: '0.6'},
		{loc: `${baseUrl}/press`, changefreq: 'monthly', priority: '0.5'},
	];

	const policyUrls = generatePolicyUrls(baseUrl);
	const helpUrls = generateHelpUrls(baseUrl);
	return [...staticPages, ...policyUrls, ...helpUrls];
}

function generatePolicyUrls(baseUrl: string): ReadonlyArray<UrlEntry> {
	const policies = getPolicies();
	return policies.map((policy) => ({
		loc: `${baseUrl}/${policy.slug}`,
		changefreq: 'monthly',
		priority: '0.5',
	}));
}

function generateHelpUrls(baseUrl: string): ReadonlyArray<UrlEntry> {
	const articles = getHelpArticles();
	return [
		{loc: `${baseUrl}/help`, changefreq: 'weekly', priority: '0.7'},
		...articles.map((article) => ({
			loc: `${baseUrl}/help/${article.slug}`,
			changefreq: 'monthly',
			priority: '0.5',
		})),
	];
}
