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
import {createFrontmatter, escapeTableText, readJsonFile, wrapCode, writeFile} from './shared.mjs';

/**
 * Tag to filename mapping for splitting schemas into domain-specific files.
 */
const TAG_TO_FILE = {
	Users: 'users',
	Guilds: 'guilds',
	Channels: 'channels',
	Messages: 'messages',
	Auth: 'auth',
	Webhooks: 'webhooks',
	Invites: 'invites',
	Instance: 'instance',
	Gateway: 'gateway',
	OAuth2: 'oauth2',
	Admin: 'admin',
	KLIPY: 'klipy',
	Packs: 'packs',
	'Read States': 'read_states',
	Reports: 'reports',
	'Saved Media': 'saved_media',
	Search: 'search',
	Themes: 'themes',
	Billing: 'billing',
	Premium: 'premium',
	Gifts: 'gifts',
};

/**
 * Schema name prefix to file mapping.
 * Used as fallback when endpoint-based tag mapping doesn't apply.
 * Order matters - more specific prefixes should come first.
 */
const SCHEMA_PREFIX_TO_FILE = [
	['PresenceResponse', 'gateway'],
	['SessionResponse', 'gateway'],
	['VoiceStateResponse', 'gateway'],
	['ReadStateResponse', 'gateway'],
	['GuildReadyResponse', 'gateway'],
	['CustomStatusResponse', 'gateway'],
	['StatusType', 'gateway'],
	['User', 'users'],
	['Relationship', 'users'],
	['Profile', 'users'],
	['Presence', 'users'],
	['Harvest', 'users'],
	['Credential', 'users'],
	['Session', 'users'],
	['Backup', 'users'],
	['FriendSource', 'users'],
	['CustomStatus', 'users'],
	['PublicUser', 'users'],
	['IncomingCall', 'users'],
	['Saved', 'users'],
	['Push', 'users'],
	['Mutual', 'users'],
	['Guild', 'guilds'],
	['Role', 'guilds'],
	['Ban', 'guilds'],
	['AuditLog', 'guilds'],
	['JoinSource', 'guilds'],
	['DefaultMessage', 'guilds'],
	['SystemChannel', 'guilds'],
	['NSFW', 'guilds'],
	['Channel', 'channels'],
	['Call', 'channels'],
	['Stream', 'channels'],
	['GroupDm', 'channels'],
	['Dm', 'channels'],
	['Voice', 'channels'],
	['Scheduled', 'channels'],
	['RichEmbed', 'channels'],
	['Message', 'channels'],
	['Embed', 'channels'],
	['Attachment', 'channels'],
	['Reaction', 'channels'],
	['AllowedMentions', 'channels'],
	['Auth', 'auth'],
	['Mfa', 'auth'],
	['Authenticator', 'auth'],
	['Login', 'auth'],
	['Register', 'auth'],
	['Captcha', 'auth'],
	['WebAuthn', 'auth'],
	['Sso', 'auth'],
	['Invite', 'invites'],
	['Webhook', 'webhooks'],
	['OAuth2', 'oauth2'],
	['Application', 'oauth2'],
	['Bot', 'oauth2'],
	['Authorization', 'oauth2'],
	['Token', 'oauth2'],
	['Admin', 'admin'],
	['Bulk', 'admin'],
	['Csam', 'admin'],
	['Limit', 'admin'],
	['Lookup', 'admin'],
	['Pending', 'admin'],
	['Snowflake', 'admin'],
	['Purge', 'admin'],
	['Suspicious', 'admin'],
	['Gateway', 'gateway'],
	['Rpc', 'gateway'],
	['Search', 'search'],
	['Instance', 'instance'],
	['Report', 'reports'],
	['Dsa', 'reports'],
	['Premium', 'premium'],
	['Subscription', 'premium'],
	['Visionary', 'premium'],
	['Gift', 'gifts'],
	['Pack', 'packs'],
	['Sticker', 'packs'],
	['Emoji', 'guilds'],
	['FavoriteMeme', 'saved_media'],
	['SavedMedia', 'saved_media'],
	['Klipy', 'klipy'],
	['Theme', 'themes'],
	['ReadState', 'read_states'],
	['APIError', 'common'],
];

/**
 * Get the file for a schema based on its name prefix.
 */
function getFileFromSchemaPrefix(schemaName) {
	for (const [prefix, file] of SCHEMA_PREFIX_TO_FILE) {
		if (schemaName.startsWith(prefix)) {
			return file;
		}
	}
	return null;
}

const JSON_PRIMITIVE_TYPES = new Set(['string', 'number', 'integer', 'boolean', 'null']);

function isNullType(schema) {
	return schema && typeof schema === 'object' && schema.type === 'null';
}

function isNullableAnyOf(anyOf) {
	if (!Array.isArray(anyOf) || anyOf.length !== 2) return false;
	const nullCount = anyOf.filter(isNullType).length;
	return nullCount === 1;
}

function getNonNullSchemaFromAnyOf(anyOf) {
	if (!isNullableAnyOf(anyOf)) return null;
	return anyOf.find((s) => !isNullType(s)) ?? null;
}

function isPrimitiveType(schema) {
	if (!schema || typeof schema !== 'object') return false;
	return JSON_PRIMITIVE_TYPES.has(schema.type ?? '');
}

function isGeneralObject(schema) {
	if (!schema || typeof schema !== 'object') return false;
	const propertyCount = schema.properties ? Object.keys(schema.properties).length : 0;
	if (propertyCount > 0) return false;
	if (schema.additionalProperties === true) return true;
	if (schema.additionalProperties) return isJsonLikeComponent(schema.additionalProperties);
	return true;
}

function isArrayType(schema) {
	if (!schema || typeof schema !== 'object') return false;
	return isJsonLikeComponent(schema.items ?? {});
}

function isJsonComplexType(schema) {
	if (!schema || typeof schema !== 'object') return false;
	return schema.type === 'object' || schema.type === 'array';
}

function isJsonUnion(options) {
	if (!Array.isArray(options) || options.length === 0) return false;
	const containsComplex = options.some(isJsonComplexType);
	if (!containsComplex) return false;
	return options.every(isJsonLikeComponent);
}

function isJsonLikeComponent(schema) {
	if (!schema || typeof schema !== 'object') return false;
	if (schema.$ref) return false;
	if (Array.isArray(schema.anyOf)) return isJsonUnion(schema.anyOf);
	if (Array.isArray(schema.oneOf)) return isJsonUnion(schema.oneOf);
	if (isPrimitiveType(schema)) return true;
	if (schema.type === 'object') return isGeneralObject(schema);
	if (schema.type === 'array') return isArrayType(schema);
	return false;
}

function isJsonLikeSchema(schema) {
	if (!schema || typeof schema !== 'object') return false;
	if (schema.$ref) return false;
	if (Array.isArray(schema.anyOf)) return isJsonUnion(schema.anyOf);
	if (Array.isArray(schema.oneOf)) return isJsonUnion(schema.oneOf);
	if (schema.type === 'object') return isGeneralObject(schema);
	return false;
}

const ID_NAME_HINT_REGEX = /(?:_|^)(?:id|ids|snowflake)s?$/i;
const ID_CAMEL_HINT_REGEX = /Id(s)?$/;
const ID_DESC_HINT_REGEX = /\b(?:id|ids|identifier|snowflake)\b/i;

function toPascalCase(value) {
	if (!value || typeof value !== 'string') return '';
	return value
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean)
		.map((segment) => `${segment[0].toUpperCase()}${segment.slice(1)}`)
		.join('');
}

function withContext(context = {}, overrides = {}) {
	const contextPath = Array.isArray(context.path) ? [...context.path] : [];
	if (overrides.pathSegment) {
		contextPath.push(overrides.pathSegment);
	}
	return {
		path: contextPath,
		propertyName: Object.hasOwn(overrides, 'propertyName') ? overrides.propertyName : context.propertyName,
		description: Object.hasOwn(overrides, 'description') ? overrides.description : context.description,
	};
}

function normalizeSchemaForFingerprint(schema) {
	if (!schema || typeof schema !== 'object') {
		return schema;
	}
	if (schema.$ref) {
		return {ref: schema.$ref};
	}

	const normalized = {};
	if (schema.type) normalized.type = schema.type;
	if (schema.format) normalized.format = schema.format;
	if (schema.pattern) normalized.pattern = schema.pattern;
	if (schema.enum) normalized.enum = [...schema.enum];
	if (schema.const !== undefined) normalized.const = schema.const;
	if (schema.minimum !== undefined) normalized.minimum = schema.minimum;
	if (schema.maximum !== undefined) normalized.maximum = schema.maximum;
	if (Array.isArray(schema.required) && schema.required.length > 0) {
		normalized.required = [...schema.required].sort();
	}

	if (schema.properties) {
		const props = {};
		for (const key of Object.keys(schema.properties).sort((a, b) => a.localeCompare(b))) {
			props[key] = normalizeSchemaForFingerprint(schema.properties[key]);
		}
		normalized.properties = props;
	}

	if (schema.additionalProperties) {
		normalized.additionalProperties =
			schema.additionalProperties === true ? true : normalizeSchemaForFingerprint(schema.additionalProperties);
	}

	if (schema.items) {
		normalized.items = normalizeSchemaForFingerprint(schema.items);
	}

	if (Array.isArray(schema.anyOf)) {
		if (isJsonLikeSchema(schema)) {
			return {text: 'JSON value', inline: true};
		}
		const nonNull = getNonNullSchemaFromAnyOf(schema.anyOf);
		if (nonNull) {
			const inner = normalizeSchemaForFingerprint(nonNull);
			if (inner) {
				return {...inner, nullable: true};
			}
		}
		normalized.anyOf = schema.anyOf.map(normalizeSchemaForFingerprint);
	}

	if (Array.isArray(schema.oneOf)) {
		if (isJsonLikeSchema(schema)) {
			return {text: 'JSON value', inline: true};
		}
		normalized.oneOf = schema.oneOf.map(normalizeSchemaForFingerprint);
	}

	return Object.keys(normalized).length ? normalized : null;
}

function createSchemaFingerprint(schema) {
	const normalized = normalizeSchemaForFingerprint(schema);
	if (!normalized) return null;
	return JSON.stringify(normalized);
}

function buildFingerprintMap(schemas) {
	const fingerprintMap = new Map();
	for (const [name, schema] of Object.entries(schemas)) {
		const fingerprint = createSchemaFingerprint(schema);
		if (!fingerprint) continue;
		const existing = fingerprintMap.get(fingerprint) ?? [];
		existing.push(name);
		fingerprintMap.set(fingerprint, existing);
	}
	return fingerprintMap;
}

function findLinkedSchemaName(fingerprint, state) {
	if (!fingerprint) return null;
	const candidates = state.fingerprintMap.get(fingerprint);
	if (!candidates || candidates.length === 0) return null;
	for (const candidate of candidates) {
		if (state.linkableNames.has(candidate)) {
			return candidate;
		}
	}
	return candidates[0];
}

function registerSyntheticSchema(schema, state, context) {
	const fingerprint = createSchemaFingerprint(schema);
	if (!fingerprint) return null;
	const existing = state.syntheticFingerprintMap.get(fingerprint);
	if (existing) return existing;

	const baseName =
		(context.path && context.path.length > 0 ? context.path.map(toPascalCase).join('') : '') || 'InlineSchema';
	let name = baseName;
	let counter = 1;
	while (state.linkableNames.has(name)) {
		name = `${baseName}${counter}`;
		counter += 1;
	}

	const storedSchema = {
		...schema,
		description: schema.description ?? context.description,
	};

	state.syntheticSchemas.set(name, storedSchema);
	state.syntheticOrder.push(name);
	state.syntheticFingerprintMap.set(fingerprint, name);
	state.linkableNames.add(name);

	const entries = state.fingerprintMap.get(fingerprint) ?? [];
	if (!entries.includes(name)) {
		entries.push(name);
		state.fingerprintMap.set(fingerprint, entries);
	}

	return name;
}

function registerEnumSchema(schema, state, context) {
	if (!schema.enum || !Array.isArray(schema['x-enumNames'])) return null;

	const fingerprint = createSchemaFingerprint(schema);
	if (!fingerprint) return null;
	const existing = state.syntheticFingerprintMap.get(fingerprint);
	if (existing) return existing;

	const propertyName = context.propertyName ?? '';
	const pathSegments = context.path && context.path.length > 0 ? context.path : [];

	let baseName;
	if (propertyName && pathSegments.length > 0) {
		const schemaName = pathSegments[0];
		baseName = `${toPascalCase(schemaName)}${toPascalCase(propertyName)}`;
	} else if (propertyName) {
		baseName = toPascalCase(propertyName);
	} else if (pathSegments.length > 0) {
		baseName = pathSegments.map(toPascalCase).join('');
	} else {
		baseName = 'Enum';
	}

	let name = baseName;
	let counter = 1;
	while (state.linkableNames.has(name)) {
		name = `${baseName}${counter}`;
		counter += 1;
	}

	const storedSchema = {
		...schema,
		description: schema.description ?? context.description,
	};

	state.syntheticSchemas.set(name, storedSchema);
	state.syntheticOrder.push(name);
	state.syntheticFingerprintMap.set(fingerprint, name);
	state.linkableNames.add(name);

	const entries = state.fingerprintMap.get(fingerprint) ?? [];
	if (!entries.includes(name)) {
		entries.push(name);
		state.fingerprintMap.set(fingerprint, entries);
	}

	return name;
}

function shouldTreatAsSnowflake(schema, context) {
	if (!schema || schema.type !== 'string') return false;
	if (schema.format === 'snowflake') return true;
	if (schema.pattern === '^(0|[1-9][0-9]*)$') return true;
	const description = `${context?.description ?? schema.description ?? ''}`;
	if (/\binvite code\b/i.test(description)) return false;
	const propertyName = context?.propertyName ?? '';
	if (propertyName && (ID_NAME_HINT_REGEX.test(propertyName) || ID_CAMEL_HINT_REGEX.test(propertyName))) {
		return true;
	}
	return ID_DESC_HINT_REGEX.test(description);
}

function formatMapType(schema, state, context) {
	if (!schema || typeof schema !== 'object') return null;
	const hasProps = schema.properties && Object.keys(schema.properties).length > 0;
	if (hasProps) return null;

	const additional = schema.additionalProperties;
	if (!additional) return null;

	if (additional === true || isJsonLikeSchema(additional)) {
		return {text: 'map<string, JSON value>', inline: true, nullable: false};
	}

	const valueContext = withContext(context, {
		pathSegment: 'additionalProperties',
		propertyName: undefined,
		description: additional.description,
	});
	const valueType = formatType(additional, state, valueContext);
	return {text: `map<string, ${valueType.text}>`, inline: true, nullable: false};
}

function getBitflagTypeName(schema) {
	if (!schema || typeof schema !== 'object') return null;
	const bitflagValues = schema['x-bitflagValues'];
	if (!Array.isArray(bitflagValues) || bitflagValues.length === 0) return null;
	if (schema.type === 'string' && schema.format === 'int64') {
		return 'Bitflags64';
	}
	if (schema.type === 'integer' && schema.format === 'int32') {
		return 'Bitflags32';
	}
	return 'Bitflags';
}

function formatType(schema, state, context = {}) {
	if (!schema || typeof schema !== 'object') {
		return {text: 'unknown', inline: true, nullable: false};
	}

	const description = context.description ?? schema.description;
	const propertyName = context.propertyName;

	if (schema.$ref) {
		const refName = schema.$ref.split('/').pop() ?? schema.$ref;
		if (state.linkableNames.has(refName)) {
			return {text: `[${refName}](#${refName.toLowerCase()})`, inline: false, nullable: false};
		}
		return {text: refName, inline: true, nullable: false};
	}

	if (Array.isArray(schema.anyOf)) {
		const nonNullSchema = getNonNullSchemaFromAnyOf(schema.anyOf);
		if (nonNullSchema) {
			const inner = formatType(
				nonNullSchema,
				state,
				withContext(context, {
					description: nonNullSchema.description ?? description,
					propertyName: context.propertyName,
				}),
			);
			return {text: inner.text, inline: inner.inline, nullable: true};
		}
		const parts = schema.anyOf.map((entry, index) =>
			formatType(
				entry,
				state,
				withContext(context, {
					pathSegment: `AnyOf${index}`,
					description: entry.description ?? description,
				}),
			),
		);
		const text = parts.map((p) => p.text).join(' \\| ');
		return {text, inline: parts.every((p) => p.inline), nullable: false};
	}

	if (Array.isArray(schema.oneOf)) {
		const parts = schema.oneOf.map((entry, index) =>
			formatType(
				entry,
				state,
				withContext(context, {
					pathSegment: `OneOf${index}`,
					description: entry.description ?? description,
				}),
			),
		);
		const text = parts.map((p) => p.text).join(' \\| ');
		return {text, inline: parts.every((p) => p.inline), nullable: false};
	}

	const fingerprint = createSchemaFingerprint(schema);

	if (schema.enum) {
		const values = schema.enum;
		const names = schema['x-enumNames'];
		if (Array.isArray(names) && names.length === values.length) {
			const enumFingerprint = createSchemaFingerprint(schema);
			if (enumFingerprint) {
				const existingEnum = state.syntheticFingerprintMap.get(enumFingerprint);
				if (existingEnum) {
					return {text: `[${existingEnum}](#${existingEnum.toLowerCase()})`, inline: false, nullable: false};
				}
			}
			const enumName = registerEnumSchema(schema, state, context);
			if (enumName) {
				return {text: `[${enumName}](#${enumName.toLowerCase()})`, inline: false, nullable: false};
			}
			const parts = values.map((v, i) => `${wrapCode(v)} (${names[i]})`);
			return {text: `enum<${parts.join(', ')}>`, inline: true, nullable: false};
		}
		return {text: `enum<${values.map(wrapCode).join(', ')}>`, inline: true, nullable: false};
	}

	const bitflagTypeName = getBitflagTypeName(schema);
	if (bitflagTypeName) {
		return {text: `${bitflagTypeName}`, inline: true, nullable: false, bitflagValues: schema['x-bitflagValues']};
	}

	if (schema.type === 'string' && shouldTreatAsSnowflake(schema, {propertyName, description})) {
		return {text: `[SnowflakeType](#snowflaketype)`, inline: false, nullable: false};
	}

	if (schema.type === 'array') {
		const items = schema.items ?? {};
		if (isJsonLikeSchema(items)) {
			return {text: 'JSON value[]', inline: true, nullable: false};
		}
		const itemContext = withContext(context, {pathSegment: 'item'});
		const item = formatType(items, state, itemContext);
		return {text: `${item.text}[]`, inline: item.inline, nullable: false};
	}

	if (schema.type === 'object') {
		const mapInfo = formatMapType(schema, state, context);
		if (mapInfo) {
			return mapInfo;
		}
		if (isJsonLikeSchema(schema)) {
			return {text: 'JSON value', inline: true, nullable: false};
		}
		if (fingerprint) {
			const linked = findLinkedSchemaName(fingerprint, state);
			if (linked) {
				return {text: `[${linked}](#${linked.toLowerCase()})`, inline: false, nullable: false};
			}
			const synthetic = registerSyntheticSchema(schema, state, context);
			if (synthetic) {
				return {text: `[${synthetic}](#${synthetic.toLowerCase()})`, inline: false, nullable: false};
			}
		}
		return {text: 'object', inline: true, nullable: false};
	}

	if (schema.type) {
		const label = schema.format ? `${schema.type} (${schema.format})` : schema.type;
		return {text: label, inline: true, nullable: false};
	}

	if (isJsonLikeSchema(schema)) {
		return {text: 'JSON value', inline: true, nullable: false};
	}

	return {text: 'unknown', inline: true, nullable: false};
}

function escapeHtml(value) {
	return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function renderType(typeInfo, options = {}) {
	if (!typeInfo) {
		return wrapCode('unknown');
	}
	const wrapInline = options.wrapInline ?? false;
	const nullablePrefix = typeInfo.nullable ? '?' : '';

	if (typeInfo.inline && wrapInline) {
		return `${nullablePrefix}${wrapCode(typeInfo.text)}`;
	}
	return `${nullablePrefix}${escapeHtml(typeInfo.text)}`;
}

function renderBitflagTable(bitflagValues) {
	if (!Array.isArray(bitflagValues) || bitflagValues.length === 0) {
		return '';
	}

	let body = '';
	body += `| Flag | Value | Description |\n`;
	body += `|------|-------|-------------|\n`;

	for (const flag of bitflagValues) {
		const name = flag.name ?? '';
		const value = flag.value ?? '0';
		const desc = flag.description ?? '';
		body += `| ${escapeTableText(name)} | ${wrapCode(value)} | ${escapeTableText(desc)} |\n`;
	}
	body += `\n`;
	return body;
}

/**
 * Format field name with optional indicator.
 * Appends ? suffix when the field is not required.
 */
function formatFieldName(name, isRequired) {
	return isRequired ? name : `${name}?`;
}

/**
 * Clean up description by removing redundant "Known values: ..." text for enums.
 */
function cleanEnumDescription(description) {
	if (!description) return '';
	const knownValuesIndex = description.indexOf(' Known values:');
	if (knownValuesIndex > 0) {
		return description.substring(0, knownValuesIndex).trim();
	}
	return description;
}

function renderSchemaSection(name, schema, state) {
	const rawDescription = typeof schema?.description === 'string' ? schema.description.trim() : '';
	const required = Array.isArray(schema?.required) ? new Set(schema.required) : new Set();

	const isEnum =
		(Array.isArray(schema?.enum) && schema.enum.length > 0) ||
		(Array.isArray(schema?.['x-enumNames']) && schema['x-enumNames'].length > 0);
	const description = isEnum ? cleanEnumDescription(rawDescription) : rawDescription;

	const rootContext = {path: [name], propertyName: name, description};

	let body = '';
	body += `<a id="${name.toLowerCase()}"></a>\n\n`;
	body += `## ${name}\n\n`;
	if (description) {
		body += `${description}\n\n`;
	}

	if (state.schemaToEndpoints) {
		body += renderRelatedEndpoints(name, state.schemaToEndpoints);
	}

	const bitflagValues = schema?.['x-bitflagValues'];
	if (Array.isArray(bitflagValues) && bitflagValues.length > 0) {
		const bitflagTypeName = getBitflagTypeName(schema);
		if (bitflagTypeName) {
			body += `Type: ${bitflagTypeName}\n\n`;
		}
		body += renderBitflagTable(bitflagValues);
		return body;
	}

	const enumValues = schema?.enum;
	const enumNames = schema?.['x-enumNames'];
	const enumDescriptions = schema?.['x-enumDescriptions'];

	const valuesToRender = Array.isArray(enumValues) && enumValues.length > 0 ? enumValues : enumNames;

	if (Array.isArray(valuesToRender) && valuesToRender.length > 0) {
		body += `| Value | Description |\n`;
		body += `|-------|-------------|\n`;

		for (let i = 0; i < valuesToRender.length; i++) {
			const value = valuesToRender[i];
			const enumDesc = Array.isArray(enumDescriptions) ? enumDescriptions[i] : null;
			const desc =
				enumDesc && typeof enumDesc === 'string' && enumDesc.trim().length > 0 ? escapeTableText(enumDesc) : '-';
			body += `| ${wrapCode(value)} | ${desc} |\n`;
		}
		body += `\n`;
		return body;
	}

	if (schema?.type !== 'object' || !schema?.properties) {
		const schemaType = formatType(schema, state, rootContext);
		body += `Type: ${renderType(schemaType, {wrapInline: false})}\n\n`;
		return body;
	}

	const propertyNames = Object.keys(schema.properties).sort((a, b) => a.localeCompare(b));
	if (propertyNames.length === 0) {
		body += `Type: ${renderType({text: 'object', inline: true, nullable: false})}\n\n`;
		return body;
	}

	body += `| Field | Type | Description |\n`;
	body += `|-------|------|-------------|\n`;

	for (const prop of propertyNames) {
		const propSchema = schema.properties[prop];
		const propDesc = typeof propSchema?.description === 'string' ? propSchema.description.trim() : '';
		const propContext = withContext(rootContext, {
			pathSegment: prop,
			propertyName: prop,
			description: propDesc || propSchema?.description,
		});
		const propType = formatType(propSchema, state, propContext);
		const isRequired = required.has(prop);
		const fieldName = formatFieldName(prop, isRequired);
		body += `| ${escapeTableText(fieldName)} | ${renderType(propType)} | ${escapeTableText(propDesc)} |\n`;
	}

	body += `\n`;
	return body;
}

function discoverEnumSchemas(schemas, state) {
	for (const [schemaName, schema] of Object.entries(schemas)) {
		if (!schema || typeof schema !== 'object' || schema.type !== 'object' || !schema.properties) {
			continue;
		}

		const rootContext = {path: [schemaName], propertyName: schemaName};
		for (const [propName, propSchema] of Object.entries(schema.properties)) {
			if (!propSchema || typeof propSchema !== 'object') continue;

			let enumSchema = propSchema;
			if (Array.isArray(propSchema.anyOf)) {
				const nonNull = getNonNullSchemaFromAnyOf(propSchema.anyOf);
				if (nonNull) {
					enumSchema = nonNull;
				}
			}

			if (enumSchema.enum && Array.isArray(enumSchema['x-enumNames'])) {
				const propContext = withContext(rootContext, {
					pathSegment: propName,
					propertyName: propName,
					description: enumSchema.description ?? propSchema.description,
				});
				registerEnumSchema(enumSchema, state, propContext);
			}
		}
	}
}

/**
 * Build a mapping from schema names to tags based on OpenAPI path usage.
 */
function buildSchemaToTagMap(openapi) {
	const schemaToTags = new Map();
	const paths = openapi.paths ?? {};

	function extractSchemaRefs(obj, refs = new Set()) {
		if (!obj || typeof obj !== 'object') return refs;
		if (obj.$ref && typeof obj.$ref === 'string') {
			const refName = obj.$ref.split('/').pop();
			if (refName) refs.add(refName);
		}
		for (const value of Object.values(obj)) {
			extractSchemaRefs(value, refs);
		}
		return refs;
	}

	for (const pathMethods of Object.values(paths)) {
		for (const operation of Object.values(pathMethods)) {
			if (!operation || typeof operation !== 'object') continue;
			const tags = operation.tags ?? ['General'];
			const refs = extractSchemaRefs(operation);

			for (const ref of refs) {
				const existing = schemaToTags.get(ref) ?? new Map();
				for (const tag of tags) {
					existing.set(tag, (existing.get(tag) ?? 0) + 1);
				}
				schemaToTags.set(ref, existing);
			}
		}
	}

	return schemaToTags;
}

/**
 * Build a mapping from schema names to the endpoints that use them.
 * Returns Map<schemaName, Array<{method, path, operationId, summary, tags}>>
 */
function buildSchemaToEndpointsMap(openapi) {
	const schemaToEndpoints = new Map();
	const paths = openapi.paths ?? {};

	function extractSchemaRefs(obj, refs = new Set()) {
		if (!obj || typeof obj !== 'object') return refs;
		if (obj.$ref && typeof obj.$ref === 'string') {
			const refName = obj.$ref.split('/').pop();
			if (refName) refs.add(refName);
		}
		for (const value of Object.values(obj)) {
			extractSchemaRefs(value, refs);
		}
		return refs;
	}

	for (const [pathKey, pathMethods] of Object.entries(paths)) {
		for (const [method, operation] of Object.entries(pathMethods)) {
			if (!operation || typeof operation !== 'object') continue;
			if (method === 'parameters') continue;

			const tags = operation.tags ?? ['General'];
			const operationId = operation.operationId ?? '';
			const summary = operation.summary ?? '';
			const refs = extractSchemaRefs(operation);

			const endpoint = {
				method: method.toUpperCase(),
				path: pathKey,
				operationId,
				summary,
				tags,
			};

			for (const ref of refs) {
				const existing = schemaToEndpoints.get(ref) ?? [];
				existing.push(endpoint);
				schemaToEndpoints.set(ref, existing);
			}
		}
	}

	return schemaToEndpoints;
}

/**
 * Slugify a string for URL use (Mintlify URL format).
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
 * Generate the API reference URL for an endpoint.
 * Mintlify generates URLs from summary (slugified), not operationId.
 */
function getEndpointApiRefUrl(endpoint) {
	const tag = endpoint.tags?.[0] ?? 'General';
	const tagSlug = slugify(tag);
	const summarySlug = slugify(endpoint.summary);
	return `/api-reference/${tagSlug}/${summarySlug}`;
}

/**
 * Render related endpoints section for a schema.
 */
function renderRelatedEndpoints(schemaName, schemaToEndpoints) {
	const endpoints = schemaToEndpoints.get(schemaName);
	if (!endpoints || endpoints.length === 0) return '';

	const uniqueEndpoints = [];
	const seen = new Set();
	for (const ep of endpoints) {
		const key = `${ep.method} ${ep.path}`;
		if (!seen.has(key)) {
			seen.add(key);
			uniqueEndpoints.push(ep);
		}
	}

	uniqueEndpoints.sort((a, b) => {
		const methodOrder = {GET: 0, POST: 1, PUT: 2, PATCH: 3, DELETE: 4};
		const aOrder = methodOrder[a.method] ?? 5;
		const bOrder = methodOrder[b.method] ?? 5;
		if (aOrder !== bOrder) return aOrder - bOrder;
		return a.path.localeCompare(b.path);
	});

	let out = '**Related endpoints**\n\n';
	for (const ep of uniqueEndpoints) {
		const url = getEndpointApiRefUrl(ep);
		out += `- [\`${ep.method} ${ep.path}\`](${url})\n`;
	}
	out += '\n';

	return out;
}

/**
 * Get the primary tag for a schema based on usage frequency.
 */
function getPrimaryTag(schemaName, schemaToTags) {
	const tagCounts = schemaToTags.get(schemaName);
	if (!tagCounts || tagCounts.size === 0) return null;

	let maxTag = null;
	let maxCount = 0;
	for (const [tag, count] of tagCounts) {
		if (count > maxCount) {
			maxCount = count;
			maxTag = tag;
		}
	}
	return maxTag;
}

/**
 * Group schemas by their primary tag, with prefix-based fallback.
 */
function groupSchemasByTag(schemas, schemaToTags) {
	const groups = new Map();
	const common = [];

	for (const name of Object.keys(schemas)) {
		const tag = getPrimaryTag(name, schemaToTags);
		if (tag && TAG_TO_FILE[tag]) {
			const fileName = TAG_TO_FILE[tag];
			const group = groups.get(fileName) ?? [];
			group.push(name);
			groups.set(fileName, group);
		} else {
			const prefixFile = getFileFromSchemaPrefix(name);
			if (prefixFile) {
				const group = groups.get(prefixFile) ?? [];
				group.push(name);
				groups.set(prefixFile, group);
			} else {
				common.push(name);
			}
		}
	}

	if (common.length > 0) {
		groups.set('common', common);
	}

	return groups;
}

function renderMdxForSchemas(schemaNames, schemas, state, options = {}) {
	const {title, description, isOverview = false} = options;

	let out = '';
	out += createFrontmatter({title, description});
	out += '\n\n';

	if (isOverview) {
		out += `This page contains all resource schemas extracted from the OpenAPI specification.\n\n`;
		out += `See [field notation](/resources/overview#field-notation) for how to interpret field names and types.\n\n`;
	}

	const sortedNames = [...schemaNames].sort((a, b) => a.localeCompare(b));

	for (const name of sortedNames) {
		out += renderSchemaSection(name, schemas[name], state);
	}

	const relevantSynthetics = state.syntheticOrder.filter((name) =>
		sortedNames.some((sn) => name.startsWith(toPascalCase(sn))),
	);
	for (const name of relevantSynthetics) {
		const schema = state.syntheticSchemas.get(name);
		if (schema) {
			out += renderSchemaSection(name, schema, state);
		}
	}

	return out;
}

function renderOverviewMdx(schemaGroups, allSchemaNames, state) {
	let out = '';
	out += createFrontmatter({
		title: 'Overview',
		description: 'Object schemas extracted from the OpenAPI schema.',
	});
	out += '\n\n';

	out += `This section contains all resource schemas (data types) used by the Fluxer API.\n\n`;

	out += `## Field notation\n\n`;
	out += `Resource tables use a compact notation:\n\n`;
	out += `| Notation | Meaning |\n`;
	out += `|----------|----------|\n`;
	out += `| \`field\` | Required field |\n`;
	out += `| \`field?\` | Optional field (may be omitted) |\n`;
	out += `| \`?type\` | Nullable (value can be \`null\`) |\n`;
	out += `| \`field?\` with \`?type\` | Optional and nullable |\n`;
	out += `\n`;

	out += `## Resources by domain\n\n`;

	const sortedGroups = [...schemaGroups.entries()].sort(([a], [b]) => a.localeCompare(b));

	for (const [fileName, schemaNames] of sortedGroups) {
		const displayName = fileName.charAt(0).toUpperCase() + fileName.slice(1).replace(/_/g, ' ');
		out += `- [${displayName}](/resources/${fileName}) (${schemaNames.length} schemas)\n`;
	}
	out += `\n`;

	out += `## All schemas\n\n`;

	const sortedAllNames = [...allSchemaNames].sort((a, b) => a.localeCompare(b));
	for (const name of sortedAllNames) {
		const tag = state.schemaToTag?.get(name);
		const fileName = tag && TAG_TO_FILE[tag] ? TAG_TO_FILE[tag] : 'common';
		out += `- [${name}](/resources/${fileName}#${name.toLowerCase()})\n`;
	}
	for (const name of state.syntheticOrder) {
		out += `- [${name}](#${name.toLowerCase()})\n`;
	}

	out += `\n`;

	return out;
}

async function main() {
	const dirname = path.dirname(fileURLToPath(import.meta.url));
	const repoRoot = path.resolve(dirname, '../..');
	const openapiPath = path.join(repoRoot, 'fluxer_docs/api-reference/openapi.json');
	const outDir = path.join(repoRoot, 'fluxer_docs/resources');

	const openapi = await readJsonFile(openapiPath);
	const schemas = openapi?.components?.schemas ?? {};
	const allNames = Object.keys(schemas);
	const linkableNames = new Set(allNames);

	const schemaToTags = buildSchemaToTagMap(openapi);
	const schemaToEndpoints = buildSchemaToEndpointsMap(openapi);

	const state = {
		linkableNames,
		fingerprintMap: buildFingerprintMap(schemas),
		syntheticSchemas: new Map(),
		syntheticOrder: [],
		syntheticFingerprintMap: new Map(),
		schemaToTag: new Map(),
		schemaToEndpoints,
	};

	for (const name of allNames) {
		const tag = getPrimaryTag(name, schemaToTags);
		if (tag) {
			state.schemaToTag.set(name, tag);
		}
	}

	discoverEnumSchemas(schemas, state);

	const schemaGroups = groupSchemasByTag(schemas, schemaToTags);

	const overviewMdx = renderOverviewMdx(schemaGroups, allNames, state);
	await writeFile(path.join(outDir, 'overview.mdx'), overviewMdx);

	for (const [fileName, schemaNames] of schemaGroups) {
		let displayName = fileName.charAt(0).toUpperCase() + fileName.slice(1).replace(/_/g, ' ');
		if (displayName.toLowerCase() === 'oauth2') {
			displayName = 'OAuth2';
		}
		const mdx = renderMdxForSchemas(schemaNames, schemas, state, {
			title: displayName,
			description: `${displayName} object schemas from the Fluxer API.`,
		});
		await writeFile(path.join(outDir, `${fileName}.mdx`), mdx);
	}

	console.log(`Generated ${schemaGroups.size + 1} resource files in ${outDir}`);
}

await main();
