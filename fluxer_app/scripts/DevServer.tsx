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

import {type ChildProcess, spawn} from 'node:child_process';
import type {Dirent} from 'node:fs';
import {mkdir, readdir, readFile, rm, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');

const metadataFile = path.join(projectRoot, '.devserver-cache.json');
const binDir = path.join(projectRoot, 'node_modules', '.bin');
const rspackBin = path.join(binDir, 'rspack');
const tcmBin = path.join(binDir, 'tcm');
const DEFAULT_SKIP_DIRS = new Set(['.git', 'node_modules', '.turbo', 'dist', 'target', 'pkg', 'pkgs']);
let metadataCache: Metadata | null = null;

interface StepMetadata {
	lastRun: number;
	inputs: Record<string, number>;
}

interface Metadata {
	[key: string]: StepMetadata;
}

type StepKey = 'wasm' | 'colors' | 'masks' | 'cssTypes' | 'lingui';

async function loadMetadata(): Promise<void> {
	if (metadataCache !== null) {
		return;
	}

	try {
		const raw = await readFile(metadataFile, 'utf8');
		const parsed = JSON.parse(raw);
		metadataCache = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Metadata;
	} catch (error) {
		if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
			metadataCache = {};
			return;
		}
		console.warn('Failed to read dev server metadata cache, falling back to full rebuild:', error);
		metadataCache = {};
	}
}

async function saveMetadata(): Promise<void> {
	if (!metadataCache) {
		return;
	}

	await mkdir(path.dirname(metadataFile), {recursive: true});
	await writeFile(metadataFile, JSON.stringify(metadataCache, null, 2), 'utf8');
}

function haveInputsChanged(prev: Record<string, number>, next: Record<string, number>): boolean {
	const prevKeys = Object.keys(prev);
	const nextKeys = Object.keys(next);
	if (prevKeys.length !== nextKeys.length) {
		return true;
	}

	for (const key of nextKeys) {
		if (!Object.hasOwn(prev, key) || prev[key] !== next[key]) {
			return true;
		}
	}

	return false;
}

function shouldRunStep(stepName: StepKey, inputs: Record<string, number>): boolean {
	if (!metadataCache) {
		return true;
	}

	const entry = metadataCache[stepName];
	if (!entry) {
		return true;
	}

	return haveInputsChanged(entry.inputs, inputs);
}

async function collectFileStats(paths: ReadonlyArray<string>): Promise<Record<string, number>> {
	const result: Record<string, number> = {};
	for (const relPath of paths) {
		const absolutePath = path.join(projectRoot, relPath);
		const fileStat = await stat(absolutePath);
		if (!fileStat.isFile()) {
			throw new Error(`Expected ${relPath} to be a file when collecting dev server cache inputs.`);
		}
		result[relPath] = fileStat.mtimeMs;
	}
	return result;
}

async function collectDirectoryStats(
	rootRel: string,
	predicate: (relPath: string) => boolean,
): Promise<Record<string, number>> {
	const accumulator: Record<string, number> = {};

	async function walk(relPath: string): Promise<void> {
		const absoluteDir = path.join(projectRoot, relPath);
		let entries: Array<Dirent>;
		try {
			entries = await readdir(absoluteDir, {withFileTypes: true});
		} catch (error) {
			if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
				return;
			}
			throw error;
		}

		for (const entry of entries) {
			if (entry.isDirectory()) {
				if (DEFAULT_SKIP_DIRS.has(entry.name)) {
					continue;
				}
				await walk(path.join(relPath, entry.name));
				continue;
			}

			if (!entry.isFile()) {
				continue;
			}

			const fileRel = path.join(relPath, entry.name);
			if (!predicate(fileRel)) {
				continue;
			}

			const fileStat = await stat(path.join(projectRoot, fileRel));
			accumulator[fileRel] = fileStat.mtimeMs;
		}
	}

	await walk(rootRel);
	return accumulator;
}

async function runCachedStep(
	stepName: StepKey,
	gatherInputs: () => Promise<Record<string, number>>,
	command: string,
	args: ReadonlyArray<string>,
): Promise<void> {
	const inputs = await gatherInputs();
	if (!shouldRunStep(stepName, inputs)) {
		console.log(`Skipping ${command} ${args.join(' ')} (no changes detected)`);
		return;
	}

	await runCommand(command, args);

	metadataCache ??= {};
	metadataCache[stepName] = {lastRun: Date.now(), inputs};
	await saveMetadata();
}

async function gatherWasmInputs(): Promise<Record<string, number>> {
	return collectDirectoryStats(path.join('crates', 'libfluxcore'), () => true);
}

async function gatherColorInputs(): Promise<Record<string, number>> {
	return collectFileStats(['scripts/GenerateColorSystem.tsx']);
}

async function gatherMaskInputs(): Promise<Record<string, number>> {
	return collectFileStats(['scripts/GenerateAvatarMasks.tsx', 'src/components/uikit/TypingConstants.tsx']);
}

async function gatherCssModuleInputs(): Promise<Record<string, number>> {
	return collectDirectoryStats('src', (relPath) => relPath.endsWith('.module.css'));
}

async function gatherLinguiInputs(): Promise<Record<string, number>> {
	return collectDirectoryStats(path.join('src', 'locales'), (relPath) => relPath.endsWith('.po'));
}

let currentChild: ChildProcess | null = null;
let cssTypeWatcher: ChildProcess | null = null;
let shuttingDown = false;

const shutdownSignals: ReadonlyArray<NodeJS.Signals> = ['SIGINT', 'SIGTERM'];

function handleShutdown(signal: NodeJS.Signals): void {
	if (shuttingDown) {
		return;
	}
	shuttingDown = true;
	console.log(`\nReceived ${signal}, shutting down fluxer app dev server...`);
	currentChild?.kill('SIGTERM');
	cssTypeWatcher?.kill('SIGTERM');
}

shutdownSignals.forEach((signal) => {
	process.on(signal, () => handleShutdown(signal));
});

function runCommand(command: string, args: ReadonlyArray<string>): Promise<void> {
	return new Promise((resolve, reject) => {
		if (shuttingDown) {
			resolve();
			return;
		}

		const child = spawn(command, args, {
			cwd: projectRoot,
			stdio: 'inherit',
		});

		currentChild = child;

		child.once('error', (error) => {
			currentChild = null;
			reject(error);
		});

		child.once('exit', (code, signal) => {
			currentChild = null;

			if (shuttingDown) {
				resolve();
				return;
			}

			if (signal) {
				reject(new Error(`${command} ${args.join(' ')} terminated by signal ${signal}`));
				return;
			}

			if (code && code !== 0) {
				reject(new Error(`${command} ${args.join(' ')} exited with status ${code}`));
				return;
			}

			resolve();
		});
	});
}

async function cleanDist(): Promise<void> {
	if (shuttingDown) {
		return;
	}

	const distPath = path.join(projectRoot, 'dist');
	await rm(distPath, {recursive: true, force: true});
}

function startCssTypeWatcher(): void {
	if (shuttingDown) {
		return;
	}

	const child = spawn(tcmBin, ['src', '--pattern', '**/*.module.css', '--watch', '--silent'], {
		cwd: projectRoot,
		stdio: 'inherit',
	});

	cssTypeWatcher = child;

	child.once('error', (error) => {
		if (!shuttingDown) {
			console.error('CSS type watcher error:', error);
		}
		cssTypeWatcher = null;
	});

	child.once('exit', (code, signal) => {
		cssTypeWatcher = null;
		if (!shuttingDown && code !== 0) {
			console.error(`CSS type watcher exited unexpectedly (code: ${code}, signal: ${signal})`);
		}
	});
}

function runRspack(): Promise<number> {
	return new Promise((resolve, reject) => {
		if (shuttingDown) {
			resolve(0);
			return;
		}

		const child = spawn(rspackBin, ['serve', '--mode', 'development'], {
			cwd: projectRoot,
			stdio: 'inherit',
		});

		currentChild = child;

		child.once('error', (error) => {
			currentChild = null;
			reject(error);
		});

		child.once('exit', (code, signal) => {
			currentChild = null;

			if (shuttingDown) {
				resolve(0);
				return;
			}

			if (signal) {
				reject(new Error(`rspack serve terminated by signal ${signal}`));
				return;
			}

			resolve(code ?? 0);
		});
	});
}

async function main(): Promise<void> {
	await loadMetadata();

	try {
		await runCachedStep('wasm', gatherWasmInputs, 'pnpm', ['wasm:codegen']);
		await runCachedStep('colors', gatherColorInputs, 'pnpm', ['generate:colors']);
		await runCachedStep('masks', gatherMaskInputs, 'pnpm', ['generate:masks']);
		await runCachedStep('cssTypes', gatherCssModuleInputs, 'pnpm', ['generate:css-types']);
		await runCachedStep('lingui', gatherLinguiInputs, 'pnpm', ['lingui:compile']);
		await cleanDist();

		startCssTypeWatcher();

		const rspackExitCode = await runRspack();

		if (!shuttingDown && rspackExitCode !== 0) {
			process.exit(rspackExitCode);
		}
	} catch (error) {
		if (shuttingDown) {
			process.exit(0);
		}

		console.error(error);
		process.exit(1);
	}
}

void main();
