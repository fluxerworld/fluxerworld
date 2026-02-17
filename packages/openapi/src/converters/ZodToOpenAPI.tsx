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

import {
	Base64ImageTypeRef,
	EmailTypeRef,
	Int32TypeRef,
	Int64StringTypeRef,
	Int64TypeRef,
	LocaleRef,
	PasswordTypeRef,
	PhoneNumberTypeRef,
	SnowflakeTypeRef,
	UnsignedInt64TypeRef,
	UsernameTypeRef,
} from '@fluxer/openapi/src/converters/BuiltInSchemas';
import {CustomSchemaType} from '@fluxer/openapi/src/schemas/CustomSchemaType';
import type {OpenAPISchema, OpenAPISchemaOrRef} from '@fluxer/openapi/src/Types';
import type {ZodTypeAny} from 'zod';

const FLUXER_SCHEMA_NAME = Symbol('fluxer.openapi.schemaName');
const FLUXER_CUSTOM_TYPE_KEY = '__fluxer_custom_type__';

const bitflagSchemaRegistry = new Map<string, OpenAPISchema>();
const int32EnumSchemaRegistry = new Map<string, OpenAPISchema>();

export function setSchemaName(schema: ZodTypeAny, name: string): void {
	(schema as {[FLUXER_SCHEMA_NAME]?: string})[FLUXER_SCHEMA_NAME] = name;
}

function getSchemaName(schema: ZodTypeAny): string | undefined {
	return (schema as {[FLUXER_SCHEMA_NAME]?: string})[FLUXER_SCHEMA_NAME];
}

export function setCustomType(schema: ZodTypeAny, typeName: string): ZodTypeAny {
	(schema as unknown as Record<string, unknown>)[FLUXER_CUSTOM_TYPE_KEY] = typeName;
	return schema;
}

function getCustomType(schema: ZodTypeAny, depth = 0): string | undefined {
	if (depth > 20) return undefined;
	const direct = (schema as unknown as Record<string, unknown>)[FLUXER_CUSTOM_TYPE_KEY];
	if (typeof direct === 'string') return direct;
	const parent = (schema as {_zod?: {parent?: ZodTypeAny}})._zod?.parent;
	if (parent) {
		return getCustomType(parent, depth + 1);
	}
	return undefined;
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface BitflagEntry {
	name: string;
	value: string;
	description?: string;
}

interface EnumEntry {
	name: string;
	value: string | number;
	description?: string;
}

interface FluxerTypeAnnotation {
	typeName: string;
	userDescription: string | undefined;
	enumNames?: Array<string>;
	enumEntries?: Array<EnumEntry>;
	bitflagValues?: Array<BitflagEntry>;
	bitflagTypeName?: string;
	fieldDescription?: string;
}

interface BitflagEntryJson {
	n: string;
	v: string;
	d?: string;
}

interface EnumEntryJson {
	n: string;
	v: string | number;
	d?: string;
}

function parseBitflagEntries(entriesStr: string): Array<BitflagEntry> {
	try {
		const parsed = JSON.parse(entriesStr) as Array<BitflagEntryJson>;
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((entry) => entry && typeof entry.n === 'string' && typeof entry.v === 'string')
			.map((entry) => ({
				name: entry.n,
				value: entry.v,
				...(entry.d ? {description: entry.d} : {}),
			}));
	} catch {
		return entriesStr
			.split(',')
			.filter(Boolean)
			.map((entry) => {
				const [name, value] = entry.split('=');
				return {name: name?.trim() ?? '', value: value?.trim() ?? '0'};
			})
			.filter((entry) => entry.name.length > 0);
	}
}

function parseEnumEntries(entriesStr: string): Array<EnumEntry> {
	try {
		const parsed = JSON.parse(entriesStr) as Array<EnumEntryJson> | EnumEntryJson;
		const entries = Array.isArray(parsed) ? parsed : [parsed];
		return entries
			.filter(
				(entry) => entry && typeof entry.n === 'string' && (typeof entry.v === 'string' || typeof entry.v === 'number'),
			)
			.map((entry) => ({
				name: entry.n,
				value: entry.v,
				...(entry.d ? {description: entry.d} : {}),
			}));
	} catch {
		return entriesStr
			.split(',')
			.filter(Boolean)
			.map((name) => ({name: name.trim(), value: name.trim()}))
			.filter((entry) => entry.name.length > 0);
	}
}

function findJsonEnd(str: string, startIndex: number): number {
	const openChar = str[startIndex];
	const closeChar = openChar === '[' ? ']' : openChar === '{' ? '}' : null;
	if (!closeChar) return -1;

	let depth = 1;
	let inString = false;
	let escaping = false;

	for (let i = startIndex + 1; i < str.length; i++) {
		const char = str[i];
		if (escaping) {
			escaping = false;
			continue;
		}
		if (char === '\\') {
			escaping = true;
			continue;
		}
		if (char === '"') {
			inString = !inString;
			continue;
		}
		if (inString) continue;
		if (char === openChar) depth++;
		if (char === closeChar) depth--;
		if (depth === 0) return i;
	}
	return -1;
}

function splitTypeAndDescription(rest: string): {typeAndData: string; userDescription: string | undefined} {
	const bracketIndex = rest.indexOf('[');
	const braceIndex = rest.indexOf('{');

	let jsonStartIndex = -1;
	if (bracketIndex !== -1 && braceIndex !== -1) {
		jsonStartIndex = Math.min(bracketIndex, braceIndex);
	} else if (bracketIndex !== -1) {
		jsonStartIndex = bracketIndex;
	} else if (braceIndex !== -1) {
		jsonStartIndex = braceIndex;
	}

	if (jsonStartIndex !== -1) {
		const jsonEnd = findJsonEnd(rest, jsonStartIndex);
		if (jsonEnd !== -1) {
			const endIndex = jsonEnd + 1;
			const userDesc = rest.slice(endIndex).trim() || undefined;
			return {typeAndData: rest.slice(0, endIndex), userDescription: userDesc};
		}
	}

	const firstSpaceIndex = rest.indexOf(' ');
	if (firstSpaceIndex === -1) {
		return {typeAndData: rest, userDescription: undefined};
	}
	return {
		typeAndData: rest.slice(0, firstSpaceIndex),
		userDescription: rest.slice(firstSpaceIndex + 1).trim() || undefined,
	};
}

function parseFluxerTypeAnnotation(description: string | undefined): FluxerTypeAnnotation | null {
	if (!description?.startsWith('fluxer:')) return null;

	const rest = description.slice('fluxer:'.length);
	const {typeAndData, userDescription: rawUserDescription} = splitTypeAndDescription(rest);

	let userDescription = rawUserDescription;
	let fieldDescription: string | undefined;
	if (userDescription) {
		const fieldDescIndex = userDescription.indexOf('|fieldDesc:');
		if (fieldDescIndex !== -1) {
			fieldDescription = userDescription.slice(fieldDescIndex + '|fieldDesc:'.length).trim();
			userDescription = userDescription.slice(0, fieldDescIndex).trim() || undefined;
		}
	}

	if (typeAndData.startsWith('IntegerEnum:')) {
		const namesStr = typeAndData.slice('IntegerEnum:'.length);
		const enumNames = namesStr.split(',').filter(Boolean);
		return {typeName: 'IntegerEnum', userDescription, enumNames, fieldDescription};
	}

	if (typeAndData.startsWith('EnumValue:')) {
		const entryStr = typeAndData.slice('EnumValue:'.length);
		const enumEntries = parseEnumEntries(entryStr);
		const enumNames = enumEntries.length > 0 ? [enumEntries[0].name] : undefined;
		return {
			typeName: 'EnumValue',
			userDescription,
			enumNames,
			enumEntries: enumEntries.length > 0 ? enumEntries : undefined,
			fieldDescription,
		};
	}

	if (typeAndData.startsWith('EnumValues:')) {
		const entriesStr = typeAndData.slice('EnumValues:'.length);
		const enumEntries = parseEnumEntries(entriesStr);
		const enumNames = enumEntries.map((e) => e.name);
		return {
			typeName: 'EnumValues',
			userDescription,
			enumNames,
			enumEntries: enumEntries.length > 0 ? enumEntries : undefined,
			fieldDescription,
		};
	}

	if (typeAndData.startsWith('FlexibleEnumValues:')) {
		const entriesStr = typeAndData.slice('FlexibleEnumValues:'.length);
		const enumEntries = parseEnumEntries(entriesStr);
		const enumNames = enumEntries.map((e) => e.name);
		return {
			typeName: 'FlexibleEnumValues',
			userDescription,
			enumNames,
			enumEntries: enumEntries.length > 0 ? enumEntries : undefined,
			fieldDescription,
		};
	}

	if (typeAndData.startsWith('Int32Enum:')) {
		const rest = typeAndData.slice('Int32Enum:'.length);
		let enumTypeName: string | undefined;
		let entriesStr: string;
		if (rest.startsWith('[') || rest.startsWith('{')) {
			entriesStr = rest;
		} else {
			const colonIndex = rest.indexOf(':');
			if (colonIndex > 0) {
				enumTypeName = rest.slice(0, colonIndex);
				entriesStr = rest.slice(colonIndex + 1);
			} else {
				entriesStr = rest;
			}
		}
		const enumEntries = parseEnumEntries(entriesStr);
		const enumNames = enumEntries.map((e) => e.name);
		return {
			typeName: 'Int32Enum',
			userDescription,
			enumNames,
			enumEntries: enumEntries.length > 0 ? enumEntries : undefined,
			bitflagTypeName: enumTypeName,
			fieldDescription,
		};
	}

	if (typeAndData.startsWith('Bitflags64:')) {
		const rest = typeAndData.slice('Bitflags64:'.length);
		let bitflagTypeName: string | undefined;
		let entriesStr: string;
		if (rest.startsWith('[') || rest.startsWith('{')) {
			entriesStr = rest;
		} else {
			const colonIndex = rest.indexOf(':');
			if (colonIndex > 0) {
				bitflagTypeName = rest.slice(0, colonIndex);
				entriesStr = rest.slice(colonIndex + 1);
			} else {
				entriesStr = rest;
			}
		}
		const bitflagValues = parseBitflagEntries(entriesStr);
		return {typeName: 'Bitflags64', userDescription, bitflagValues, bitflagTypeName, fieldDescription};
	}

	if (typeAndData.startsWith('Bitflags32:')) {
		const rest = typeAndData.slice('Bitflags32:'.length);
		let bitflagTypeName: string | undefined;
		let entriesStr: string;
		if (rest.startsWith('[') || rest.startsWith('{')) {
			entriesStr = rest;
		} else {
			const colonIndex = rest.indexOf(':');
			if (colonIndex > 0) {
				bitflagTypeName = rest.slice(0, colonIndex);
				entriesStr = rest.slice(colonIndex + 1);
			} else {
				entriesStr = rest;
			}
		}
		const bitflagValues = parseBitflagEntries(entriesStr);
		return {typeName: 'Bitflags32', userDescription, bitflagValues, bitflagTypeName, fieldDescription};
	}

	if (typeAndData.startsWith('Permissions:')) {
		const rest = typeAndData.slice('Permissions:'.length);
		let bitflagTypeName: string | undefined;
		let entriesStr: string;
		if (rest.startsWith('[') || rest.startsWith('{')) {
			entriesStr = rest;
		} else {
			const colonIndex = rest.indexOf(':');
			if (colonIndex > 0) {
				bitflagTypeName = rest.slice(0, colonIndex);
				entriesStr = rest.slice(colonIndex + 1);
			} else {
				entriesStr = rest;
			}
		}
		const bitflagValues = parseBitflagEntries(entriesStr);
		return {typeName: 'Permissions', userDescription, bitflagValues, bitflagTypeName, fieldDescription};
	}

	return {typeName: typeAndData, userDescription, fieldDescription};
}

function getZodTypeName(schema: ZodTypeAny): string {
	const def = (schema as {_def?: {typeName?: string; type?: string}})._def;
	return def?.typeName ?? def?.type ?? 'unknown';
}

function getInnerType(schema: ZodTypeAny): ZodTypeAny | undefined {
	const def = (schema as {_def?: {innerType?: ZodTypeAny; schema?: ZodTypeAny; in?: ZodTypeAny}})._def;
	return def?.in ?? def?.innerType ?? def?.schema;
}

function getShape(schema: ZodTypeAny): Record<string, ZodTypeAny> | undefined {
	const def = schema._def as {shape?: (() => Record<string, ZodTypeAny>) | Record<string, ZodTypeAny>};
	if (typeof def.shape === 'function') {
		return def.shape();
	}
	if (typeof def.shape === 'object' && def.shape !== null) {
		return def.shape;
	}
	return undefined;
}

function getOptions(schema: ZodTypeAny): Array<ZodTypeAny> | undefined {
	const def = schema._def as {options?: Array<ZodTypeAny>};
	return def.options;
}

function getLiteralValues(schema: ZodTypeAny): Array<unknown> | null {
	const def = schema._def as {value?: unknown; values?: Array<unknown>};
	if (Array.isArray(def.values)) {
		return def.values.length > 0 ? def.values : null;
	}
	if ('value' in def) {
		return [def.value];
	}
	const values =
		(schema as {values?: Set<unknown>}).values ?? (schema as {_zod?: {values?: Set<unknown>}})._zod?.values;
	if (values instanceof Set) {
		return Array.from(values);
	}
	return null;
}

interface EnumInfo {
	values: Array<string | number>;
	enumNames?: Array<string | null>;
}

function buildEnumInfoFromRecord(record: Record<string, unknown>): EnumInfo | null {
	const entries = Object.entries(record);
	const values: Array<string | number> = [];
	const enumNames: Array<string | null> = [];

	for (const [key, value] of entries) {
		if (typeof value !== 'string' && typeof value !== 'number') {
			continue;
		}
		const numericKey = Number(key);
		const shouldInclude = typeof value === 'number' || Number.isNaN(numericKey);
		if (!shouldInclude) {
			continue;
		}

		values.push(value);
		enumNames.push(Number.isNaN(numericKey) ? key : null);
	}

	if (values.length === 0) {
		return null;
	}

	const hasNames = enumNames.some((name) => typeof name === 'string' && name.length > 0);
	if (hasNames) {
		return {values, enumNames};
	}
	return {values};
}

function getEnumInfo(schema: ZodTypeAny): EnumInfo | null {
	const def = schema._def as {values?: unknown; entries?: Record<string, unknown>};
	if (Array.isArray(def.values)) {
		const values = def.values.filter(
			(val): val is string | number => typeof val === 'string' || typeof val === 'number',
		);
		return values.length > 0 ? {values} : null;
	}
	if (def.entries && typeof def.entries === 'object') {
		const info = buildEnumInfoFromRecord(def.entries);
		if (info) {
			return info;
		}
	}
	if (def.values && typeof def.values === 'object' && !Array.isArray(def.values)) {
		const info = buildEnumInfoFromRecord(def.values as Record<string, unknown>);
		if (info) {
			return info;
		}
	}
	const values =
		(schema as {values?: Set<unknown>}).values ?? (schema as {_zod?: {values?: Set<unknown>}})._zod?.values;
	if (values instanceof Set) {
		const filtered = Array.from(values).filter(
			(val): val is string | number => typeof val === 'string' || typeof val === 'number',
		);
		return filtered.length > 0 ? {values: filtered} : null;
	}
	return null;
}

function buildEnumSchemaFromInfo(enumInfo: EnumInfo): OpenAPISchema {
	const {values, enumNames} = enumInfo;
	const schema: OpenAPISchema = {enum: values};
	const allNumbers = values.every((val) => typeof val === 'number');
	const allStrings = values.every((val) => typeof val === 'string');
	if (allNumbers) {
		const allInts = values.every((val) => typeof val === 'number' && Number.isInteger(val));
		schema.type = allInts ? 'integer' : 'number';
	} else if (allStrings) {
		schema.type = 'string';
	}
	if (enumNames?.some((name) => typeof name === 'string' && name.length > 0)) {
		(schema as OpenAPISchema & Record<string, unknown>)['x-enumNames'] = enumNames;
	}
	return schema;
}

function getLiteralSchema(values: Array<unknown>): OpenAPISchema {
	const allNumbers = values.every((val) => typeof val === 'number');
	const allStrings = values.every((val) => typeof val === 'string');
	const allBooleans = values.every((val) => typeof val === 'boolean');
	if (allNumbers) {
		const allInts = values.every((val) => typeof val === 'number' && Number.isInteger(val));
		return {
			type: allInts ? 'integer' : 'number',
			enum: values as Array<number>,
		};
	}
	if (allStrings) {
		return {
			type: 'string',
			enum: values as Array<string>,
		};
	}
	if (allBooleans) {
		return {
			type: 'boolean',
			enum: values as Array<boolean>,
		};
	}
	const enumValues = values.filter(
		(val): val is string | number | boolean =>
			typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean',
	);
	if (enumValues.length === 0) {
		if (values.some((val) => val === null)) {
			return {type: 'null'};
		}
		return {};
	}

	const hasNull = values.some((val) => val === null);
	const schema: OpenAPISchema = {enum: enumValues};
	if (hasNull) {
		schema.nullable = true;
	}
	return schema;
}

function getJsonValueSchema(depth = 0): OpenAPISchema {
	if (depth >= 2) {
		return {
			anyOf: [
				{type: 'string'},
				{type: 'number'},
				{type: 'boolean'},
				{type: 'object', additionalProperties: true},
				{type: 'null'},
			],
		};
	}

	return {
		anyOf: [
			{type: 'string'},
			{type: 'number'},
			{type: 'boolean'},
			{type: 'object', additionalProperties: getJsonValueSchema(depth + 1)},
			{type: 'array', items: getJsonValueSchema(depth + 1)},
			{type: 'null'},
		],
	};
}

function getArrayType(schema: ZodTypeAny): ZodTypeAny | undefined {
	const def = schema._def as unknown as {type?: ZodTypeAny; element?: ZodTypeAny; items?: ZodTypeAny};
	return def.element ?? def.type ?? def.items;
}

interface ZodCheck {
	kind?: string;
	type?: string;
	value?: unknown;
	minimum?: unknown;
	maximum?: unknown;
	inclusive?: boolean;
	exact?: boolean;
	message?: string;
	regex?: RegExp;
	minValue?: number;
	maxValue?: number;
	isInt?: boolean;
	isFinite?: boolean;
	format?: string;
	def?: {check?: string; type?: string};
	_zod?: {def?: Record<string, unknown>};
}

function getCheckKind(check: ZodCheck): string {
	if (check.kind) return check.kind;
	if (check.type) return check.type;
	if (check.def?.check) return check.def.check;
	const v4Def = check._zod?.def;
	if (v4Def && typeof v4Def.check === 'string') {
		if (v4Def.check === 'min_length') return 'min';
		if (v4Def.check === 'max_length') return 'max';
		if (v4Def.check === 'greater_than') return 'min';
		if (v4Def.check === 'less_than') return 'max';
		if (v4Def.check === 'multiple_of') return 'multipleOf';
		if (v4Def.check === 'string_format' && typeof v4Def.format === 'string') {
			if (v4Def.format === 'starts_with') return 'startsWith';
			if (v4Def.format === 'ends_with') return 'endsWith';
			return v4Def.format;
		}
		return v4Def.check;
	}
	const name = check.constructor?.name ?? '';
	if (name.includes('MinLength') || name.includes('GreaterThan')) return 'min';
	if (name.includes('MaxLength') || name.includes('LessThan')) return 'max';
	if (name.includes('Length')) return 'length';
	if (name.includes('Regex')) return 'regex';
	if (name.includes('Email')) return 'email';
	if (name.includes('Url')) return 'url';
	if (name.includes('Uuid')) return 'uuid';
	if (name.includes('DateTime')) return 'datetime';
	if (name.includes('NumberFormat')) return 'number_format';
	return name.toLowerCase();
}

function getChecks(schema: ZodTypeAny): Array<ZodCheck> {
	const def = schema._def as {checks?: Array<ZodCheck>};
	return def.checks ?? [];
}

function extractStringConstraints(schema: ZodTypeAny): {
	minLength?: number;
	maxLength?: number;
	format?: string;
	pattern?: string;
} {
	const result: {minLength?: number; maxLength?: number; format?: string; pattern?: string} = {};
	const schemaAny = schema as {
		minLength?: number | null;
		maxLength?: number | null;
		format?: string | null;
		_regex?: RegExp;
	};
	if (schemaAny.minLength != null) result.minLength = schemaAny.minLength;
	if (schemaAny.maxLength != null) result.maxLength = schemaAny.maxLength;
	if (schemaAny.format != null) {
		if (schemaAny.format === 'url') {
			result.format = 'uri';
		} else if (schemaAny.format === 'datetime') {
			result.format = 'date-time';
		} else if (schemaAny.format !== 'regex') {
			result.format = schemaAny.format;
		}
	}
	if (schemaAny._regex != null) result.pattern = schemaAny._regex.source;
	return result;
}

function extractNumberConstraints(schema: ZodTypeAny): {
	minimum?: number;
	maximum?: number;
	isInt?: boolean;
	format?: string;
} {
	const checks = getChecks(schema);
	const result: {minimum?: number; maximum?: number; isInt?: boolean; format?: string} = {};
	for (const check of checks) {
		if (check.minValue != null) result.minimum = check.minValue;
		if (check.maxValue != null) result.maximum = check.maxValue;
		if (check.isInt === true) result.isInt = true;
		if (check.format != null) result.format = check.format;
	}
	return result;
}

function getDefaultValue(schema: ZodTypeAny): unknown {
	const def = schema._def as {defaultValue?: () => unknown};
	if (typeof def.defaultValue === 'function') {
		try {
			return def.defaultValue();
		} catch {
			return undefined;
		}
	}
	return undefined;
}

function getDescription(schema: ZodTypeAny): string | undefined {
	const schemaDesc = (schema as {description?: string}).description;
	if (schemaDesc) return schemaDesc;
	const def = schema._def as {description?: string} | undefined;
	return def?.description;
}

function getUserDescription(schema: ZodTypeAny): string | undefined {
	const description = getDescription(schema);
	const fluxer = parseFluxerTypeAnnotation(description);
	if (fluxer) return fluxer.userDescription;
	return description;
}

function getTupleItems(schema: ZodTypeAny): Array<ZodTypeAny> | undefined {
	const def = schema._def as {items?: Array<ZodTypeAny>};
	return def.items;
}

function getTupleRest(schema: ZodTypeAny): ZodTypeAny | undefined {
	const def = schema._def as {rest?: ZodTypeAny};
	return def.rest;
}

function getMapValueType(schema: ZodTypeAny): ZodTypeAny | undefined {
	const def = schema._def as {valueType?: ZodTypeAny};
	return def.valueType;
}

function getPromiseType(schema: ZodTypeAny): ZodTypeAny | undefined {
	const def = schema._def as unknown as {type?: ZodTypeAny};
	return def.type;
}

function getCatchValue(schema: ZodTypeAny): unknown {
	const def = schema._def as {catchValue?: unknown | (() => unknown)};
	if (typeof def.catchValue === 'function') {
		try {
			return def.catchValue();
		} catch {
			return undefined;
		}
	}
	return def.catchValue;
}

function isStringNumberIntUnion(options: Array<ZodTypeAny> | undefined): boolean {
	if (!options || options.length !== 2) return false;

	const hasString = options.some((o) => {
		const name = getZodTypeName(o);
		return name === 'ZodString' || name === 'string';
	});

	const hasIntNumber = options.some((o) => {
		const name = getZodTypeName(o);
		if (name === 'ZodNumber' || name === 'number') {
			const checks = getChecks(o);
			return checks.some((c) => {
				const kind = getCheckKind(c);
				return kind === 'int' || kind === 'integer' || c.isInt === true;
			});
		}
		return false;
	});

	return hasString && hasIntNumber;
}

function getRefForCustomTypeName(typeName: string): OpenAPISchemaOrRef | null {
	const registryRef = CustomSchemaType.getRef(typeName);
	if (registryRef) return registryRef;

	switch (typeName) {
		case 'SnowflakeType':
		case 'SnowflakeStringType':
			return SnowflakeTypeRef;
		case 'Int32Type':
			return Int32TypeRef;
		case 'Int64Type':
			return Int64TypeRef;
		case 'Int64StringType':
			return Int64StringTypeRef;
		case 'UnsignedInt64Type':
			return UnsignedInt64TypeRef;
		case 'UsernameType':
			return UsernameTypeRef;
		case 'EmailType':
			return EmailTypeRef;
		case 'PasswordType':
			return PasswordTypeRef;
		case 'PhoneNumberType':
			return PhoneNumberTypeRef;
		case 'Base64ImageType':
			return Base64ImageTypeRef;
		case 'Locale':
			return LocaleRef;
		default:
			return null;
	}
}

function getFluxerCustomTypeSchema(schema: ZodTypeAny, depth = 0): OpenAPISchemaOrRef | null {
	if (depth > 15) return null;

	const customType = getCustomType(schema);
	if (customType) {
		const ref = getRefForCustomTypeName(customType);
		if (ref) return ref;
	}

	const description = getDescription(schema);
	const fluxer = parseFluxerTypeAnnotation(description);
	if (fluxer) {
		const ref = getRefForCustomTypeName(fluxer.typeName);
		if (ref) return ref;

		if (fluxer.typeName === 'Int32Enum') {
			if (fluxer.bitflagTypeName) {
				const schemaName = fluxer.bitflagTypeName;
				if (!int32EnumSchemaRegistry.has(schemaName)) {
					const schema: OpenAPISchema = {type: 'integer', format: 'int32'};
					if (fluxer.enumEntries && fluxer.enumEntries.length > 0) {
						const enumValues = fluxer.enumEntries.map((entry) => entry.value);
						if (enumValues.every((value) => typeof value === 'number')) {
							schema.enum = enumValues as Array<number>;
							(schema as OpenAPISchema & Record<string, unknown>)['x-enumNames'] = fluxer.enumEntries.map(
								(e) => e.name,
							);
							const descriptions: Array<string | null> = fluxer.enumEntries.map((e) => e.description ?? null);
							if (descriptions.some((d) => d != null)) {
								(schema as OpenAPISchema & Record<string, unknown>)['x-enumDescriptions'] = descriptions;
							}
						}
					}
					if (fluxer.userDescription) {
						schema.description = fluxer.userDescription;
					}
					int32EnumSchemaRegistry.set(schemaName, schema);
				}
				if (fluxer.fieldDescription) {
					return {$ref: `#/components/schemas/${schemaName}`, description: fluxer.fieldDescription};
				}
				return {$ref: `#/components/schemas/${schemaName}`};
			}
			const result: OpenAPISchema = {type: 'integer', format: 'int32'};
			if (fluxer.enumEntries && fluxer.enumEntries.length > 0) {
				const enumValues = fluxer.enumEntries.map((entry) => entry.value);
				if (enumValues.every((value) => typeof value === 'number')) {
					result.enum = enumValues as Array<number>;
					(result as OpenAPISchema & Record<string, unknown>)['x-enumNames'] = fluxer.enumEntries.map((e) => e.name);
					const descriptions: Array<string | null> = fluxer.enumEntries.map((e) => e.description ?? null);
					if (descriptions.some((d) => d != null)) {
						(result as OpenAPISchema & Record<string, unknown>)['x-enumDescriptions'] = descriptions;
					}
				}
			}
			return result;
		}

		if (fluxer.typeName === 'Bitflags64') {
			if (fluxer.bitflagTypeName) {
				const schemaName = fluxer.bitflagTypeName;
				if (!bitflagSchemaRegistry.has(schemaName)) {
					const schema: OpenAPISchema = {type: 'string', format: 'int64', pattern: '^[0-9]+$'};
					if (fluxer.bitflagValues && fluxer.bitflagValues.length > 0) {
						(schema as OpenAPISchema & Record<string, unknown>)['x-bitflagValues'] = fluxer.bitflagValues;
					}
					if (fluxer.userDescription) {
						schema.description = fluxer.userDescription;
					}
					bitflagSchemaRegistry.set(schemaName, schema);
				}
				if (fluxer.fieldDescription) {
					return {$ref: `#/components/schemas/${schemaName}`, description: fluxer.fieldDescription};
				}
				return {$ref: `#/components/schemas/${schemaName}`};
			}
			const result: OpenAPISchema = {type: 'string', format: 'int64', pattern: '^[0-9]+$'};
			if (fluxer.bitflagValues && fluxer.bitflagValues.length > 0) {
				(result as OpenAPISchema & Record<string, unknown>)['x-bitflagValues'] = fluxer.bitflagValues;
			}
			return result;
		}

		if (fluxer.typeName === 'Bitflags32') {
			if (fluxer.bitflagTypeName) {
				const schemaName = fluxer.bitflagTypeName;
				if (!bitflagSchemaRegistry.has(schemaName)) {
					const schema: OpenAPISchema = {type: 'integer', format: 'int32', minimum: 0, maximum: 2147483647};
					if (fluxer.bitflagValues && fluxer.bitflagValues.length > 0) {
						(schema as OpenAPISchema & Record<string, unknown>)['x-bitflagValues'] = fluxer.bitflagValues;
					}
					if (fluxer.userDescription) {
						schema.description = fluxer.userDescription;
					}
					bitflagSchemaRegistry.set(schemaName, schema);
				}
				if (fluxer.fieldDescription) {
					return {$ref: `#/components/schemas/${schemaName}`, description: fluxer.fieldDescription};
				}
				return {$ref: `#/components/schemas/${schemaName}`};
			}
			const result: OpenAPISchema = {type: 'integer', format: 'int32', minimum: 0, maximum: 2147483647};
			if (fluxer.bitflagValues && fluxer.bitflagValues.length > 0) {
				(result as OpenAPISchema & Record<string, unknown>)['x-bitflagValues'] = fluxer.bitflagValues;
			}
			return result;
		}

		if (fluxer.typeName === 'Permissions') {
			if (fluxer.bitflagTypeName) {
				const schemaName = fluxer.bitflagTypeName;
				if (!bitflagSchemaRegistry.has(schemaName)) {
					const schema: OpenAPISchema = {type: 'string', format: 'int64', pattern: '^[0-9]+$'};
					if (fluxer.bitflagValues && fluxer.bitflagValues.length > 0) {
						(schema as OpenAPISchema & Record<string, unknown>)['x-bitflagValues'] = fluxer.bitflagValues;
					}
					if (fluxer.userDescription) {
						schema.description = fluxer.userDescription;
					}
					bitflagSchemaRegistry.set(schemaName, schema);
				}
				if (fluxer.fieldDescription) {
					return {$ref: `#/components/schemas/${schemaName}`, description: fluxer.fieldDescription};
				}
				return {$ref: `#/components/schemas/${schemaName}`};
			}
			const result: OpenAPISchema = {type: 'string', format: 'int64', pattern: '^[0-9]+$'};
			if (fluxer.bitflagValues && fluxer.bitflagValues.length > 0) {
				(result as OpenAPISchema & Record<string, unknown>)['x-bitflagValues'] = fluxer.bitflagValues;
			}
			return result;
		}

		const customSchema = FLUXER_CUSTOM_TYPES[fluxer.typeName];
		return customSchema ? {...customSchema} : null;
	}

	const zodTypeName = getZodTypeName(schema);

	if (zodTypeName === 'ZodEffects' || zodTypeName === 'effect' || zodTypeName === 'pipe') {
		const inner = getInnerType(schema);
		if (inner) {
			const innerType = getZodTypeName(inner);

			if (innerType === 'ZodUnion' || innerType === 'union') {
				const options = getOptions(inner);
				if (isStringNumberIntUnion(options)) {
					return SnowflakeTypeRef;
				}
			}

			const innerCustomSchema = getFluxerCustomTypeSchema(inner, depth + 1);
			if (innerCustomSchema) {
				return innerCustomSchema;
			}
		}
	}

	if (
		zodTypeName === 'ZodPipeline' ||
		zodTypeName === 'pipe' ||
		zodTypeName === 'ZodOptional' ||
		zodTypeName === 'optional' ||
		zodTypeName === 'ZodDefault' ||
		zodTypeName === 'default'
	) {
		const inner = getInnerType(schema);
		if (inner) {
			const innerCustomSchema = getFluxerCustomTypeSchema(inner, depth + 1);
			if (innerCustomSchema) {
				return innerCustomSchema;
			}
		}
	}

	return null;
}

function isSnowflakeType(schema: ZodTypeAny, depth = 0): boolean {
	if (depth > 10) return false;

	const customTypeSchema = getFluxerCustomTypeSchema(schema, depth);
	if (customTypeSchema === SnowflakeTypeRef) {
		return true;
	}

	const zodTypeName = getZodTypeName(schema);
	if (
		zodTypeName === 'ZodEffects' ||
		zodTypeName === 'effect' ||
		zodTypeName === 'ZodPipeline' ||
		zodTypeName === 'pipe'
	) {
		const inner = getInnerType(schema);
		if (inner) {
			return isSnowflakeType(inner, depth + 1);
		}
	}

	return false;
}

function isSchemaOptional(schema: ZodTypeAny, depth = 0): boolean {
	if (depth > 10) return false;

	const typeName = getZodTypeName(schema);

	if (typeName === 'ZodOptional' || typeName === 'optional') {
		return true;
	}

	if (typeName === 'ZodDefault' || typeName === 'default') {
		return true;
	}

	if (typeName === 'ZodNullable' || typeName === 'nullable') {
		const inner = getInnerType(schema);
		if (inner) {
			return isSchemaOptional(inner, depth + 1);
		}
	}

	if (typeName === 'ZodEffects' || typeName === 'effect' || typeName === 'ZodPipeline' || typeName === 'pipe') {
		const inner = getInnerType(schema);
		if (inner) {
			return isSchemaOptional(inner, depth + 1);
		}
	}

	return false;
}

function addDescription(result: OpenAPISchemaOrRef, schema: ZodTypeAny): OpenAPISchemaOrRef {
	if ('$ref' in result) {
		return result;
	}
	const description = getUserDescription(schema);
	if (description) {
		result.description = description;
	}
	return result;
}

function isOpenAPISchema(schema: OpenAPISchemaOrRef): schema is OpenAPISchema {
	return !('$ref' in schema);
}

function makeNullableSchema(inner: OpenAPISchemaOrRef): OpenAPISchema {
	if (isOpenAPISchema(inner)) {
		const keys = Object.keys(inner).filter((k) => k !== 'description');
		if (inner.oneOf && keys.length === 1) {
			const result: OpenAPISchema = {oneOf: [...inner.oneOf, {type: 'null'}]};
			if (inner.description) result.description = inner.description;
			return result;
		}
		if (inner.anyOf && keys.length === 1) {
			const result: OpenAPISchema = {anyOf: [...inner.anyOf, {type: 'null'}]};
			if (inner.description) result.description = inner.description;
			return result;
		}
	}
	return {
		anyOf: [inner, {type: 'null'}],
	};
}

export function zodToOpenAPISchema(schema: ZodTypeAny, depth = 0): OpenAPISchemaOrRef {
	if (depth > 20) {
		return {type: 'object'};
	}

	const schemaName = getSchemaName(schema);
	if (schemaName && depth > 0) {
		return {$ref: `#/components/schemas/${schemaName}`};
	}

	const customTypeSchema = getFluxerCustomTypeSchema(schema);
	if (customTypeSchema) {
		return addDescription(customTypeSchema, schema);
	}

	const typeName = getZodTypeName(schema);

	switch (typeName) {
		case 'ZodString':
		case 'string': {
			const result: OpenAPISchema = {type: 'string'};
			const strConstraints = extractStringConstraints(schema);
			if (strConstraints.minLength != null) result.minLength = strConstraints.minLength;
			if (strConstraints.maxLength != null) result.maxLength = strConstraints.maxLength;
			if (strConstraints.format != null) result.format = strConstraints.format;
			if (strConstraints.pattern != null) result.pattern = strConstraints.pattern;
			const checks = getChecks(schema);
			for (const check of checks) {
				const v4Def = check._zod?.def;
				const kind = getCheckKind(check);
				if (kind === 'min') {
					const val = typeof check.value === 'number' ? check.value : check.minimum;
					const v4Val = v4Def?.minimum;
					if (typeof val === 'number') {
						result.minLength = val;
					} else if (typeof v4Val === 'number') {
						result.minLength = v4Val;
					}
				}
				if (kind === 'max') {
					const val = typeof check.value === 'number' ? check.value : check.maximum;
					const v4Val = v4Def?.maximum;
					if (typeof val === 'number') {
						result.maxLength = val;
					} else if (typeof v4Val === 'number') {
						result.maxLength = v4Val;
					}
				}
				if (kind === 'length' && typeof check.value === 'number') {
					result.minLength = check.value;
					result.maxLength = check.value;
				}
				if (kind === 'email') {
					result.format = 'email';
				}
				if (kind === 'url') {
					result.format = 'uri';
				}
				if (kind === 'uuid') {
					result.format = 'uuid';
				}
				if (kind === 'cuid') {
					result.format = 'cuid';
				}
				if (kind === 'cuid2') {
					result.format = 'cuid2';
				}
				if (kind === 'ulid') {
					result.format = 'ulid';
				}
				if (kind === 'datetime' || kind === 'date') {
					result.format = 'date-time';
				}
				if (kind === 'time') {
					result.format = 'time';
				}
				if (kind === 'duration') {
					result.format = 'duration';
				}
				if (kind === 'ip') {
					result.format = 'ip';
				}
				if (kind === 'base64') {
					result.format = 'byte';
				}
				if (kind === 'regex') {
					const regex = check.regex ?? check.value;
					if (regex instanceof RegExp) {
						result.pattern = regex.source;
					} else if (v4Def?.pattern instanceof RegExp) {
						result.pattern = v4Def.pattern.source;
					}
				}
				if (kind === 'includes' && typeof check.value === 'string') {
					result.pattern = `.*${escapeRegex(check.value)}.*`;
				}
				if (kind === 'startsWith' && typeof check.value === 'string') {
					result.pattern = `^${escapeRegex(check.value)}.*`;
				}
				if (kind === 'endsWith' && typeof check.value === 'string') {
					result.pattern = `.*${escapeRegex(check.value)}$`;
				}
				if ((kind === 'includes' || kind === 'startsWith' || kind === 'endsWith') && v4Def?.pattern instanceof RegExp) {
					result.pattern = v4Def.pattern.source;
				}
			}
			return addDescription(result, schema);
		}

		case 'ZodNumber':
		case 'number': {
			const result: OpenAPISchema = {type: 'number'};
			const numConstraints = extractNumberConstraints(schema);
			if (numConstraints.isInt) {
				result.type = 'integer';
			}
			if (numConstraints.minimum != null) {
				result.minimum = numConstraints.minimum;
			}
			if (numConstraints.maximum != null) {
				result.maximum = numConstraints.maximum;
			}
			const checks = getChecks(schema);
			for (const check of checks) {
				const v4Def = check._zod?.def;
				const kind = getCheckKind(check);
				if (kind === 'int' || kind === 'number_format') {
					if (check.isInt) result.type = 'integer';
				}
				if (kind === 'min') {
					const val = typeof check.value === 'number' ? check.value : check.minimum;
					if (typeof val === 'number') {
						result.minimum = val;
						if (check.inclusive === false) {
							result.exclusiveMinimum = val;
							delete result.minimum;
						}
					} else if (typeof v4Def?.value === 'number') {
						result.minimum = v4Def.value;
						if (v4Def.inclusive === false) {
							result.exclusiveMinimum = v4Def.value;
							delete result.minimum;
						}
					}
				}
				if (kind === 'max') {
					const val = typeof check.value === 'number' ? check.value : check.maximum;
					if (typeof val === 'number') {
						result.maximum = val;
						if (check.inclusive === false) {
							result.exclusiveMaximum = val;
							delete result.maximum;
						}
					} else if (typeof v4Def?.value === 'number') {
						result.maximum = v4Def.value;
						if (v4Def.inclusive === false) {
							result.exclusiveMaximum = v4Def.value;
							delete result.maximum;
						}
					}
				}
				if (kind === 'multipleOf' && typeof check.value === 'number') {
					result.multipleOf = check.value;
				} else if (kind === 'multipleOf' && typeof v4Def?.value === 'number') {
					result.multipleOf = v4Def.value;
				}
				if (kind === 'finite') {
					result.format = 'double';
				}
			}
			const SAFE_INT_MIN = Number.MIN_SAFE_INTEGER;
			const SAFE_INT_MAX = Number.MAX_SAFE_INTEGER;

			if (
				(result.minimum ?? result.exclusiveMinimum) === SAFE_INT_MIN &&
				(result.maximum ?? result.exclusiveMaximum) === SAFE_INT_MAX
			) {
				result.minimum = undefined;
				result.maximum = undefined;
				result.exclusiveMinimum = undefined;
				result.exclusiveMaximum = undefined;
			}

			if (result.type === 'integer') {
				const min = result.minimum ?? result.exclusiveMinimum;
				const max = result.maximum ?? result.exclusiveMaximum;
				if (min != null && max != null) {
					result.format = min >= -2147483648 && max <= 2147483647 ? 'int32' : 'int64';
				} else if (min == null && max == null) {
					result.format = 'int53';
				} else {
					result.format = 'int64';
				}
			}

			const description = getDescription(schema);
			const fluxer = parseFluxerTypeAnnotation(description);
			if (fluxer?.typeName === 'EnumValues' && fluxer.enumEntries && fluxer.enumEntries.length > 0) {
				const enumValues = fluxer.enumEntries.map((entry) => entry.value);
				if (enumValues.every((value) => typeof value === 'number')) {
					result.enum = enumValues as Array<number>;
					(result as OpenAPISchema & Record<string, unknown>)['x-enumNames'] = fluxer.enumEntries.map((e) => e.name);
					const descriptions: Array<string | null> = fluxer.enumEntries.map((e) => e.description ?? null);
					if (descriptions.some((d) => d != null)) {
						(result as OpenAPISchema & Record<string, unknown>)['x-enumDescriptions'] = descriptions;
					}
				}
			}

			return addDescription(result, schema);
		}

		case 'ZodBoolean':
		case 'boolean':
			return addDescription({type: 'boolean'}, schema);

		case 'ZodArray':
		case 'array': {
			const itemType = getArrayType(schema);
			const result: OpenAPISchema = {
				type: 'array',
				items: itemType ? zodToOpenAPISchema(itemType, depth + 1) : {type: 'string'},
			};
			const checks = getChecks(schema);
			for (const check of checks) {
				const kind = getCheckKind(check);
				const v4Def = check._zod?.def;
				if (kind === 'min') {
					const val = typeof check.value === 'number' ? check.value : (check.minimum ?? v4Def?.minimum);
					if (typeof val === 'number') {
						result.minItems = val;
					}
				}
				if (kind === 'max') {
					const val = typeof check.value === 'number' ? check.value : (check.maximum ?? v4Def?.maximum);
					if (typeof val === 'number') {
						result.maxItems = val;
					}
				}
				if (kind === 'length') {
					const val = typeof check.value === 'number' ? check.value : v4Def?.value;
					if (typeof val === 'number') {
						result.minItems = val;
						result.maxItems = val;
					}
				}
			}
			return addDescription(result, schema);
		}

		case 'ZodSet':
		case 'set': {
			const def = schema._def as {valueType?: ZodTypeAny; minSize?: {value: number}; maxSize?: {value: number}};
			const result: OpenAPISchema = {
				type: 'array',
				uniqueItems: true,
				items: def.valueType ? zodToOpenAPISchema(def.valueType, depth + 1) : {type: 'string'},
			};
			if (def.minSize?.value != null) {
				result.minItems = def.minSize.value;
			}
			if (def.maxSize?.value != null) {
				result.maxItems = def.maxSize.value;
			}
			return addDescription(result, schema);
		}

		case 'ZodObject':
		case 'object': {
			const shape = getShape(schema);
			if (!shape) {
				return {type: 'object'};
			}

			const properties: Record<string, OpenAPISchemaOrRef> = {};
			const required: Array<string> = [];

			for (const [key, value] of Object.entries(shape)) {
				properties[key] = zodToOpenAPISchema(value, depth + 1);

				if (!isSchemaOptional(value)) {
					required.push(key);
				}
			}

			const result: OpenAPISchema = {
				type: 'object',
				properties,
			};

			if (required.length > 0) {
				result.required = required;
			}

			return addDescription(result, schema);
		}

		case 'ZodOptional':
		case 'optional': {
			const inner = getInnerType(schema);
			if (inner) {
				const innerSchema = zodToOpenAPISchema(inner, depth + 1);
				return addDescription(innerSchema, schema);
			}
			return {};
		}

		case 'ZodNullable':
		case 'nullable': {
			const inner = getInnerType(schema);
			if (inner) {
				const innerSchema = zodToOpenAPISchema(inner, depth + 1);
				return addDescription(makeNullableSchema(innerSchema), schema);
			}
			return {type: 'null'};
		}

		case 'ZodDefault':
		case 'default': {
			const inner = getInnerType(schema);
			const defaultValue = getDefaultValue(schema);
			if (inner) {
				const innerSchema = zodToOpenAPISchema(inner, depth + 1);
				if (defaultValue !== undefined) {
					if (!('$ref' in innerSchema)) {
						innerSchema.default = defaultValue;
					}
				}
				return addDescription(innerSchema, schema);
			}
			return {};
		}

		case 'ZodUnion':
		case 'union': {
			const options = getOptions(schema);
			if (!options || options.length === 0) {
				return {};
			}

			const description = getDescription(schema);
			const fluxer = parseFluxerTypeAnnotation(description);

			if (fluxer?.typeName === 'FlexibleEnumValues' && fluxer.enumEntries && fluxer.enumEntries.length > 0) {
				const result: OpenAPISchema = {type: 'string'};
				(result as OpenAPISchema & Record<string, unknown>)['x-enumNames'] = fluxer.enumEntries.map((e) => e.name);
				const descriptions: Array<string | null> = fluxer.enumEntries.map((e) => e.description ?? null);
				if (descriptions.some((d) => d != null)) {
					(result as OpenAPISchema & Record<string, unknown>)['x-enumDescriptions'] = descriptions;
				}
				const knownValues = fluxer.enumEntries.map((e) => String(e.value)).join(', ');
				const baseDescription = fluxer.userDescription ?? '';
				result.description = baseDescription
					? `${baseDescription} Known values: ${knownValues} (other values allowed)`
					: `Known values: ${knownValues} (other values allowed)`;
				return result;
			}

			const allLiterals = options.every((opt) => {
				const name = getZodTypeName(opt);
				return name === 'ZodLiteral' || name === 'literal';
			});
			if (allLiterals) {
				const literalValues = options.map((opt) => getLiteralValues(opt));
				if (literalValues.every((vals) => Array.isArray(vals) && vals.length > 0)) {
					const flattened = literalValues.flatMap((vals) => vals ?? []);
					const literalSchema = getLiteralSchema(flattened);
					const fluxerForLiterals = parseFluxerTypeAnnotation(description);
					if (
						fluxerForLiterals?.typeName === 'EnumValues' &&
						fluxerForLiterals.enumNames &&
						fluxerForLiterals.enumNames.length === flattened.length
					) {
						(literalSchema as OpenAPISchema & Record<string, unknown>)['x-enumNames'] = fluxerForLiterals.enumNames;
						if (fluxerForLiterals.enumEntries && fluxerForLiterals.enumEntries.length === flattened.length) {
							const descriptions: Array<string | null> = [];
							for (let i = 0; i < flattened.length; i++) {
								const literalValue = flattened[i];
								const entry = fluxerForLiterals.enumEntries[i];
								if (entry && (entry.value === literalValue || String(entry.value) === String(literalValue))) {
									descriptions.push(entry.description ?? null);
								} else {
									descriptions.push(null);
								}
							}
							(literalSchema as OpenAPISchema & Record<string, unknown>)['x-enumDescriptions'] = descriptions;
						}
					}
					return addDescription(literalSchema, schema);
				}
			}

			return addDescription(
				{
					oneOf: options.map((opt) => zodToOpenAPISchema(opt, depth + 1)),
				},
				schema,
			);
		}

		case 'ZodDiscriminatedUnion':
		case 'discriminatedUnion': {
			const def = schema._def as {
				discriminator?: string;
				options?: Map<unknown, ZodTypeAny> | Array<ZodTypeAny>;
			};
			const discriminator = def.discriminator;

			let optionsArray: Array<ZodTypeAny>;
			let discriminatorValues: Array<unknown> = [];
			if (def.options instanceof Map) {
				discriminatorValues = Array.from(def.options.keys());
				optionsArray = Array.from(def.options.values());
			} else if (Array.isArray(def.options)) {
				optionsArray = def.options;
			} else {
				return {type: 'object'};
			}

			if (optionsArray.length === 0) {
				return {type: 'object'};
			}

			const schemas = optionsArray.map((opt) => zodToOpenAPISchema(opt, depth + 1));

			if (discriminator) {
				const result: OpenAPISchema = {
					oneOf: schemas,
					discriminator: {
						propertyName: discriminator,
					},
				};

				if (discriminatorValues.length > 0 && discriminatorValues.length === schemas.length) {
					const mapping: Record<string, string> = {};
					for (let i = 0; i < discriminatorValues.length; i++) {
						const value = discriminatorValues[i];
						if (typeof value === 'string' || typeof value === 'number') {
							const schemaObj = schemas[i];
							if (isOpenAPISchema(schemaObj) && schemaObj.properties?.[discriminator]) {
								mapping[String(value)] = `#/components/schemas/Option${i}`;
							}
						}
					}
					if (Object.keys(mapping).length > 0) {
						result.discriminator!.mapping = mapping;
					}
				}

				return addDescription(result, schema);
			}

			return addDescription(
				{
					oneOf: schemas,
				},
				schema,
			);
		}

		case 'ZodLiteral':
		case 'literal': {
			const values = getLiteralValues(schema);
			if (values && values.length > 0) {
				if (values.length === 1 && values[0] === null) {
					return addDescription({type: 'null'}, schema);
				}
				const literalSchema = getLiteralSchema(values);
				const description = getDescription(schema);
				const fluxer = parseFluxerTypeAnnotation(description);
				if (fluxer?.typeName === 'EnumValue' && fluxer.enumNames && fluxer.enumNames.length > 0) {
					(literalSchema as OpenAPISchema & Record<string, unknown>)['x-enumNames'] = fluxer.enumNames;
					if (fluxer.enumEntries && fluxer.enumEntries.length > 0 && fluxer.enumEntries[0].description) {
						(literalSchema as OpenAPISchema & Record<string, unknown>)['x-enumDescriptions'] = [
							fluxer.enumEntries[0].description,
						];
					}
				}
				return addDescription(literalSchema, schema);
			}
			return {};
		}

		case 'ZodEnum':
		case 'enum': {
			const info = getEnumInfo(schema);
			if (!info) {
				return addDescription({type: 'string', enum: []}, schema);
			}
			return addDescription(buildEnumSchemaFromInfo(info), schema);
		}

		case 'ZodEffects':
		case 'effect': {
			const inner = getInnerType(schema);
			if (inner) {
				const innerSchema = zodToOpenAPISchema(inner, depth + 1);
				return addDescription(innerSchema, schema);
			}
			return {};
		}

		case 'pipe':
		case 'ZodPipeline': {
			const def = schema._def as {in?: ZodTypeAny; out?: ZodTypeAny};
			const outType = def.out ? getZodTypeName(def.out) : undefined;
			const target = outType === 'transform' || outType === 'ZodTransform' ? def.in : (def.out ?? def.in);
			if (target) {
				const innerSchema = zodToOpenAPISchema(target, depth + 1);
				return addDescription(innerSchema, schema);
			}
			return {};
		}

		case 'ZodIntersection':
		case 'intersection': {
			const def = schema._def as {left?: ZodTypeAny; right?: ZodTypeAny};
			const schemas: Array<OpenAPISchemaOrRef> = [];
			if (def.left) {
				schemas.push(zodToOpenAPISchema(def.left, depth + 1));
			}
			if (def.right) {
				schemas.push(zodToOpenAPISchema(def.right, depth + 1));
			}
			if (schemas.length === 0) {
				return {};
			}
			if (schemas.length === 1) {
				return addDescription(schemas[0], schema);
			}
			return addDescription({allOf: schemas}, schema);
		}

		case 'ZodRecord':
		case 'record': {
			const def = schema._def as {valueType?: ZodTypeAny; keyType?: ZodTypeAny};
			const result: OpenAPISchema = {
				type: 'object',
				additionalProperties: def.valueType ? zodToOpenAPISchema(def.valueType, depth + 1) : true,
			};

			if (def.keyType && isSnowflakeType(def.keyType)) {
				result.patternProperties = {
					'^(0|[1-9][0-9]*)$': def.valueType ? zodToOpenAPISchema(def.valueType, depth + 1) : true,
				};
				(result as OpenAPISchema & Record<string, unknown>)['x-keyType'] = 'snowflake';
			}

			return addDescription(result, schema);
		}

		case 'ZodAny':
		case 'any':
			return addDescription(getJsonValueSchema(), schema);

		case 'ZodUnknown':
		case 'unknown':
			return addDescription(getJsonValueSchema(), schema);

		case 'ZodVoid':
		case 'void':
			return addDescription({}, schema);

		case 'ZodNull':
		case 'null':
			return addDescription({type: 'null'}, schema);

		case 'ZodUndefined':
		case 'undefined':
			return addDescription({}, schema);

		case 'ZodBigInt':
		case 'bigint':
			return addDescription({type: 'string', format: 'int64'}, schema);

		case 'ZodDate':
		case 'date':
			return addDescription({type: 'string', format: 'date-time'}, schema);

		case 'ZodIso':
		case 'ZodIsoDateTime':
		case 'ZodIsoDate':
		case 'ZodIsoTime':
		case 'iso': {
			const def = schema._def as {isoType?: string; type?: string; kind?: string};
			const isoType = def.isoType ?? def.type ?? def.kind;
			if (isoType === 'date') {
				return addDescription({type: 'string', format: 'date'}, schema);
			}
			if (isoType === 'time') {
				return addDescription({type: 'string', format: 'time'}, schema);
			}
			return addDescription({type: 'string', format: 'date-time'}, schema);
		}

		case 'ZodUrl':
		case 'url':
			return addDescription({type: 'string', format: 'uri'}, schema);

		case 'ZodLazy':
		case 'lazy': {
			const def = schema._def as {getter?: () => ZodTypeAny};
			if (def.getter) {
				try {
					const inner = def.getter();
					const innerSchema = zodToOpenAPISchema(inner, depth + 1);
					return addDescription(innerSchema, schema);
				} catch {
					return {type: 'object'};
				}
			}
			return {type: 'object'};
		}

		case 'ZodTuple':
		case 'tuple': {
			const tupleItems = getTupleItems(schema);
			const rest = getTupleRest(schema);

			if (!tupleItems || tupleItems.length === 0) {
				const result: OpenAPISchema = {type: 'array', items: {}};
				if (rest) {
					result.items = zodToOpenAPISchema(rest, depth + 1);
				}
				return addDescription(result, schema);
			}

			const prefixItems = tupleItems.map((item) => zodToOpenAPISchema(item, depth + 1));
			const result: OpenAPISchema = {
				type: 'array',
				prefixItems,
				minItems: tupleItems.length,
				maxItems: rest ? undefined : tupleItems.length,
			};

			if (rest) {
				result.items = zodToOpenAPISchema(rest, depth + 1);
			} else {
				result.items = false;
			}

			return addDescription(result, schema);
		}

		case 'ZodMap':
		case 'map': {
			const valueType = getMapValueType(schema);
			const result: OpenAPISchema = {
				type: 'object',
				additionalProperties: valueType ? zodToOpenAPISchema(valueType, depth + 1) : true,
			};
			return addDescription(result, schema);
		}

		case 'ZodPromise':
		case 'promise': {
			const promiseType = getPromiseType(schema);
			if (promiseType) {
				const innerSchema = zodToOpenAPISchema(promiseType, depth + 1);
				return addDescription(innerSchema, schema);
			}
			return addDescription({}, schema);
		}

		case 'ZodFunction':
		case 'function':
			return addDescription({}, schema);

		case 'ZodNaN':
		case 'nan':
			return addDescription({type: 'number'}, schema);

		case 'ZodNever':
		case 'never':
			return {not: {}};

		case 'ZodSymbol':
		case 'symbol':
			return addDescription({type: 'string'}, schema);

		case 'ZodBranded':
		case 'branded': {
			const inner = getInnerType(schema);
			if (inner) {
				const innerSchema = zodToOpenAPISchema(inner, depth + 1);
				return addDescription(innerSchema, schema);
			}
			return addDescription({}, schema);
		}

		case 'ZodCatch':
		case 'catch': {
			const inner = getInnerType(schema);
			const catchValue = getCatchValue(schema);
			if (inner) {
				const innerSchema = zodToOpenAPISchema(inner, depth + 1);
				if (catchValue !== undefined) {
					if (!('$ref' in innerSchema)) {
						innerSchema.default = catchValue;
					}
				}
				return addDescription(innerSchema, schema);
			}
			return addDescription({}, schema);
		}

		case 'ZodReadonly':
		case 'readonly': {
			const inner = getInnerType(schema);
			if (inner) {
				const innerSchema = zodToOpenAPISchema(inner, depth + 1);
				return addDescription(innerSchema, schema);
			}
			return addDescription({}, schema);
		}

		case 'ZodNativeEnum':
		case 'nativeEnum': {
			const info = getEnumInfo(schema);
			if (!info) {
				return addDescription({}, schema);
			}
			return addDescription(buildEnumSchemaFromInfo(info), schema);
		}

		case 'ZodTemplateLiteral':
		case 'templateLiteral': {
			const def = schema._def as {pattern?: RegExp};
			const result: OpenAPISchema = {type: 'string'};
			if (def.pattern) {
				result.pattern = def.pattern.source;
			}
			return addDescription(result, schema);
		}

		case 'ZodEmail':
		case 'email':
			return addDescription({type: 'string', format: 'email'}, schema);

		case 'ZodUuid':
		case 'uuid':
			return addDescription({type: 'string', format: 'uuid'}, schema);

		case 'ZodCuid':
		case 'cuid':
			return addDescription({type: 'string', format: 'cuid'}, schema);

		case 'ZodCuid2':
		case 'cuid2':
			return addDescription({type: 'string', format: 'cuid2'}, schema);

		case 'ZodUlid':
		case 'ulid':
			return addDescription({type: 'string', format: 'ulid'}, schema);

		case 'ZodIp':
		case 'ip':
			return addDescription({type: 'string', format: 'ip'}, schema);

		case 'ZodBase64':
		case 'base64':
			return addDescription({type: 'string', format: 'byte'}, schema);

		case 'ZodDuration':
		case 'duration':
			return addDescription({type: 'string', format: 'duration'}, schema);

		default:
			return addDescription({type: 'object'}, schema);
	}
}

export const FLUXER_CUSTOM_TYPES: Record<string, OpenAPISchema> = {
	Int64Type: {type: 'string', format: 'int64', pattern: '^-?[0-9]+$'},
	Int64StringType: {type: 'string', format: 'int64', pattern: '^-?[0-9]+$'},
	UnsignedInt64Type: {type: 'string', format: 'int64', pattern: '^[0-9]+$'},
	PermissionStringType: {type: 'string', format: 'int64', pattern: '^[0-9]+$'},
	BitflagStringType: {type: 'string', format: 'int64', pattern: '^[0-9]+$'},
	ColorType: {type: 'integer', minimum: 0, maximum: 16777215, format: 'int32'},
	Int32Type: {type: 'integer', minimum: 0, maximum: 2147483647, format: 'int32'},
	EmailType: {type: 'string', format: 'email'},
	PasswordType: {type: 'string', minLength: 8, maxLength: 256},
	UsernameType: {type: 'string', minLength: 1, maxLength: 32, pattern: '^[a-zA-Z0-9_]+$'},
	PhoneNumberType: {type: 'string', pattern: '^\\+[1-9]\\d{1,14}$'},
	URLType: {type: 'string', format: 'uri'},
	QueryBooleanType: {type: 'boolean'},
	DateTimeType: {type: 'string', format: 'date-time'},
	SnowflakeType: {
		type: 'string',
		format: 'snowflake',
		pattern: '^(0|[1-9][0-9]*)$',
	},
	SnowflakeStringType: {
		type: 'string',
		format: 'snowflake',
		pattern: '^(0|[1-9][0-9]*)$',
	},
};

export function getCustomTypeSchema(typeName: string): OpenAPISchema | null {
	return FLUXER_CUSTOM_TYPES[typeName] ?? null;
}

export function getRegisteredBitflagSchemas(): Record<string, OpenAPISchema> {
	const result: Record<string, OpenAPISchema> = {};
	for (const [name, schema] of bitflagSchemaRegistry) {
		result[name] = schema;
	}
	return result;
}

export function getRegisteredInt32EnumSchemas(): Record<string, OpenAPISchema> {
	const result: Record<string, OpenAPISchema> = {};
	for (const [name, schema] of int32EnumSchemaRegistry) {
		result[name] = schema;
	}
	return result;
}

export function clearBitflagSchemaRegistry(): void {
	bitflagSchemaRegistry.clear();
}

export function clearInt32EnumSchemaRegistry(): void {
	int32EnumSchemaRegistry.clear();
}
