#!/usr/bin/env tsx

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

import {execFileSync} from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {OpenAPIGenerator} from '@fluxer/openapi/src/OpenAPIGenerator';
import {printValidationResult, validateSpec} from '@fluxer/openapi/src/output/SpecValidator';
import {getDefaultOutputPath, readSpec, writeSpec} from '@fluxer/openapi/src/output/SpecWriter';

function parseArgs(): {validateOnly: boolean; outputPath: string | null} {
	const args = process.argv.slice(2);
	let validateOnly = false;
	let outputPath: string | null = null;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === '--validate-only' || arg === '-v') {
			validateOnly = true;
		} else if (arg === '--output' || arg === '-o') {
			outputPath = args[++i];
		}
	}

	return {validateOnly, outputPath};
}

function findRepositoryRoot(): string {
	let dir = process.cwd();
	while (dir !== '/') {
		const workspacePath = path.join(dir, 'pnpm-workspace.yaml');
		if (fs.existsSync(workspacePath)) {
			return dir;
		}
		dir = path.dirname(dir);
	}
	throw new Error('Could not find repository root (no pnpm-workspace.yaml found)');
}

async function main(): Promise<void> {
	const {validateOnly, outputPath: customOutputPath} = parseArgs();

	const basePath = findRepositoryRoot();
	const outputPath = customOutputPath ?? getDefaultOutputPath(basePath);

	console.log('Fluxer OpenAPI Specification Generator');
	console.log('======================================');
	console.log(`Base path: ${basePath}`);
	console.log(`Output path: ${outputPath}`);
	console.log('');

	if (validateOnly) {
		console.log('Running validation only...');
		try {
			const spec = readSpec(outputPath);
			const result = validateSpec(spec);
			printValidationResult(result);
			process.exit(result.valid ? 0 : 1);
		} catch (error) {
			console.error('Failed to read spec file:', error);
			process.exit(1);
		}
	}

	try {
		const generator = new OpenAPIGenerator({
			basePath,
			title: 'Fluxer API',
			version: '1.0.0',
			description:
				'API for Fluxer, a free and open source instant messaging and VoIP platform built for friends, groups, and communities.',
			serverUrl: 'https://api.fluxer.app/v1',
		});

		const spec = await generator.generate();

		console.log('');
		console.log('Validating specification...');
		const validationResult = validateSpec(spec);
		printValidationResult(validationResult);

		if (!validationResult.valid) {
			console.error('');
			console.error('Specification has validation errors. Continuing anyway...');
		}

		console.log('');
		console.log(`Writing specification to ${outputPath}...`);
		writeSpec(spec, outputPath);

		console.log('');
		console.log('Generating resource overview page...');
		runResourceOverviewGenerator(basePath);

		const pathCount = Object.keys(spec.paths).length;
		let operationCount = 0;
		for (const pathItem of Object.values(spec.paths)) {
			operationCount += Object.keys(pathItem).length;
		}
		const schemaCount = Object.keys(spec.components.schemas).length;

		console.log('');
		console.log('Summary');
		console.log('-------');
		console.log(`Paths: ${pathCount}`);
		console.log(`Operations: ${operationCount}`);
		console.log(`Schemas: ${schemaCount}`);
		console.log('');
		console.log('OpenAPI specification generated successfully.');
	} catch (error) {
		console.error('Failed to generate specification:', error);
		process.exit(1);
	}
}

function runResourceOverviewGenerator(basePath: string): void {
	const scriptPath = path.join(basePath, 'fluxer_docs/scripts/generate_resources.mjs');
	execFileSync('node', [scriptPath], {stdio: 'inherit'});
}

main().catch((error) => {
	console.error('Unhandled error:', error);
	process.exit(1);
});
