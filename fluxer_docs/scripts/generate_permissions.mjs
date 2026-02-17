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

import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createFrontmatter, escapeTableText, writeFile} from './shared.mjs';

/**
 * Permission definitions from @fluxer/constants.
 * These are copied here to avoid import issues with ESM/TypeScript in the generator.
 */
const Permissions = {
	CREATE_INSTANT_INVITE: 1n << 0n,
	KICK_MEMBERS: 1n << 1n,
	BAN_MEMBERS: 1n << 2n,
	ADMINISTRATOR: 1n << 3n,
	MANAGE_CHANNELS: 1n << 4n,
	MANAGE_GUILD: 1n << 5n,
	ADD_REACTIONS: 1n << 6n,
	VIEW_AUDIT_LOG: 1n << 7n,
	PRIORITY_SPEAKER: 1n << 8n,
	STREAM: 1n << 9n,
	VIEW_CHANNEL: 1n << 10n,
	SEND_MESSAGES: 1n << 11n,
	SEND_TTS_MESSAGES: 1n << 12n,
	MANAGE_MESSAGES: 1n << 13n,
	EMBED_LINKS: 1n << 14n,
	ATTACH_FILES: 1n << 15n,
	READ_MESSAGE_HISTORY: 1n << 16n,
	MENTION_EVERYONE: 1n << 17n,
	USE_EXTERNAL_EMOJIS: 1n << 18n,
	CONNECT: 1n << 20n,
	SPEAK: 1n << 21n,
	MUTE_MEMBERS: 1n << 22n,
	DEAFEN_MEMBERS: 1n << 23n,
	MOVE_MEMBERS: 1n << 24n,
	USE_VAD: 1n << 25n,
	CHANGE_NICKNAME: 1n << 26n,
	MANAGE_NICKNAMES: 1n << 27n,
	MANAGE_ROLES: 1n << 28n,
	MANAGE_WEBHOOKS: 1n << 29n,
	MANAGE_EXPRESSIONS: 1n << 30n,
	USE_EXTERNAL_STICKERS: 1n << 37n,
	MODERATE_MEMBERS: 1n << 40n,
	CREATE_EXPRESSIONS: 1n << 43n,
	PIN_MESSAGES: 1n << 51n,
	BYPASS_SLOWMODE: 1n << 52n,
	UPDATE_RTC_REGION: 1n << 53n,
};

const PermissionsDescriptions = {
	CREATE_INSTANT_INVITE: 'Allows creation of instant invites',
	KICK_MEMBERS: 'Allows kicking members from the guild',
	BAN_MEMBERS: 'Allows banning members from the guild',
	ADMINISTRATOR: 'Grants all permissions and bypasses channel permission overwrites',
	MANAGE_CHANNELS: 'Allows management and editing of channels',
	MANAGE_GUILD: 'Allows management and editing of the guild',
	ADD_REACTIONS: 'Allows adding reactions to messages',
	VIEW_AUDIT_LOG: 'Allows viewing of the audit log',
	PRIORITY_SPEAKER: 'Allows using priority speaker in a voice channel',
	STREAM: 'Allows the user to go live',
	VIEW_CHANNEL: 'Allows viewing a channel',
	SEND_MESSAGES: 'Allows sending messages in a channel',
	SEND_TTS_MESSAGES: 'Allows sending text-to-speech messages',
	MANAGE_MESSAGES: 'Allows for deleting and pinning messages',
	EMBED_LINKS: 'Links sent will have an embed automatically',
	ATTACH_FILES: 'Allows uploading files',
	READ_MESSAGE_HISTORY: 'Allows reading message history',
	MENTION_EVERYONE: 'Allows using @everyone and @here mentions',
	USE_EXTERNAL_EMOJIS: 'Allows using emojis from other guilds',
	CONNECT: 'Allows connecting to a voice channel',
	SPEAK: 'Allows speaking in a voice channel',
	MUTE_MEMBERS: 'Allows muting members in voice channels',
	DEAFEN_MEMBERS: 'Allows deafening members in voice channels',
	MOVE_MEMBERS: 'Allows moving members between voice channels',
	USE_VAD: 'Allows using voice activity detection',
	CHANGE_NICKNAME: 'Allows changing own nickname',
	MANAGE_NICKNAMES: 'Allows changing other members nicknames',
	MANAGE_ROLES: 'Allows management and editing of roles',
	MANAGE_WEBHOOKS: 'Allows management and editing of webhooks',
	MANAGE_EXPRESSIONS: 'Allows management of guild expressions',
	USE_EXTERNAL_STICKERS: 'Allows using stickers from other guilds',
	MODERATE_MEMBERS: 'Allows timing out users',
	CREATE_EXPRESSIONS: 'Allows creating guild expressions',
	PIN_MESSAGES: 'Allows pinning messages',
	BYPASS_SLOWMODE: 'Allows bypassing slowmode',
	UPDATE_RTC_REGION: 'Allows updating the voice region',
};

/**
 * Convert a bigint permission value to a hex string.
 */
function toHex(value) {
	return `0x${value.toString(16).toUpperCase()}`;
}

/**
 * Render a table of permissions with values and descriptions.
 */
function renderPermissionsTable(permissions, descriptions) {
	let out = '';
	out += '| Permission | Value | Description |\n';
	out += '|------------|-------|-------------|\n';

	for (const [name, value] of Object.entries(permissions)) {
		const description = descriptions[name] ?? '-';
		const hexValue = toHex(value);
		out += `| \`${escapeTableText(name)}\` | \`${escapeTableText(hexValue)}\` | ${escapeTableText(description)} |\n`;
	}

	return out;
}

async function main() {
	const dirname = path.dirname(fileURLToPath(import.meta.url));
	const repoRoot = path.resolve(dirname, '../..');
	const outPath = path.join(repoRoot, 'fluxer_docs/topics/permissions.mdx');

	let out = '';
	out += createFrontmatter({
		title: 'Permissions',
		description: 'Reference for permission bitfields used by Fluxer guilds and channels.',
	});
	out += '\n\n';

	out += 'Permissions in Fluxer are stored as a bitfield, represented as a string containing the permission integer. ';
	out += 'Each permission is a bit position that can be set or unset. ';
	out +=
		"To check if a user has a permission, perform a bitwise AND operation between the user's permission value and the permission flag.\n\n";

	out += '## Permission flags\n\n';
	out += 'The following table lists all available permission flags, their values, and descriptions.\n\n';
	out += renderPermissionsTable(Permissions, PermissionsDescriptions);

	await writeFile(outPath, out);

	const permissionCount = Object.keys(Permissions).length;
	console.log('Generated permissions documentation:');
	console.log(`  - ${outPath}`);
	console.log(`  - ${permissionCount} permissions`);
}

await main();
