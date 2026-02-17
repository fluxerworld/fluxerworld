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

import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {getPolicyMetadata, POLICY_METADATA, type PolicyMetadata} from '@fluxer/marketing/src/content/policies/Metadata';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const POLICIES_DIR = join(__dirname, '..', 'content', 'policies');

export interface Policy {
	slug: string;
	title: string;
	description: string;
	category: string | null;
	lastUpdated: string;
	content: string;
}

export function getPolicy(slug: string): Policy | null {
	const metadata = getPolicyMetadata(slug);
	if (!metadata) {
		return null;
	}

	try {
		const filePath = join(POLICIES_DIR, `${slug}.md`);
		const content = readFileSync(filePath, 'utf-8');
		return {
			slug: metadata.slug,
			title: metadata.title,
			description: metadata.description,
			category: metadata.category,
			lastUpdated: metadata.lastUpdated,
			content,
		};
	} catch {
		return null;
	}
}

export function getPolicies(): ReadonlyArray<PolicyMetadata> {
	return POLICY_METADATA;
}
