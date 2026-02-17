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

import * as fs from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse as parseYaml} from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

interface PackageConfig {
	name: string;
	localesPath: string;
	outputFile: string;
	isEmail?: boolean;
}

const PACKAGES: Array<PackageConfig> = [
	{
		name: '@fluxer/errors',
		localesPath: path.join(ROOT_DIR, 'errors/src/i18n/locales'),
		outputFile: path.join(ROOT_DIR, 'errors/src/i18n/ErrorI18nTypes.generated.tsx'),
	},
	{
		name: '@fluxer/email',
		localesPath: path.join(ROOT_DIR, 'email/src/email_i18n/locales'),
		outputFile: path.join(ROOT_DIR, 'email/src/email_i18n/EmailI18nTypes.generated.tsx'),
		isEmail: true,
	},
	{
		name: '@fluxer/marketing',
		localesPath: path.join(ROOT_DIR, 'marketing/src/marketing_i18n/locales'),
		outputFile: path.join(ROOT_DIR, 'marketing/src/marketing_i18n/MarketingI18nTypes.generated.tsx'),
	},
];

function extractKeysFromYaml(filePath: string, isEmail = false): Array<string> {
	const raw = fs.readFileSync(filePath, 'utf8');
	const parsed = parseYaml(raw) as Record<string, unknown>;

	if (isEmail) {
		const emailTemplates = parsed as Record<string, {subject: string; body: string}>;
		return Object.keys(emailTemplates).sort();
	}

	return Object.keys(parsed).sort();
}

function generateErrorI18nTypes(keys: Array<string>): string {
	const licenceHeader = getLicenceHeader();
	const unionType = keys.map((key) => `\t| '${key}'`).join('\n');

	return `${licenceHeader}
export type ErrorI18nKey =
${unionType};
`;
}

function generateEmailI18nTypes(keys: Array<string>): string {
	const licenceHeader = getLicenceHeader();
	const unionType = keys.map((key) => `\t| '${key}'`).join('\n');

	return `${licenceHeader}
export type EmailTemplateKey =
${unionType};

export interface EmailTemplate {
	subject: string;
	body: string;
}
`;
}

function generateMarketingI18nTypes(keys: Array<string>): string {
	const licenceHeader = getLicenceHeader();
	const unionType = keys.map((key) => `\t| '${key}'`).join('\n');

	return `${licenceHeader}
export type MarketingI18nKey =
${unionType};
`;
}

function getLicenceHeader(): string {
	return `/*
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
`;
}

function generatePackageTypes(config: PackageConfig): void {
	const messagesFile = path.join(config.localesPath, 'messages.yaml');

	if (!fs.existsSync(messagesFile)) {
		console.error(`messages file not found: ${messagesFile}`);
		process.exit(1);
	}

	const keys = extractKeysFromYaml(messagesFile, config.isEmail);

	let content: string;
	if (config.name === '@fluxer/errors') {
		content = generateErrorI18nTypes(keys);
	} else if (config.name === '@fluxer/email') {
		content = generateEmailI18nTypes(keys);
	} else if (config.name === '@fluxer/marketing') {
		content = generateMarketingI18nTypes(keys);
	} else {
		throw new Error(`unknown package: ${config.name}`);
	}

	const outputDir = path.dirname(config.outputFile);
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, {recursive: true});
	}

	fs.writeFileSync(config.outputFile, content, 'utf8');
	console.log(`generated types for ${config.name} (${keys.length} keys) -> ${config.outputFile}`);
}

function main(): void {
	console.log('generating i18n types...\n');

	for (const config of PACKAGES) {
		generatePackageTypes(config);
	}

	console.log('\nall i18n types generated successfully!');
}

main();
