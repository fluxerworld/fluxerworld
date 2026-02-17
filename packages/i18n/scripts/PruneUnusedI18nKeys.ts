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

import {spawn} from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isScalar, parseDocument, parse as parseYaml, Scalar, YAMLMap} from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

interface PackageConfig {
	name: string;
	packagePath: string;
	localesPath: string;
	i18nMethod: 'getMessage' | 'getTemplate';
	skip: boolean;
}

const PACKAGES: Array<PackageConfig> = [
	{
		name: '@fluxer/errors',
		packagePath: path.join(ROOT_DIR, 'errors'),
		localesPath: path.join(ROOT_DIR, 'errors/src/i18n/locales'),
		i18nMethod: 'getMessage',
		skip: true,
	},
	{
		name: '@fluxer/marketing',
		packagePath: path.join(ROOT_DIR, 'marketing'),
		localesPath: path.join(ROOT_DIR, 'marketing/src/marketing_i18n/locales'),
		i18nMethod: 'getMessage',
		skip: false,
	},
	{
		name: '@fluxer/email',
		packagePath: path.join(ROOT_DIR, 'email'),
		localesPath: path.join(ROOT_DIR, 'email/src/email_i18n/locales'),
		i18nMethod: 'getTemplate',
		skip: true,
	},
];

const GET_MESSAGE_REGEX = /ctx\.i18n\.getMessage\s*\([^)]*\)/g;
const GET_MESSAGE_REGEX2 = /i18n\.getMessage\s*\([^)]*\)/g;
const GET_MESSAGE_REGEX3 = /ctx\.i18n\.getMessage\s*\((?:[^()]|\([^()]*\))*\)/g;
const GET_MESSAGE_REGEX4 = /i18n\.getMessage\s*\((?:[^()]|\([^()]*\))*\)/g;
const GET_TEMPLATE_REGEX = /getTemplate\s*\((?:[^()]|\([^()]*\))*\)/g;

const STRING_LITERAL_REGEX = /['"`]([^'"`]+)['"`]/g;

function findTypeScriptFiles(dir: string, filePaths: Array<string> = []): Array<string> {
	if (!fs.existsSync(dir)) {
		return filePaths;
	}

	const entries = fs.readdirSync(dir, {withFileTypes: true});

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			if (!['node_modules', '.next', 'dist', 'build', 'coverage', '.turbo'].includes(entry.name)) {
				findTypeScriptFiles(fullPath, filePaths);
			}
		} else if (entry.isFile() && (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts'))) {
			filePaths.push(fullPath);
		}
	}

	return filePaths;
}

function extractUsedKeys(packagePath: string, method: 'getMessage' | 'getTemplate'): Set<string> {
	const files = findTypeScriptFiles(packagePath);
	const usedKeys = new Set<string>();

	for (const file of files) {
		const content = fs.readFileSync(file, 'utf8');

		if (method === 'getMessage') {
			const regexes = [GET_MESSAGE_REGEX, GET_MESSAGE_REGEX2, GET_MESSAGE_REGEX3, GET_MESSAGE_REGEX4];
			for (const regex of regexes) {
				regex.lastIndex = 0;
				let callMatch: RegExpExecArray | null = null;
				while ((callMatch = regex.exec(content)) !== null) {
					const callText = callMatch[0];
					STRING_LITERAL_REGEX.lastIndex = 0;
					let keyMatch: RegExpExecArray | null = null;
					while ((keyMatch = STRING_LITERAL_REGEX.exec(callText)) !== null) {
						usedKeys.add(keyMatch[1]);
					}
				}
			}
		} else {
			GET_TEMPLATE_REGEX.lastIndex = 0;
			let callMatch: RegExpExecArray | null = null;
			while ((callMatch = GET_TEMPLATE_REGEX.exec(content)) !== null) {
				const callText = callMatch[0];
				STRING_LITERAL_REGEX.lastIndex = 0;
				let keyMatch: RegExpExecArray | null = null;
				while ((keyMatch = STRING_LITERAL_REGEX.exec(callText)) !== null) {
					usedKeys.add(keyMatch[1]);
				}
			}
		}
	}

	return usedKeys;
}

function flattenObject(
	obj: Record<string, unknown>,
	prefix: string = '',
): Map<string, {value: unknown; path: Array<string>}> {
	const result = new Map<string, {value: unknown; path: Array<string>}>();

	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;
		const currentPath = prefix ? [...prefix.split('.'), key] : [key];

		if (typeof value === 'string') {
			result.set(fullKey, {value, path: currentPath});
		} else if (
			typeof value === 'object' &&
			value !== null &&
			!Array.isArray(value) &&
			'subject' in value &&
			'body' in value
		) {
			result.set(fullKey, {value, path: currentPath});
		} else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
			const nested = flattenObject(value as Record<string, unknown>, fullKey);
			for (const [nestedKey, nestedValue] of nested) {
				result.set(nestedKey, nestedValue);
			}
		}
	}

	return result;
}

function getYamlKeys(filePath: string): Map<string, {path: Array<string>}> {
	const raw = fs.readFileSync(filePath, 'utf8');
	const parsed = parseYaml(raw) as Record<string, unknown>;
	const flat = flattenObject(parsed);
	const result = new Map<string, {path: Array<string>}>();

	for (const [key] of flat) {
		result.set(key, {path: key.split('.')});
	}

	return result;
}

function prunePackage(
	config: PackageConfig,
	usedKeys: Set<string>,
	dryRun: boolean,
): {
	totalKeys: number;
	usedKeys: number;
	unusedKeys: Array<string>;
	localeFiles: Array<string>;
} {
	console.log(`\n${'='.repeat(80)}`);
	console.log(`processing: ${config.name}`);
	console.log(`${'='.repeat(80)}`);

	const localeFiles = fs.readdirSync(config.localesPath).filter((f) => f.endsWith('.yaml'));
	const allUnusedKeys = new Map<string, {path: Array<string>}>();
	const allKeys = new Map<string, {path: Array<string>}>();

	const messagesFile = path.join(config.localesPath, 'messages.yaml');
	const yamlKeys = getYamlKeys(messagesFile);

	for (const [key, meta] of yamlKeys) {
		allKeys.set(key, meta);
		if (!usedKeys.has(key)) {
			allUnusedKeys.set(key, meta);
		}
	}

	const totalKeys = allKeys.size;
	const usedKeyCount = usedKeys.size;
	const unusedKeyArray = Array.from(allUnusedKeys.keys()).sort();

	console.log(`total keys in messages.yaml: ${totalKeys}`);
	console.log(`used keys in code: ${usedKeyCount}`);
	console.log(`unused keys: ${unusedKeyArray.length}`);

	if (unusedKeyArray.length > 0) {
		console.log(`\nunused keys:\n  ${unusedKeyArray.map((k) => `- ${k}`).join('\n  ')}`);
	}

	if (dryRun) {
		console.log(`\ndry run - would remove ${unusedKeyArray.length} unused keys from all locale files`);
	} else {
		console.log(`\npruning - removing ${unusedKeyArray.length} unused keys from all locale files`);
	}

	const unusedKeySet = new Set(allUnusedKeys.keys());
	const modifiedFilePaths: Array<string> = [];

	for (const localeFile of localeFiles) {
		const filePath = path.join(config.localesPath, localeFile);

		if (dryRun) {
			const raw = fs.readFileSync(filePath, 'utf8');
			const parsed = parseYaml(raw) as Record<string, unknown>;
			let wouldModify = false;

			for (const [unusedKey] of allUnusedKeys) {
				if (unusedKey in parsed) {
					wouldModify = true;
				}
			}

			if (wouldModify) {
				console.log(`  would update ${localeFile}`);
			}
		} else {
			const backup = fs.readFileSync(filePath, 'utf8');

			try {
				const modified = deleteKeysFromYamlFile(filePath, unusedKeySet);

				if (modified) {
					const validation = validateYamlFile(filePath);

					if (!validation.valid) {
						console.error(`  error ${localeFile}: parse error after pruning, rolling back`);
						console.error(`    error: ${validation.error}`);
						fs.writeFileSync(filePath, backup, 'utf8');
						continue;
					}

					console.log(`  updated ${localeFile}`);
					modifiedFilePaths.push(filePath);
				}
			} catch (error) {
				console.error(`  error ${localeFile}: error during pruning, rolling back`);
				console.error(`    error: ${error instanceof Error ? error.message : String(error)}`);
				fs.writeFileSync(filePath, backup, 'utf8');
			}
		}
	}

	return {
		totalKeys,
		usedKeys: usedKeyCount,
		unusedKeys: unusedKeyArray,
		localeFiles,
	};
}

function removeQuotesFromScalars(node: unknown): void {
	if (isScalar(node)) {
		if (node.type === 'QUOTE_SINGLE' || node.type === 'QUOTE_DOUBLE') {
			node.type = 'PLAIN';
		}
		return;
	}

	if (node instanceof YAMLMap) {
		for (const pair of node.items) {
			if (isScalar(pair.key)) {
				if (pair.key.type === 'QUOTE_SINGLE' || pair.key.type === 'QUOTE_DOUBLE') {
					pair.key.type = 'PLAIN';
				}
			}
			if (pair.value) {
				removeQuotesFromScalars(pair.value);
			}
		}
	}
}

function deleteKeysFromYamlFile(filePath: string, keysToDelete: Set<string>): boolean {
	const contents = fs.readFileSync(filePath, 'utf8');
	const doc = parseDocument(contents, {schema: 'core', version: '1.2'});
	const root = doc.contents;

	if (!(root instanceof YAMLMap)) {
		console.warn(`  warning ${path.basename(filePath)}: root is not a yaml map`);
		return false;
	}

	let modified = false;

	for (const keyToDelete of keysToDelete) {
		const pairIndex = root.items.findIndex((p) => p.key instanceof Scalar && p.key.value === keyToDelete);

		if (pairIndex !== -1) {
			root.items.splice(pairIndex, 1);
			modified = true;
		}
	}

	if (modified) {
		removeQuotesFromScalars(root);
		const newYaml = String(doc);
		fs.writeFileSync(filePath, newYaml, 'utf8');
	}

	return modified;
}

function validateYamlFile(filePath: string): {valid: boolean; error?: string} {
	try {
		const contents = fs.readFileSync(filePath, 'utf8');
		parseYaml(contents);
		return {valid: true};
	} catch (error) {
		return {
			valid: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

async function formatYamlFiles(filePaths: Array<string>): Promise<void> {
	if (filePaths.length === 0) {
		return;
	}

	console.log(`\n  formatting ${filePaths.length} file(s) with prettier...`);

	const prettierArgs = ['prettier', '--write', '--parser=yaml', '--print-width=120', ...filePaths];

	try {
		await new Promise<void>((resolve, reject) => {
			const process = spawn('npx', prettierArgs, {
				stdio: 'inherit',
				shell: true,
			});

			process.on('close', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`prettier exited with code ${code}`));
				}
			});
		});
		console.log('  formatting complete');
	} catch (error) {
		console.warn(`  warning prettier formatting failed: ${error}`);
		console.warn('    files are still valid yaml, just not formatted');
	}
}

interface LocaleValidationResult {
	file: string;
	missingKeys: Array<string>;
	extraKeys: Array<string>;
	isValid: boolean;
}

function validateLocaleConsistency(localesPath: string, messagesFile: string): Array<LocaleValidationResult> {
	const messagesContent = fs.readFileSync(path.join(localesPath, messagesFile), 'utf8');
	const messagesParsed = parseYaml(messagesContent) as Record<string, unknown>;
	const messagesKeys = flattenObject(messagesParsed);

	const localeFiles = fs.readdirSync(localesPath).filter((f) => f.endsWith('.yaml') && f !== messagesFile);
	const results: Array<LocaleValidationResult> = [];

	for (const localeFile of localeFiles) {
		const content = fs.readFileSync(path.join(localesPath, localeFile), 'utf8');
		const parsed = parseYaml(content) as Record<string, unknown>;
		const localeKeys = flattenObject(parsed);

		const missingKeys: Array<string> = [];
		const extraKeys: Array<string> = [];

		for (const key of messagesKeys.keys()) {
			if (!localeKeys.has(key)) {
				missingKeys.push(key);
			}
		}

		for (const key of localeKeys.keys()) {
			if (!messagesKeys.has(key)) {
				extraKeys.push(key);
			}
		}

		results.push({
			file: localeFile,
			missingKeys,
			extraKeys,
			isValid: missingKeys.length === 0 && extraKeys.length === 0,
		});
	}

	return results;
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const dryRun = !args.includes('--apply');
	const force = args.includes('--force');

	if (dryRun) {
		console.log('dry run mode - no files will be modified\n');
		console.log('run with --apply to actually prune unused keys');
		console.log('run with --force to skip confirmation prompts\n');
	} else {
		console.log('prune mode - this will delete unused keys from all locale files\n');

		if (!force) {
			console.log('warning: this action cannot be easily undone!');
			console.log('    consider committing your changes first.\n');
			console.log('to proceed without confirmation, run with --force\n');
			console.log('press ctrl+c to cancel, or wait 5 seconds to continue...');

			const start = Date.now();
			while (Date.now() - start < 5000) {}
		}
	}

	let totalUnusedKeys = 0;
	const results: Array<{name: string; count: number}> = [];
	const allModifiedFiles: Array<string> = [];

	for (const config of PACKAGES) {
		if (config.skip) {
			console.log(`\nskipping ${config.name}`);
			continue;
		}

		console.log(`\nscanning ${config.name} for i18n usage...`);
		const usedKeys = extractUsedKeys(config.packagePath, config.i18nMethod);
		console.log(`  found ${usedKeys.size} unique keys used in code`);

		const result = prunePackage(config, usedKeys, dryRun);
		results.push({name: config.name, count: result.unusedKeys.length});
		totalUnusedKeys += result.unusedKeys.length;

		if (!dryRun) {
			for (const localeFile of result.localeFiles) {
				const filePath = path.join(config.localesPath, localeFile);
				if (fs.existsSync(filePath)) {
					allModifiedFiles.push(filePath);
				}
			}
		}
	}

	if (!dryRun && allModifiedFiles.length > 0) {
		await formatYamlFiles(allModifiedFiles);
	}

	if (!dryRun) {
		console.log(`\n${'='.repeat(80)}`);
		console.log('validating locale consistency');
		console.log(`${'='.repeat(80)}`);

		let hasErrors = false;

		for (const config of PACKAGES) {
			if (config.skip) {
				continue;
			}

			const messagesFile = 'messages.yaml';
			const validationResults = validateLocaleConsistency(config.localesPath, messagesFile);

			for (const result of validationResults) {
				if (!result.isValid) {
					hasErrors = true;
					console.error(`\nerror ${config.name}/${result.file}:`);
					if (result.missingKeys.length > 0) {
						console.error(`   missing ${result.missingKeys.length} keys:`);
						for (const key of result.missingKeys.slice(0, 10)) {
							console.error(`     - ${key}`);
						}
						if (result.missingKeys.length > 10) {
							console.error(`     ... and ${result.missingKeys.length - 10} more`);
						}
					}
					if (result.extraKeys.length > 0) {
						console.error(`   extra ${result.extraKeys.length} keys:`);
						for (const key of result.extraKeys.slice(0, 10)) {
							console.error(`     - ${key}`);
						}
						if (result.extraKeys.length > 10) {
							console.error(`     ... and ${result.extraKeys.length - 10} more`);
						}
					}
				}
			}
		}

		if (hasErrors) {
			console.error(`\n${'='.repeat(80)}`);
			console.error('locale consistency validation failed');
			console.error(`${'='.repeat(80)}`);
			console.error('\nall locale files must have the exact same keys as messages.yaml.');
			console.error('please add the missing keys or remove the extra keys.\n');
			process.exit(1);
		}

		console.log('all locale files are consistent with messages.yaml');
	}

	console.log(`\n${'='.repeat(80)}`);
	console.log('summary');
	console.log(`${'='.repeat(80)}`);

	for (const result of results) {
		console.log(`  ${result.name}: ${result.count} unused keys`);
	}

	console.log(`\ntotal unused keys across all packages: ${totalUnusedKeys}`);

	if (dryRun) {
		console.log('\ndry run complete. run with --apply to prune these keys.');
	} else {
		console.log("\npruning complete. don't forget to regenerate i18n types:");
		console.log('   pnpm i18n:generate');
	}
}

main();
