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
import {escapeTableText, formatDefault, readJsonFile, toAnchor, wrapCode, writeFile} from './shared.mjs';

function buildDefMap(schema) {
	return schema.$defs ?? {};
}

function formatType(propSchema, defs) {
	if (!propSchema || typeof propSchema !== 'object') {
		return 'unknown';
	}

	if (propSchema.$ref) {
		const refName = propSchema.$ref.split('/').pop();
		return `[${refName}](#${toAnchor(refName)})`;
	}

	if (propSchema.enum) {
		const values = propSchema.enum.map((v) => wrapCode(v)).join(', ');
		return `enum&lt;${values}&gt;`;
	}

	if (propSchema.type === 'array') {
		const items = propSchema.items;
		if (items) {
			const itemType = formatType(items, defs);
			return `array&lt;${itemType}&gt;`;
		}
		return 'array';
	}

	if (propSchema.type === 'object') {
		if (propSchema.properties && Object.keys(propSchema.properties).length > 0) {
			return 'object';
		}
		if (propSchema.additionalProperties) {
			return 'object';
		}
		return 'object';
	}

	if (propSchema.type) {
		return propSchema.type;
	}

	return 'unknown';
}

/**
 * Format field name with optional indicator.
 * Appends ? suffix when the field is not required.
 */
function formatFieldName(name, isRequired) {
	return isRequired ? name : `${name}?`;
}

/**
 * Build description with default value if present.
 */
function buildDescription(propSchema) {
	let desc = escapeTableText(propSchema.description ?? '');
	const defaultVal = formatDefault(propSchema.default);
	if (defaultVal) {
		if (desc) {
			desc += ` Default: ${defaultVal}`;
		} else {
			desc = `Default: ${defaultVal}`;
		}
	}
	return desc;
}

function renderPropertyTable(properties, requiredSet, defs) {
	if (!properties || Object.keys(properties).length === 0) {
		return '';
	}

	const propNames = Object.keys(properties).sort((a, b) => a.localeCompare(b));
	let out = '';
	out += '| Property | Type | Description |\n';
	out += '|----------|------|-------------|\n';

	for (const propName of propNames) {
		const propSchema = properties[propName];
		const type = formatType(propSchema, defs);
		const isRequired = requiredSet.has(propName);
		const fieldName = formatFieldName(propName, isRequired);
		const description = buildDescription(propSchema);
		out += `| ${fieldName} | ${type} | ${description} |\n`;
	}

	out += '\n';
	return out;
}

function renderConditionalNote(schema) {
	if (!schema.if || !schema.then) {
		return '';
	}

	let out = '';
	const condition = schema.if;
	const thenClause = schema.then;

	const conditionParts = new Set();
	const keysWithExplicitCondition = new Set();
	if (condition.properties) {
		for (const [key, val] of Object.entries(condition.properties)) {
			if (val.const !== undefined) {
				conditionParts.add(`${wrapCode(key)} = ${wrapCode(val.const)}`);
				keysWithExplicitCondition.add(key);
				continue;
			}
			if (val.properties) {
				for (const [subKey, subVal] of Object.entries(val.properties)) {
					if (subVal.const !== undefined) {
						conditionParts.add(`${wrapCode(`${key}.${subKey}`)} = ${wrapCode(subVal.const)}`);
						keysWithExplicitCondition.add(key);
					}
				}
			}
		}
	}
	if (condition.required) {
		for (const requiredKey of condition.required) {
			if (!keysWithExplicitCondition.has(requiredKey)) {
				conditionParts.add(`${wrapCode(requiredKey)} is present`);
			}
		}
	}
	const conditionText = Array.from(conditionParts).join(' and ');

	let requiredProps = [];
	if (thenClause.required) {
		requiredProps = thenClause.required;
	}
	if (thenClause.properties) {
		for (const [key, val] of Object.entries(thenClause.properties)) {
			if (val.required) {
				for (const req of val.required) {
					requiredProps.push(`${key}.${req}`);
				}
			}
		}
	}

	if (conditionText && requiredProps.length > 0) {
		const requiredList = requiredProps.map((p) => wrapCode(p)).join(', ');
		out += `<Note>\nWhen ${conditionText}, the following properties are required: ${requiredList}\n</Note>\n\n`;
	}

	return out;
}

function renderJsonExample(_sectionPath, properties, requiredSet, _defs) {
	if (!properties || Object.keys(properties).length === 0) {
		return '';
	}

	const exampleObj = {};

	const propNames = Object.keys(properties).sort((a, b) => {
		const aRequired = requiredSet.has(a) ? 0 : 1;
		const bRequired = requiredSet.has(b) ? 0 : 1;
		if (aRequired !== bRequired) return aRequired - bRequired;
		return a.localeCompare(b);
	});

	for (const propName of propNames) {
		const propSchema = properties[propName];

		if (propSchema.$ref) {
			continue;
		}

		if (propSchema.type === 'object' && propSchema.properties) {
			continue;
		}

		const isRequired = requiredSet.has(propName);
		let exampleValue;

		if (propSchema.default !== undefined) {
			exampleValue = propSchema.default;
		} else if (propSchema.enum) {
			exampleValue = propSchema.enum[0];
		} else if (propSchema.type === 'string') {
			exampleValue = isRequired ? `your_${propName}` : '';
		} else if (propSchema.type === 'number') {
			exampleValue = 0;
		} else if (propSchema.type === 'boolean') {
			exampleValue = false;
		} else if (propSchema.type === 'array') {
			exampleValue = [];
		} else {
			continue;
		}

		exampleObj[propName] = exampleValue;
	}

	if (Object.keys(exampleObj).length === 0) {
		return '';
	}

	const jsonStr = JSON.stringify(exampleObj, null, 2);

	let out = '<Expandable title="Example JSON">\n';
	out += '```json\n';
	out += jsonStr;
	out += '\n```\n';
	out += '</Expandable>\n\n';

	return out;
}

function renderDefinition(defName, defSchema, defs, jsonPath) {
	let out = '';

	out += `### ${defName}\n\n`;

	if (jsonPath) {
		out += `JSON path: ${wrapCode(jsonPath)}\n\n`;
	}

	if (defSchema.description) {
		out += `${defSchema.description}\n\n`;
	}

	const requiredSet = new Set(defSchema.required ?? []);

	out += renderConditionalNote(defSchema);

	if (defSchema.properties) {
		out += renderPropertyTable(defSchema.properties, requiredSet, defs);
		out += renderJsonExample(jsonPath, defSchema.properties, requiredSet, defs);
	}

	return out;
}

function renderNestedDefinitions(_defName, defSchema, defs, parentPath, rendered) {
	let out = '';

	if (!defSchema.properties) {
		return out;
	}

	for (const [propName, propSchema] of Object.entries(defSchema.properties)) {
		if (propSchema.$ref) {
			const refName = propSchema.$ref.split('/').pop();
			if (rendered.has(refName)) {
				continue;
			}
			const refSchema = defs[refName];
			if (refSchema) {
				const nestedPath = parentPath ? `${parentPath}.${propName}` : propName;
				rendered.add(refName);
				out += renderDefinition(refName, refSchema, defs, nestedPath);
				out += renderNestedDefinitions(refName, refSchema, defs, nestedPath, rendered);
			}
		} else if (propSchema.type === 'object' && propSchema.properties) {
			const _nestedPath = parentPath ? `${parentPath}.${propName}` : propName;
			const syntheticName = propName;
			out += `#### ${syntheticName}\n\n`;
			if (propSchema.description) {
				out += `${propSchema.description}\n\n`;
			}
			const requiredSet = new Set(propSchema.required ?? []);
			out += renderPropertyTable(propSchema.properties, requiredSet, defs);
		}
	}

	return out;
}

function renderTableOfContents(schema, _defs) {
	let out = '## Table of contents\n\n';

	out += '**Root configuration**\n\n';
	out += '- [Root properties](#root-properties)\n';

	out += '\n**Sections**\n\n';

	const rootProps = schema.properties ?? {};
	const sections = [];

	for (const [_propName, propSchema] of Object.entries(rootProps)) {
		if (propSchema.$ref) {
			const refName = propSchema.$ref.split('/').pop();
			sections.push({name: refName, anchor: toAnchor(refName)});
		}
	}

	sections.sort((a, b) => a.name.localeCompare(b.name));

	for (const section of sections) {
		out += `- [${section.name}](#${section.anchor})\n`;
	}

	out += '\n';

	out += '## Field notation\n\n';
	out += 'Configuration tables use a compact notation:\n\n';
	out += '| Notation | Meaning |\n';
	out += '|----------|----------|\n';
	out += '| `property` | Required property |\n';
	out += '| `property?` | Optional property (may be omitted) |\n';
	out += '\n';
	out += 'Default values are shown in the Description column when applicable.\n\n';

	return out;
}

function renderRootProperties(schema, defs) {
	let out = '## Root properties\n\n';

	const properties = schema.properties ?? {};
	const requiredSet = new Set(schema.required ?? []);

	out += 'These are the top-level configuration options in your `config.json`.\n\n';
	out += renderPropertyTable(properties, requiredSet, defs);

	out += renderConditionalNote(schema);

	return out;
}

function renderMdx(schema) {
	const defs = buildDefMap(schema);
	let out = '';

	out += '---\n';
	out += "title: 'Configuration'\n";
	out += "description: 'config.json reference for self-hosted Fluxer.'\n";
	out += '---\n\n';

	out += renderTableOfContents(schema, defs);
	out += renderRootProperties(schema, defs);

	const rendered = new Set();
	const rootProps = schema.properties ?? {};

	const sortedProps = Object.entries(rootProps).sort(([a], [b]) => a.localeCompare(b));

	for (const [propName, propSchema] of sortedProps) {
		if (propSchema.$ref) {
			const refName = propSchema.$ref.split('/').pop();
			if (rendered.has(refName)) {
				continue;
			}
			const refSchema = defs[refName];
			if (refSchema) {
				rendered.add(refName);
				out += `---\n\n`;
				out += `## ${refName}\n\n`;
				out += `<a id="${toAnchor(refName)}"></a>\n\n`;
				out += `JSON path: ${wrapCode(propName)}\n\n`;
				if (refSchema.description) {
					out += `${refSchema.description}\n\n`;
				}
				const requiredSet = new Set(refSchema.required ?? []);
				out += renderConditionalNote(refSchema);
				if (refSchema.properties) {
					out += renderPropertyTable(refSchema.properties, requiredSet, defs);
					out += renderJsonExample(propName, refSchema.properties, requiredSet, defs);
				}
				out += renderNestedDefinitions(refName, refSchema, defs, propName, rendered);
			}
		}
	}

	return out;
}

async function main() {
	const dirname = path.dirname(fileURLToPath(import.meta.url));
	const repoRoot = path.resolve(dirname, '../..');
	const schemaPath = path.join(repoRoot, 'packages/config/src/ConfigSchema.json');
	const outPath = path.join(repoRoot, 'fluxer_docs/self_hosting/configuration.mdx');

	const schema = await readJsonFile(schemaPath);
	const mdx = renderMdx(schema);

	await writeFile(outPath, mdx);
	console.log(`Generated configuration documentation at ${outPath}`);
}

await main();
