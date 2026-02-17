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

import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {parseArgs} from 'node:util';
import cassandra from 'cassandra-driver';

const MIGRATION_TABLE = 'schema_migrations';
const MIGRATION_KEYSPACE = process.env['CASSANDRA_KEYSPACE'] ?? 'fluxer';
const MIGRATIONS_DIR = '../fluxer_devops/cassandra/migrations';

interface ForbiddenPattern {
	pattern: RegExp;
	message: string;
}

const FORBIDDEN_PATTERNS: Array<ForbiddenPattern> = [
	{pattern: /\bCREATE\s+INDEX\b/i, message: 'Secondary indexes are forbidden (CREATE INDEX)'},
	{pattern: /\bCREATE\s+CUSTOM\s+INDEX\b/i, message: 'Custom indexes are forbidden (CREATE CUSTOM INDEX)'},
	{
		pattern: /\bCREATE\s+MATERIALIZED\s+VIEW\b/i,
		message: 'Materialized views are forbidden (CREATE MATERIALIZED VIEW)',
	},
	{pattern: /\bDROP\s+TABLE\b/i, message: 'DROP TABLE is forbidden'},
	{pattern: /\bDROP\s+KEYSPACE\b/i, message: 'DROP KEYSPACE is forbidden'},
	{pattern: /\bDROP\s+TYPE\b/i, message: 'DROP TYPE is forbidden'},
	{pattern: /\bDROP\s+INDEX\b/i, message: 'DROP INDEX is forbidden'},
	{pattern: /\bDROP\s+MATERIALIZED\s+VIEW\b/i, message: 'DROP MATERIALIZED VIEW is forbidden'},
	{pattern: /\bDROP\s+COLUMN\b/i, message: 'DROP COLUMN is forbidden (use ALTER TABLE ... DROP ...)'},
	{pattern: /\bTRUNCATE\b/i, message: 'TRUNCATE is forbidden'},
];

function getMigrationsDir(): string {
	return MIGRATIONS_DIR;
}

function getMigrationPath(filename: string): string {
	return path.join(getMigrationsDir(), filename);
}

function sanitizeName(name: string): string {
	let result = name.replace(/ /g, '_').replace(/-/g, '_').toLowerCase();
	result = result
		.split('')
		.filter((c) => /[a-z0-9_]/.test(c))
		.join('');
	while (result.includes('__')) {
		result = result.replace(/__/g, '_');
	}
	return result.replace(/^_+|_+$/g, '');
}

function removeComments(content: string): string {
	return content
		.split('\n')
		.map((line) => {
			const idx = line.indexOf('--');
			return idx !== -1 ? line.slice(0, idx) : line;
		})
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.join('\n');
}

function parseStatements(content: string): Array<string> {
	const statements: Array<string> = [];
	let currentStatement = '';

	for (const line of content.split('\n')) {
		const cleanLine = line.includes('--') ? line.slice(0, line.indexOf('--')) : line;
		const trimmed = cleanLine.trim();

		if (trimmed.length === 0) {
			continue;
		}

		currentStatement += `${trimmed} `;

		if (trimmed.endsWith(';')) {
			const statement = currentStatement.trim();
			if (statement.length > 0) {
				statements.push(statement);
			}
			currentStatement = '';
		}
	}

	if (currentStatement.trim().length > 0) {
		statements.push(currentStatement.trim());
	}

	return statements;
}

function calculateChecksum(content: string): string {
	return crypto.createHash('md5').update(content).digest('hex');
}

function validateMigrationContent(filename: string, content: string): Array<string> {
	const errors: Array<string> = [];
	const cleanContent = removeComments(content);

	for (const forbidden of FORBIDDEN_PATTERNS) {
		if (forbidden.pattern.test(cleanContent)) {
			errors.push(`  ${filename}: ${forbidden.message}`);
		}
	}

	if (cleanContent.trim().length === 0) {
		errors.push(`  ${filename}: migration file is empty`);
	}

	return errors;
}

function getMigrationFiles(): Array<string> {
	const migrationsDir = getMigrationsDir();
	if (!fs.existsSync(migrationsDir)) {
		return [];
	}

	const files = fs.readdirSync(migrationsDir);
	const migrations = files
		.filter((file) => {
			const filePath = path.join(migrationsDir, file);
			return fs.statSync(filePath).isFile() && file.endsWith('.cql');
		})
		.sort();

	return migrations;
}

function hasSkipCi(filename: string): boolean {
	const content = fs.readFileSync(getMigrationPath(filename), 'utf-8');
	const lines = content.split('\n').slice(0, 10);

	for (const line of lines) {
		const lower = line.trim().toLowerCase();
		if (lower.includes('-- skip ci') || lower.includes('--skip ci')) {
			return true;
		}
	}

	return false;
}

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createSession(
	host: string,
	port: number,
	username: string,
	password: string,
): Promise<cassandra.Client> {
	const maxRetries = 5;
	const retryDelay = 10000;

	let lastError: Error | null = null;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		if (attempt > 1) {
			console.log(`Retrying connection (attempt ${attempt}/${maxRetries})...`);
		}

		try {
			const client = new cassandra.Client({
				contactPoints: [`${host}:${port}`],
				localDataCenter: 'dc1',
				credentials: {username, password},
				socketOptions: {connectTimeout: 60000},
			});

			await client.connect();

			return client;
		} catch (e) {
			lastError = e instanceof Error ? e : new Error(String(e));
			console.log(`Connection attempt ${attempt}/${maxRetries} failed: ${lastError.message}`);

			if (attempt < maxRetries) {
				await sleep(retryDelay);
			}
		}
	}

	throw new Error(`Failed to connect to Cassandra after ${maxRetries} attempts: ${lastError?.message}`);
}

async function getAppliedMigrations(session: cassandra.Client): Promise<Map<string, Date>> {
	const applied = new Map<string, Date>();

	const result = await session.execute(`SELECT filename, applied_at FROM ${MIGRATION_KEYSPACE}.${MIGRATION_TABLE}`);

	for (const row of result.rows) {
		const filename = row.filename as string;
		const appliedAt = row.applied_at as Date;
		applied.set(filename, appliedAt);
	}

	return applied;
}

async function applyMigration(session: cassandra.Client, filename: string): Promise<void> {
	console.log(`Applying migration: ${filename}`);

	const content = fs.readFileSync(getMigrationPath(filename), 'utf-8');
	const statements = parseStatements(content);

	if (statements.length === 0) {
		throw new Error('No valid statements found in migration');
	}

	console.log(`  Executing ${statements.length} statement(s)...`);

	for (let i = 0; i < statements.length; i++) {
		console.log(`    [${i + 1}/${statements.length}] Executing...`);
		await session.execute(statements[i]);
	}

	const checksum = calculateChecksum(content);
	await session.execute(
		`INSERT INTO ${MIGRATION_KEYSPACE}.${MIGRATION_TABLE} (filename, applied_at, checksum) VALUES (?, ?, ?)`,
		[filename, new Date(), checksum],
	);

	console.log('  \u2713 Migration applied successfully');
}

async function autoAcknowledgeMigration(session: cassandra.Client, filename: string): Promise<void> {
	const content = fs.readFileSync(getMigrationPath(filename), 'utf-8');
	const checksum = calculateChecksum(content);

	await session.execute(
		`INSERT INTO ${MIGRATION_KEYSPACE}.${MIGRATION_TABLE} (filename, applied_at, checksum) VALUES (?, ?, ?)`,
		[filename, new Date(), checksum],
	);
}

function createMigration(name: string): void {
	const sanitized = sanitizeName(name);
	if (sanitized.length === 0) {
		throw new Error(`Invalid migration name: ${name}`);
	}

	const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
	const filename = `${timestamp}_${sanitized}.cql`;
	const filepath = getMigrationPath(filename);

	if (fs.existsSync(filepath)) {
		throw new Error(`Migration file already exists: ${filename}`);
	}

	fs.writeFileSync(filepath, '');

	console.log(`\u2713 Created migration: ${filename}`);
	console.log(`  Path: ${filepath}`);
}

function checkMigrations(): void {
	const migrations = getMigrationFiles();

	if (migrations.length === 0) {
		console.log('No migration files found');
		return;
	}

	console.log(`Checking ${migrations.length} migration file(s)...\n`);

	const errors: Array<string> = [];
	let validCount = 0;

	for (const migration of migrations) {
		const content = fs.readFileSync(getMigrationPath(migration), 'utf-8');
		const fileErrors = validateMigrationContent(migration, content);

		if (fileErrors.length === 0) {
			validCount++;
			console.log(`\u2713 ${migration}`);
		} else {
			errors.push(...fileErrors);
		}
	}

	if (errors.length > 0) {
		console.log('\nValidation errors:');
		for (const error of errors) {
			console.log(`\u2717 ${error}`);
		}
		throw new Error(`Validation failed with ${errors.length} error(s)`);
	}

	console.log(`\n\u2713 All ${validCount} migration(s) are valid!`);
}

async function runMigrations(host: string, port: number, username: string, password: string): Promise<void> {
	console.log('Starting Cassandra migration process...');
	console.log(`Host: ${host}, Port: ${port}`);

	const session = await createSession(host, port, username, password);

	try {
		const migrations = getMigrationFiles();
		const applied = await getAppliedMigrations(session);

		if (migrations.length === 0) {
			console.log('No migration files found');
			return;
		}

		const pending: Array<string> = [];
		const skipped: Array<string> = [];

		for (const migration of migrations) {
			if (!applied.has(migration)) {
				if (hasSkipCi(migration)) {
					skipped.push(migration);
				} else {
					pending.push(migration);
				}
			}
		}

		if (skipped.length > 0) {
			console.log(`Found ${skipped.length} migration(s) with '-- skip ci' annotation:`);
			for (const migration of skipped) {
				console.log(`  - ${migration}`);
			}
			console.log('\nAuto-acknowledging skipped migrations...');

			for (const migration of skipped) {
				await autoAcknowledgeMigration(session, migration);
				console.log(`  \u2713 Acknowledged: ${migration}`);
			}
			console.log();
		}

		if (pending.length === 0) {
			console.log('\u2713 No pending migrations');
			return;
		}

		console.log(`Found ${pending.length} pending migration(s) to apply:`);
		for (const migration of pending) {
			console.log(`  - ${migration}`);
		}
		console.log();

		const pendingCount = pending.length;
		for (const migration of pending) {
			await applyMigration(session, migration);
		}

		console.log(`\u2713 Successfully applied ${pendingCount} migration(s)`);
	} finally {
		await session.shutdown();
	}
}

async function showStatus(host: string, port: number, username: string, password: string): Promise<void> {
	const session = await createSession(host, port, username, password);

	try {
		const migrations = getMigrationFiles();
		const applied = await getAppliedMigrations(session);

		console.log('Migration Status');
		console.log('================\n');
		console.log(`Total migrations: ${migrations.length}`);
		console.log(`Applied: ${applied.size}`);
		console.log(`Pending: ${migrations.length - applied.size}\n`);

		if (migrations.length > 0) {
			console.log('Migrations:');
			for (const migration of migrations) {
				const status = applied.has(migration) ? '[\u2713]' : '[ ]';
				const suffix = hasSkipCi(migration) ? ' (skip ci)' : '';
				console.log(`  ${status} ${migration}${suffix}`);
			}
		}
	} finally {
		await session.shutdown();
	}
}

async function acknowledgeMigration(
	host: string,
	port: number,
	username: string,
	password: string,
	filename: string,
): Promise<void> {
	const session = await createSession(host, port, username, password);

	try {
		const applied = await getAppliedMigrations(session);
		if (applied.has(filename)) {
			throw new Error(`Migration ${filename} is already applied`);
		}

		const content = fs.readFileSync(getMigrationPath(filename), 'utf-8');
		const checksum = calculateChecksum(content);

		await session.execute(
			`INSERT INTO ${MIGRATION_KEYSPACE}.${MIGRATION_TABLE} (filename, applied_at, checksum) VALUES (?, ?, ?)`,
			[filename, new Date(), checksum],
		);

		console.log(`\u2713 Migration acknowledged: ${filename}`);
	} finally {
		await session.shutdown();
	}
}

async function testConnection(host: string, port: number, username: string, password: string): Promise<void> {
	console.log(`Testing Cassandra connection to ${host}:${port}...`);

	const session = await createSession(host, port, username, password);

	try {
		const result = await session.execute('SELECT release_version FROM system.local');

		if (result.rows.length > 0) {
			const version = result.rows[0].release_version;
			console.log(`\u2713 Connection successful - Cassandra version: ${version}`);
		} else {
			console.log('\u2713 Connection successful');
		}
	} finally {
		await session.shutdown();
	}
}

async function debugConnection(host: string, port: number, username: string, password: string): Promise<void> {
	console.log('=== Cassandra Connection Debug ===');
	console.log(`Host: ${host}:${port}`);
	console.log(`Username: ${username}`);

	console.log('\n[1/3] Testing TCP connectivity...');
	const tcpStart = performance.now();

	try {
		await new Promise<void>((resolve, reject) => {
			const socket = new net.Socket();
			const timeout = setTimeout(() => {
				socket.destroy();
				reject(new Error('TCP connection timed out'));
			}, 5000);

			socket.connect(port, host, () => {
				clearTimeout(timeout);
				socket.destroy();
				resolve();
			});

			socket.on('error', (err) => {
				clearTimeout(timeout);
				reject(err);
			});
		});
		console.log(`  \u2713 TCP connection successful (${((performance.now() - tcpStart) / 1000).toFixed(2)}s)`);
	} catch (e) {
		console.log(`  \u2717 TCP connection failed: ${e instanceof Error ? e.message : String(e)}`);
		throw e;
	}

	console.log('\n[2/3] Creating Cassandra session...');
	const sessionStart = performance.now();

	let session: cassandra.Client;
	try {
		session = await createSession(host, port, username, password);
		console.log(`  \u2713 Session created (${((performance.now() - sessionStart) / 1000).toFixed(2)}s)`);
	} catch (e) {
		console.log(`  \u2717 Session creation failed: ${e instanceof Error ? e.message : String(e)}`);
		throw e;
	}

	try {
		console.log('\n[3/3] Testing queries...');
		const queryStart = performance.now();
		const result = await session.execute('SELECT release_version FROM system.local');

		if (result.rows.length > 0) {
			const version = result.rows[0].release_version;
			console.log(`  \u2713 Cassandra version: ${version} (${((performance.now() - queryStart) / 1000).toFixed(2)}s)`);
		} else {
			console.log(`  \u2713 Query successful (${((performance.now() - queryStart) / 1000).toFixed(2)}s)`);
		}

		console.log('\n\u2713 All debug checks passed');
	} finally {
		await session.shutdown();
	}
}

function printUsage(): void {
	console.log(`cassandra-migrate - Forward-only Cassandra migration tool for Fluxer

A simple, forward-only migration tool for Cassandra.
Migrations are stored in fluxer_devops/cassandra/migrations.
Migration metadata is stored in the 'fluxer' keyspace.

USAGE:
  tsx scripts/CassandraMigrate.tsx <command> [options]

COMMANDS:
  create <name>     Create a new migration file
  check             Validate all migration files
  up                Run pending migrations
  ack <filename>    Acknowledge a failed migration to skip it
  status            Show migration status
  test              Test Cassandra connection
  debug             Debug Cassandra connection
OPTIONS:
  --host <host>         Cassandra host (default: CASSANDRA_HOST env or localhost)
  --port <port>         Cassandra port (default: 9042)
  --username <user>     Cassandra username (default: CASSANDRA_USERNAME env or cassandra)
  --password <pass>     Cassandra password (default: CASSANDRA_PASSWORD env or cassandra)
  --help                Show this help message
`);
}

async function main(): Promise<void> {
	const {values, positionals} = parseArgs({
		allowPositionals: true,
		options: {
			host: {type: 'string', default: process.env['CASSANDRA_HOST'] ?? 'localhost'},
			port: {type: 'string', default: '9042'},
			username: {type: 'string', default: process.env['CASSANDRA_USERNAME'] ?? 'cassandra'},
			password: {type: 'string', default: process.env['CASSANDRA_PASSWORD'] ?? 'cassandra'},
			help: {type: 'boolean', default: false},
		},
	});

	if (values.help || positionals.length === 0) {
		printUsage();
		process.exit(values.help ? 0 : 1);
	}

	const command = positionals[0];
	const host = values.host;
	const port = parseInt(values.port, 10);
	const username = values.username;
	const password = values.password;

	try {
		switch (command) {
			case 'create': {
				const name = positionals[1];
				if (!name) {
					console.error('Error: Migration name is required');
					process.exit(1);
				}
				createMigration(name);
				break;
			}
			case 'check':
				checkMigrations();
				break;
			case 'up':
				await runMigrations(host, port, username, password);
				break;
			case 'ack': {
				const filename = positionals[1];
				if (!filename) {
					console.error('Error: Migration filename is required');
					process.exit(1);
				}
				await acknowledgeMigration(host, port, username, password, filename);
				break;
			}
			case 'status':
				await showStatus(host, port, username, password);
				break;
			case 'test':
				await testConnection(host, port, username, password);
				break;
			case 'debug':
				await debugConnection(host, port, username, password);
				break;
			default:
				console.error(`Unknown command: ${command}`);
				printUsage();
				process.exit(1);
		}
	} catch (e) {
		console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
		process.exit(1);
	}
}

main();
