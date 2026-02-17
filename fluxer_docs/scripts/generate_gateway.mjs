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

import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createFrontmatter, escapeTableText, readJsonFile, writeFile} from './shared.mjs';

/**
 * Schema name to resource page mapping.
 * Used to link schema references to their documentation pages.
 */
const SCHEMA_TO_RESOURCE = {
	UserPartialResponse: 'users',
	UserPrivateResponse: 'users',
	UserResponse: 'users',
	UserSettingsResponse: 'users',
	UserGuildSettingsResponse: 'users',
	RelationshipResponse: 'users',
	GuildResponse: 'guilds',
	GuildPartialResponse: 'guilds',
	GuildMemberResponse: 'guilds',
	GuildRoleResponse: 'guilds',
	GuildEmojiResponse: 'guilds',
	GuildStickerResponse: 'packs',
	ChannelResponse: 'channels',
	ChannelPartialResponse: 'channels',
	MessageResponse: 'channels',
	FavoriteMemeResponse: 'saved_media',
	InviteResponse: 'invites',
	WebhookResponse: 'webhooks',
};

/**
 * Gateway-specific schemas that are documented in the events page.
 */
const GATEWAY_LOCAL_SCHEMAS = new Set([
	'VoiceStateResponse',
	'PresenceResponse',
	'SessionResponse',
	'ReadStateResponse',
	'GuildReadyResponse',
	'CustomStatusResponse',
]);

/**
 * Gateway opcodes with descriptions and client action (send/receive).
 * These are defined in @fluxer/constants/src/GatewayConstants.tsx
 */
const GatewayOpcodes = [
	{code: 0, name: 'DISPATCH', description: 'Dispatches an event to the client', action: 'Receive'},
	{code: 1, name: 'HEARTBEAT', description: 'Fired periodically to keep the connection alive', action: 'Send/Receive'},
	{code: 2, name: 'IDENTIFY', description: 'Starts a new session during the initial handshake', action: 'Send'},
	{code: 3, name: 'PRESENCE_UPDATE', description: 'Updates the client presence', action: 'Send'},
	{
		code: 4,
		name: 'VOICE_STATE_UPDATE',
		description: 'Joins, moves, or disconnects from a voice channel',
		action: 'Send',
	},
	{code: 5, name: 'VOICE_SERVER_PING', description: 'Pings the voice server', action: 'Send'},
	{code: 6, name: 'RESUME', description: 'Resumes a previous session after a disconnect', action: 'Send'},
	{code: 7, name: 'RECONNECT', description: 'Indicates the client should reconnect to the gateway', action: 'Receive'},
	{code: 8, name: 'REQUEST_GUILD_MEMBERS', description: 'Requests members for a guild', action: 'Send'},
	{
		code: 9,
		name: 'INVALID_SESSION',
		description: 'Session has been invalidated; client should reconnect and identify',
		action: 'Receive',
	},
	{
		code: 10,
		name: 'HELLO',
		description: 'Sent immediately after connecting; contains heartbeat interval',
		action: 'Receive',
	},
	{code: 11, name: 'HEARTBEAT_ACK', description: 'Acknowledgement of a heartbeat', action: 'Receive'},
	{
		code: 12,
		name: 'GATEWAY_ERROR',
		description: 'Indicates an error occurred while processing a gateway message',
		action: 'Receive',
	},
	{code: 14, name: 'LAZY_REQUEST', description: 'Requests lazy-loaded guild data', action: 'Send'},
];

/**
 * Gateway close codes with descriptions and whether clients should reconnect.
 * These are defined in @fluxer/constants/src/GatewayConstants.tsx
 */
const GatewayCloseCodes = [
	{code: 4000, name: 'UNKNOWN_ERROR', description: 'Unknown error occurred', reconnect: true},
	{code: 4001, name: 'UNKNOWN_OPCODE', description: 'Sent an invalid gateway opcode', reconnect: true},
	{code: 4002, name: 'DECODE_ERROR', description: 'Sent an invalid payload', reconnect: true},
	{code: 4003, name: 'NOT_AUTHENTICATED', description: 'Sent a payload before identifying', reconnect: true},
	{code: 4004, name: 'AUTHENTICATION_FAILED', description: 'Account token is invalid', reconnect: false},
	{code: 4005, name: 'ALREADY_AUTHENTICATED', description: 'Sent more than one identify payload', reconnect: true},
	{code: 4007, name: 'INVALID_SEQ', description: 'Sent an invalid sequence when resuming', reconnect: true},
	{code: 4008, name: 'RATE_LIMITED', description: 'Sending payloads too quickly', reconnect: true},
	{
		code: 4009,
		name: 'SESSION_TIMEOUT',
		description: 'Session timed out; reconnect and start a new one',
		reconnect: true,
	},
	{code: 4010, name: 'INVALID_SHARD', description: 'Sent an invalid shard when identifying', reconnect: false},
	{
		code: 4011,
		name: 'SHARDING_REQUIRED',
		description: 'Session would have handled too many guilds; sharding is required',
		reconnect: false,
	},
	{code: 4012, name: 'INVALID_API_VERSION', description: 'Sent an invalid gateway version', reconnect: false},
];

/**
 * Event categories for grouping in documentation.
 */
const EventCategories = [
	{
		name: 'Session',
		events: ['READY', 'RESUMED', 'SESSIONS_REPLACE'],
	},
	{
		name: 'User',
		events: [
			'USER_UPDATE',
			'USER_PINNED_DMS_UPDATE',
			'USER_SETTINGS_UPDATE',
			'USER_GUILD_SETTINGS_UPDATE',
			'USER_NOTE_UPDATE',
		],
	},
	{
		name: 'User content',
		events: ['RECENT_MENTION_DELETE', 'SAVED_MESSAGE_CREATE', 'SAVED_MESSAGE_DELETE'],
	},
	{
		name: 'Favourite memes',
		events: ['FAVORITE_MEME_CREATE', 'FAVORITE_MEME_UPDATE', 'FAVORITE_MEME_DELETE'],
	},
	{
		name: 'Authentication',
		events: ['AUTH_SESSION_CHANGE'],
	},
	{
		name: 'Presence',
		events: ['PRESENCE_UPDATE'],
	},
	{
		name: 'Guild',
		events: ['GUILD_CREATE', 'GUILD_UPDATE', 'GUILD_DELETE'],
	},
	{
		name: 'Guild members',
		events: ['GUILD_MEMBER_ADD', 'GUILD_MEMBER_UPDATE', 'GUILD_MEMBER_REMOVE'],
	},
	{
		name: 'Guild roles',
		events: ['GUILD_ROLE_CREATE', 'GUILD_ROLE_UPDATE', 'GUILD_ROLE_UPDATE_BULK', 'GUILD_ROLE_DELETE'],
	},
	{
		name: 'Guild content',
		events: ['GUILD_EMOJIS_UPDATE', 'GUILD_STICKERS_UPDATE'],
	},
	{
		name: 'Guild moderation',
		events: ['GUILD_BAN_ADD', 'GUILD_BAN_REMOVE'],
	},
	{
		name: 'Channel',
		events: [
			'CHANNEL_CREATE',
			'CHANNEL_UPDATE',
			'CHANNEL_UPDATE_BULK',
			'CHANNEL_DELETE',
			'CHANNEL_PINS_UPDATE',
			'CHANNEL_PINS_ACK',
		],
	},
	{
		name: 'Group DM',
		events: ['CHANNEL_RECIPIENT_ADD', 'CHANNEL_RECIPIENT_REMOVE'],
	},
	{
		name: 'Message',
		events: ['MESSAGE_CREATE', 'MESSAGE_UPDATE', 'MESSAGE_DELETE', 'MESSAGE_DELETE_BULK'],
	},
	{
		name: 'Message reactions',
		events: [
			'MESSAGE_REACTION_ADD',
			'MESSAGE_REACTION_REMOVE',
			'MESSAGE_REACTION_REMOVE_ALL',
			'MESSAGE_REACTION_REMOVE_EMOJI',
		],
	},
	{
		name: 'Read state',
		events: ['MESSAGE_ACK'],
	},
	{
		name: 'Typing',
		events: ['TYPING_START'],
	},
	{
		name: 'Webhooks',
		events: ['WEBHOOKS_UPDATE'],
	},
	{
		name: 'Invites',
		events: ['INVITE_CREATE', 'INVITE_DELETE'],
	},
	{
		name: 'Relationships',
		events: ['RELATIONSHIP_ADD', 'RELATIONSHIP_UPDATE', 'RELATIONSHIP_REMOVE'],
	},
	{
		name: 'Voice',
		events: ['VOICE_STATE_UPDATE', 'VOICE_SERVER_UPDATE'],
	},
	{
		name: 'Calls',
		events: ['CALL_CREATE', 'CALL_UPDATE', 'CALL_DELETE'],
	},
];

/**
 * Normalise a path by replacing all parameter placeholders with a generic marker.
 * This allows matching paths regardless of parameter names.
 * @param {string} path - The path to normalise (e.g., "/users/@me/notes/:user_id" or "/users/@me/notes/{target_id}")
 * @returns {string} Normalised path with all params replaced by "{_}"
 */
function normalisePathPattern(path) {
	return path.replace(/:\w+/g, '{_}').replace(/\{[^}]+\}/g, '{_}');
}

/**
 * Slugify a string for URL use.
 * @param {string} str - The string to slugify.
 * @returns {string} URL-safe slug.
 */
function slugify(str) {
	return str
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.trim();
}

/**
 * Build a map from endpoint strings to API reference URLs.
 * Mintlify generates URLs from summary (slugified), not operationId.
 * @param {object} openapi - The OpenAPI specification object.
 * @returns {{exact: Map<string, string>, pattern: Map<string, string>}} Maps for exact and pattern-based lookup.
 */
function buildEndpointMap(openapi) {
	const exact = new Map();
	const pattern = new Map();

	for (const [pathTemplate, methods] of Object.entries(openapi.paths || {})) {
		for (const [method, operation] of Object.entries(methods)) {
			if (method === 'parameters') continue;

			const summary = operation.summary;
			const tags = operation.tags || ['General'];
			const primaryTag = tags[0];

			if (summary && primaryTag) {
				const tagSlug = slugify(primaryTag);
				const summarySlug = slugify(summary);
				const url = `/api-reference/${tagSlug}/${summarySlug}`;

				const normMethod = method.toUpperCase();

				const key = `${normMethod} ${pathTemplate}`;
				exact.set(key, url);

				const colonPath = pathTemplate.replace(/\{(\w+)\}/g, ':$1');
				if (colonPath !== pathTemplate) {
					exact.set(`${normMethod} ${colonPath}`, url);
				}

				const patternKey = `${normMethod} ${normalisePathPattern(pathTemplate)}`;
				if (!pattern.has(patternKey)) {
					pattern.set(patternKey, url);
				}
			}
		}
	}

	return {exact, pattern};
}

/**
 * Convert an endpoint string to an API reference link.
 * @param {string} endpoint - The endpoint string (e.g., "POST /users/@me/memes" or "POST /invites/:code (group DM invites)")
 * @param {{exact: Map<string, string>, pattern: Map<string, string>}} endpointMap - Maps for exact and pattern-based lookup.
 * @returns {string} Markdown link or plain code if no match found.
 */
function endpointToLink(endpoint, endpointMap) {
	const parenMatch = endpoint.match(/^(.+?)\s*\((.+)\)$/);
	const cleanEndpoint = parenMatch ? parenMatch[1].trim() : endpoint;
	const description = parenMatch ? parenMatch[2] : null;

	let url = endpointMap.exact.get(cleanEndpoint);

	if (!url) {
		const normalised = cleanEndpoint.replace(/:(\w+)/g, '{$1}');
		url = endpointMap.exact.get(normalised);
	}

	if (!url) {
		const [method, ...pathParts] = cleanEndpoint.split(' ');
		const path = pathParts.join(' ');
		const patternKey = `${method} ${normalisePathPattern(path)}`;
		url = endpointMap.pattern.get(patternKey);
	}

	if (url) {
		const link = `[\`${cleanEndpoint}\`](${url})`;
		return description ? `${link} (${description})` : link;
	}

	return `\`${endpoint}\``;
}

/**
 * Load all event schemas from the schemas/events directory.
 */
async function loadEventSchemas(schemasDir) {
	const schemas = new Map();
	try {
		const files = await fs.readdir(schemasDir);
		for (const file of files) {
			if (file.endsWith('.json')) {
				const filePath = path.join(schemasDir, file);
				const content = await fs.readFile(filePath, 'utf-8');
				const schema = JSON.parse(content);
				schemas.set(schema.name, schema);
			}
		}
	} catch {
		console.warn(`Warning: Could not load event schemas from ${schemasDir}`);
	}
	return schemas;
}

/**
 * Get the resource page URL for a schema name.
 */
function getSchemaLink(schemaName) {
	if (GATEWAY_LOCAL_SCHEMAS.has(schemaName)) {
		return `#${schemaName.toLowerCase()}`;
	}

	const resource = SCHEMA_TO_RESOURCE[schemaName];
	if (resource) {
		return `/resources/${resource}#${schemaName.toLowerCase()}`;
	}
	const baseName = schemaName
		.replace(/Response$/, '')
		.replace(/Request$/, '')
		.toLowerCase();
	return `/resources/${baseName}`;
}

/**
 * Format a type reference for display.
 */
function formatTypeRef(typeInfo) {
	if (!typeInfo) return 'unknown';

	if (typeInfo.$ref) {
		const refName = typeInfo.$ref;
		const link = getSchemaLink(refName);
		return `[${refName}](${link})`;
	}

	if (Array.isArray(typeInfo.type)) {
		const nonNullTypes = typeInfo.type.filter((t) => t !== 'null');
		const hasNull = typeInfo.type.includes('null');
		if (nonNullTypes.length === 1 && hasNull) {
			return `?${nonNullTypes[0]}`;
		}
		return typeInfo.type.map((t) => (t === 'null' ? 'null' : t)).join(' \\| ');
	}

	if (typeInfo.type === 'array') {
		if (typeInfo.items?.$ref) {
			const refName = typeInfo.items.$ref;
			const link = getSchemaLink(refName);
			return `[${refName}](${link})[]`;
		}
		if (typeInfo.items?.type) {
			return `${typeInfo.items.type}[]`;
		}
		return 'array';
	}

	if (typeInfo.type === 'object' && typeInfo.properties) {
		return 'object';
	}

	return typeInfo.type || 'unknown';
}

/**
 * Render scope badge.
 */
function renderScopeBadge(scope) {
	const badges = {
		session: '`session`',
		presence: '`presence`',
		guild: '`guild`',
		channel: '`channel`',
	};
	return badges[scope] || `\`${scope}\``;
}

/**
 * Render payload fields table.
 */
function renderPayloadTable(payload, required = []) {
	if (!payload || !payload.properties) {
		if (payload?.$ref) {
			const link = getSchemaLink(payload.$ref);
			return `See [${payload.$ref}](${link}) for payload structure.\n`;
		}
		if (payload?.type === 'array') {
			return `Payload is an ${formatTypeRef(payload)}.\n`;
		}
		if (payload?.description && Object.keys(payload).length <= 2) {
			return `${payload.description}\n`;
		}
		return '';
	}

	let out = '';
	out += '| Field | Type | Description |\n';
	out += '|-------|------|-------------|\n';

	const requiredSet = new Set(required);

	for (const [fieldName, fieldInfo] of Object.entries(payload.properties)) {
		const isRequired = requiredSet.has(fieldName);
		const displayName = isRequired ? fieldName : `${fieldName}?`;
		const typeStr = formatTypeRef(fieldInfo);
		const description = escapeTableText(fieldInfo.description || '');

		out += `| ${displayName} | ${typeStr} | ${description} |\n`;
	}

	return out;
}

/**
 * Render dispatched by section.
 * @param {string[]} dispatchedBy - Array of endpoint strings or 'gateway'.
 * @param {Map<string, string>} endpointMap - Map from endpoints to API reference URLs.
 */
function renderDispatchedBy(dispatchedBy, endpointMap) {
	if (!dispatchedBy || dispatchedBy.length === 0) return '';

	const endpoints = dispatchedBy.filter((d) => d !== 'gateway');
	const isGatewayOnly = dispatchedBy.includes('gateway') && endpoints.length === 0;

	if (isGatewayOnly) {
		return '**Dispatched by:** Gateway (internal)\n\n';
	}

	if (endpoints.length === 0) return '';

	let out = '**Dispatched by:**\n';
	for (const endpoint of endpoints) {
		const link = endpointToLink(endpoint, endpointMap);
		out += `- ${link}\n`;
	}
	if (dispatchedBy.includes('gateway')) {
		out += '- Gateway (internal)\n';
	}
	out += '\n';
	return out;
}

/**
 * Render a single event section.
 * @param {object} schema - The event schema object.
 * @param {Map<string, string>} endpointMap - Map from endpoints to API reference URLs.
 */
function renderEventSection(schema, endpointMap) {
	let out = '';

	out += `### \`${schema.name}\`\n\n`;
	out += `${schema.description}\n\n`;

	out += `**Scope:** ${renderScopeBadge(schema.scope)}`;
	if (schema.scopeNote) {
		out += ` – ${schema.scopeNote}`;
	}
	out += '\n\n';

	out += renderDispatchedBy(schema.dispatchedBy, endpointMap);

	if (schema.note) {
		out += `<Note>${schema.note}</Note>\n\n`;
	}

	out += '**Payload:**\n\n';
	const payloadTable = renderPayloadTable(schema.payload, schema.payload?.required || []);
	if (payloadTable) {
		out += payloadTable;
	} else {
		out += 'Empty payload.\n';
	}
	out += '\n';

	if (schema.payload?.additionalProperties) {
		out += '**Additional fields:**\n\n';
		out += renderPayloadTable(
			{properties: schema.payload.additionalProperties},
			Object.keys(schema.payload.additionalProperties),
		);
		out += '\n';
	}

	return out;
}

/**
 * Render opcodes table.
 */
function renderOpcodesTable(opcodes) {
	let out = '';
	out += '| Opcode | Name | Description | Client Action |\n';
	out += '|--------|------|-------------|---------------|\n';

	for (const {code, name, description, action} of opcodes) {
		out += `| \`${code}\` | \`${escapeTableText(name)}\` | ${escapeTableText(description)} | ${escapeTableText(action)} |\n`;
	}

	return out;
}

/**
 * Render close codes table.
 */
function renderCloseCodesTable(closeCodes) {
	let out = '';
	out += '| Code | Name | Description | Reconnect |\n';
	out += '|------|------|-------------|----------|\n';

	for (const {code, name, description, reconnect} of closeCodes) {
		out += `| \`${code}\` | \`${escapeTableText(name)}\` | ${escapeTableText(description)} | ${reconnect ? 'Yes' : 'No'} |\n`;
	}

	return out;
}

/**
 * Render events quick reference table.
 */
function renderEventsQuickReferenceTable(schemas) {
	let out = '';
	out += '| Event | Scope | Description |\n';
	out += '|-------|-------|-------------|\n';

	for (const category of EventCategories) {
		for (const eventName of category.events) {
			const schema = schemas.get(eventName);
			if (schema) {
				const anchor = eventName.toLowerCase().replace(/_/g, '-');
				out += `| [\`${eventName}\`](#${anchor}) | ${renderScopeBadge(schema.scope)} | ${escapeTableText(schema.description)} |\n`;
			}
		}
	}

	return out;
}

async function main() {
	const dirname = path.dirname(fileURLToPath(import.meta.url));
	const repoRoot = path.resolve(dirname, '../..');
	const gatewayDir = path.join(repoRoot, 'fluxer_docs/gateway');
	const schemasDir = path.join(repoRoot, 'fluxer_docs/schemas/events');
	const openapiPath = path.join(repoRoot, 'fluxer_docs/api-reference/openapi.json');

	const openapi = await readJsonFile(openapiPath);
	const endpointMap = buildEndpointMap(openapi);
	console.log(
		`Built endpoint map with ${endpointMap.exact.size} exact and ${endpointMap.pattern.size} pattern entries`,
	);

	const eventSchemas = await loadEventSchemas(schemasDir);
	console.log(`Loaded ${eventSchemas.size} event schemas`);

	let opcodesContent = '';
	opcodesContent += createFrontmatter({
		title: 'Opcodes',
		description: 'Gateway opcodes used for communication between client and server.',
	});
	opcodesContent += '\n\n';
	opcodesContent +=
		'Gateway opcodes indicate the type of payload being sent or received. Clients send and receive different opcodes depending on their role in the connection lifecycle.\n\n';
	opcodesContent += '## Opcode reference\n\n';
	opcodesContent += renderOpcodesTable(GatewayOpcodes);

	const opcodesPath = path.join(gatewayDir, 'opcodes.mdx');
	await writeFile(opcodesPath, opcodesContent);

	let closeCodesContent = '';
	closeCodesContent += createFrontmatter({
		title: 'Close codes',
		description: 'WebSocket close codes used by the Fluxer gateway.',
	});
	closeCodesContent += '\n\n';
	closeCodesContent +=
		'When the gateway closes a connection, it sends a close code indicating why. Some close codes are recoverable (the client should reconnect), while others are not.\n\n';
	closeCodesContent += '## Close code reference\n\n';
	closeCodesContent += renderCloseCodesTable(GatewayCloseCodes);

	const closeCodesPath = path.join(gatewayDir, 'close_codes.mdx');
	await writeFile(closeCodesPath, closeCodesContent);

	let eventsContent = '';
	eventsContent += createFrontmatter({
		title: 'Events',
		description: 'Gateway dispatch events sent by the Fluxer gateway.',
	});
	eventsContent += '\n\n';
	eventsContent +=
		'Dispatch events are sent by the gateway to notify the client of state changes. These events are sent with opcode `0` (DISPATCH) and include an event name and associated data.\n\n';

	eventsContent += '## Event scopes\n\n';
	eventsContent += 'Events are delivered based on their scope:\n\n';
	eventsContent += '| Scope | Description |\n';
	eventsContent += '|-------|-------------|\n';
	eventsContent += '| `session` | Sent only to the current session |\n';
	eventsContent += '| `presence` | Sent to all sessions of the current user |\n';
	eventsContent += '| `guild` | Sent to all users in a guild who have permission to receive it |\n';
	eventsContent +=
		'| `channel` | Sent based on channel type (guild channels use guild scope, DMs use presence scope) |\n';
	eventsContent += '\n';

	eventsContent += '## Event reference\n\n';
	eventsContent += renderEventsQuickReferenceTable(eventSchemas);
	eventsContent += '\n';

	eventsContent += '## Gateway types\n\n';
	eventsContent += 'These types are used in gateway event payloads but are not exposed through the HTTP API.\n\n';

	eventsContent += '### VoiceStateResponse\n\n';
	eventsContent += "Represents a user's voice connection state.\n\n";
	eventsContent += '| Field | Type | Description |\n';
	eventsContent += '|-------|------|-------------|\n';
	eventsContent += '| guild_id | ?snowflake | The guild ID this voice state is for, null if in a DM call |\n';
	eventsContent += '| channel_id | ?snowflake | The channel ID the user is connected to, null if disconnected |\n';
	eventsContent += '| user_id | snowflake | The user ID this voice state is for |\n';
	eventsContent += '| connection_id? | ?string | The unique connection identifier |\n';
	eventsContent += '| session_id? | string | The session ID for this voice state |\n';
	eventsContent +=
		'| member? | [GuildMemberResponse](/resources/guilds#guildmemberresponse) | The guild member data, if in a guild voice channel |\n';
	eventsContent += '| mute | boolean | Whether the user is server muted |\n';
	eventsContent += '| deaf | boolean | Whether the user is server deafened |\n';
	eventsContent += '| self_mute | boolean | Whether the user has muted themselves |\n';
	eventsContent += '| self_deaf | boolean | Whether the user has deafened themselves |\n';
	eventsContent += '| self_video? | boolean | Whether the user has their camera enabled |\n';
	eventsContent += '| self_stream? | boolean | Whether the user is streaming |\n';
	eventsContent += '| is_mobile? | boolean | Whether the user is connected from a mobile device |\n';
	eventsContent += '| viewer_stream_keys? | string[] | An array of stream keys the user is currently viewing |\n';
	eventsContent += '| version? | integer | The voice state version for ordering updates |\n';
	eventsContent += '\n';

	eventsContent += '### PresenceResponse\n\n';
	eventsContent += "Represents a user's presence (online status and activity).\n\n";
	eventsContent += '| Field | Type | Description |\n';
	eventsContent += '|-------|------|-------------|\n';
	eventsContent +=
		'| user | [UserPartialResponse](/resources/users#userpartialresponse) | The user this presence is for |\n';
	eventsContent += '| status | string | The current online status (online, idle, dnd, invisible, offline) |\n';
	eventsContent += '| mobile | boolean | Whether the user is on a mobile device |\n';
	eventsContent += '| afk | boolean | Whether the user is marked as AFK |\n';
	eventsContent +=
		'| custom_status | ?[CustomStatusResponse](#customstatusresponse) | The custom status set by the user |\n';
	eventsContent += '\n';

	eventsContent += '### CustomStatusResponse\n\n';
	eventsContent += "Represents a user's custom status.\n\n";
	eventsContent += '| Field | Type | Description |\n';
	eventsContent += '|-------|------|-------------|\n';
	eventsContent += '| text | string | The custom status text |\n';
	eventsContent += '| emoji_id | ?snowflake | The ID of the custom emoji used in the status |\n';
	eventsContent += '| emoji_name | ?string | The name of the emoji used in the status |\n';
	eventsContent += '| expires_at | ?string | ISO8601 timestamp when the custom status expires |\n';
	eventsContent += '\n';

	eventsContent += '### SessionResponse\n\n';
	eventsContent += "Represents a user's gateway session.\n\n";
	eventsContent += '| Field | Type | Description |\n';
	eventsContent += '|-------|------|-------------|\n';
	eventsContent += '| session_id | string | The session identifier, or "all" for the aggregate session |\n';
	eventsContent += '| status | string | The status for this session (online, idle, dnd, invisible, offline) |\n';
	eventsContent += '| mobile | boolean | Whether this session is on a mobile device |\n';
	eventsContent += '| afk | boolean | Whether this session is marked as AFK |\n';
	eventsContent += '\n';

	eventsContent += '### ReadStateResponse\n\n';
	eventsContent += 'Represents read state for a channel.\n\n';
	eventsContent += '| Field | Type | Description |\n';
	eventsContent += '|-------|------|-------------|\n';
	eventsContent += '| id | snowflake | The channel ID for this read state |\n';
	eventsContent += '| mention_count | integer | Number of unread mentions in the channel |\n';
	eventsContent += '| last_message_id | ?snowflake | The ID of the last message read |\n';
	eventsContent += '| last_pin_timestamp | ?string | ISO8601 timestamp of the last pinned message acknowledged |\n';
	eventsContent += '\n';

	eventsContent += '### GuildReadyResponse\n\n';
	eventsContent += 'Partial guild data sent in the READY event.\n\n';
	eventsContent += '| Field | Type | Description |\n';
	eventsContent += '|-------|------|-------------|\n';
	eventsContent += '| id | snowflake | The unique identifier for this guild |\n';
	eventsContent += '| unavailable? | boolean | Whether the guild is unavailable due to an outage |\n';
	eventsContent += '| name? | string | The name of the guild |\n';
	eventsContent += '| icon? | ?string | The hash of the guild icon |\n';
	eventsContent += '| owner_id? | snowflake | The ID of the guild owner |\n';
	eventsContent += '| member_count? | integer | Total number of members in the guild |\n';
	eventsContent += '| lazy? | boolean | Whether this guild uses lazy loading |\n';
	eventsContent += '| large? | boolean | Whether this guild is considered large |\n';
	eventsContent += '| joined_at? | string | ISO8601 timestamp of when the user joined |\n';
	eventsContent += '\n';

	eventsContent += '## Event details\n\n';

	for (const category of EventCategories) {
		eventsContent += `### ${category.name} events\n\n`;

		for (const eventName of category.events) {
			const schema = eventSchemas.get(eventName);
			if (schema) {
				eventsContent += renderEventSection(schema, endpointMap);
				eventsContent += '---\n\n';
			} else {
				eventsContent += `#### \`${eventName}\`\n\n`;
				eventsContent += 'Documentation pending.\n\n';
				eventsContent += '---\n\n';
			}
		}
	}

	const eventsPath = path.join(gatewayDir, 'events.mdx');
	await writeFile(eventsPath, eventsContent);

	console.log('Generated gateway documentation:');
	console.log(`  - ${opcodesPath} (${GatewayOpcodes.length} opcodes)`);
	console.log(`  - ${closeCodesPath} (${GatewayCloseCodes.length} close codes)`);
	console.log(`  - ${eventsPath} (${eventSchemas.size} events with payload documentation)`);
}

await main();
