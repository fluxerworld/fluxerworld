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

import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
	console.error('Error: OPENROUTER_API_KEY environment variable is required');
	process.exit(1);
}

const LOCALES_DIR = new URL('../src/locales', import.meta.url).pathname;
const SOURCE_LOCALE = 'en-US';
const BATCH_SIZE = 20;
const CONCURRENT_LOCALES = 10;
const CONCURRENT_BATCHES_PER_LOCALE = 3;

const LOCALE_NAMES = {
	ar: 'Arabic',
	bg: 'Bulgarian',
	cs: 'Czech',
	da: 'Danish',
	de: 'German',
	el: 'Greek',
	'en-GB': 'British English',
	'es-ES': 'Spanish (Spain)',
	'es-419': 'Spanish (Latin America)',
	fi: 'Finnish',
	fr: 'French',
	he: 'Hebrew',
	hi: 'Hindi',
	hr: 'Croatian',
	hu: 'Hungarian',
	id: 'Indonesian',
	it: 'Italian',
	ja: 'Japanese',
	ko: 'Korean',
	lt: 'Lithuanian',
	nl: 'Dutch',
	no: 'Norwegian',
	pl: 'Polish',
	'pt-BR': 'Portuguese (Brazil)',
	ro: 'Romanian',
	ru: 'Russian',
	'sv-SE': 'Swedish',
	th: 'Thai',
	tr: 'Turkish',
	uk: 'Ukrainian',
	vi: 'Vietnamese',
	'zh-CN': 'Chinese (Simplified)',
	'zh-TW': 'Chinese (Traditional)',
};

function parsePo(content) {
	const entries = [];
	const lines = content.split('\n');
	let currentEntry = null;
	let currentField = null;
	let isHeader = true;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (line.startsWith('#. ')) {
			if (!currentEntry) {
				currentEntry = {comments: [], references: [], msgid: '', msgstr: '', lineNumber: i};
			}
			currentEntry.comments.push(line);
		} else if (line.startsWith('#: ')) {
			if (!currentEntry) {
				currentEntry = {comments: [], references: [], msgid: '', msgstr: '', lineNumber: i};
			}
			currentEntry.references.push(line);
		} else if (line.startsWith('msgid "')) {
			if (!currentEntry) {
				currentEntry = {comments: [], references: [], msgid: '', msgstr: '', lineNumber: i};
			}
			currentEntry.msgid = line.slice(7, -1);
			currentField = 'msgid';
		} else if (line.startsWith('msgstr "')) {
			if (currentEntry) {
				currentEntry.msgstr = line.slice(8, -1);
				currentField = 'msgstr';
			}
		} else if (line.startsWith('"') && line.endsWith('"')) {
			if (currentEntry && currentField) {
				currentEntry[currentField] += line.slice(1, -1);
			}
		} else if (line === '' && currentEntry) {
			if (isHeader && currentEntry.msgid === '') {
				isHeader = false;
			} else if (currentEntry.msgid !== '') {
				entries.push(currentEntry);
			}
			currentEntry = null;
			currentField = null;
		}
	}

	if (currentEntry && currentEntry.msgid !== '') {
		entries.push(currentEntry);
	}

	return entries;
}

function rebuildPo(content, translations) {
	const translationMap = new Map(translations.map((t) => [t.msgid, t.msgstr]));
	const normalized = content.replace(/\r\n/g, '\n');
	const blocks = normalized.trimEnd().split(/\n{2,}/g);
	const nextBlocks = blocks.map((block) => rebuildPoBlock(block, translationMap));
	return `${nextBlocks.join('\n\n')}\n`;
}

function rebuildPoBlock(block, translationMap) {
	const lines = block.split('\n');
	const msgidRange = getFieldRange(lines, 'msgid');
	const msgstrRange = getFieldRange(lines, 'msgstr');

	if (!msgidRange || !msgstrRange) {
		return block;
	}

	const hasReferences = lines.some((line) => line.startsWith('#: '));
	const msgid = readFieldRawValue(lines, msgidRange);
	if (!hasReferences && msgid === '') {
		return block;
	}

	const currentMsgstr = readFieldRawValue(lines, msgstrRange);
	if (currentMsgstr !== '') {
		return block;
	}

	if (!translationMap.has(msgid)) {
		return block;
	}

	const newMsgstr = translationMap.get(msgid);
	const newMsgstrLine = `msgstr "${escapePo(newMsgstr)}"`;
	return [...lines.slice(0, msgstrRange.startIndex), newMsgstrLine, ...lines.slice(msgstrRange.endIndex)].join('\n');
}

function getFieldRange(lines, field) {
	const startIndex = lines.findIndex((line) => line.startsWith(`${field} `));
	if (startIndex === -1) {
		return null;
	}
	let endIndex = startIndex + 1;
	while (endIndex < lines.length && lines[endIndex].startsWith('"') && lines[endIndex].endsWith('"')) {
		endIndex++;
	}
	return {startIndex, endIndex};
}

function readFieldRawValue(lines, range) {
	const firstLine = lines[range.startIndex];
	const match = firstLine.match(/^[a-z]+\s+"(.*)"$/);
	let value = match ? match[1] : '';
	for (let i = range.startIndex + 1; i < range.endIndex; i++) {
		value += lines[i].slice(1, -1);
	}
	return value;
}

function escapePo(str) {
	return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
}

function unescapePo(str) {
	return str.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

async function translateBatch(strings, targetLocale) {
	const localeName = LOCALE_NAMES[targetLocale] || targetLocale;

	const prompt = `You are a professional translator. Translate the following UI strings from English to ${localeName}.

CRITICAL RULES:
1. Preserve ALL placeholders exactly as they appear: {0}, {1}, {name}, {count}, etc.
2. Preserve ICU plural syntax exactly: {0, plural, one {...} other {...}}
3. Keep technical terms, brand names, and special characters intact
4. Match the tone and formality of a modern chat/messaging application
5. Return ONLY a JSON array of translated strings in the same order as input
6. Do NOT add any explanations or notes

Input strings (JSON array):
${JSON.stringify(strings, null, 2)}

Output (JSON array of translated strings only):`;

	const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${OPENROUTER_API_KEY}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': 'https://fluxer.dev',
			'X-Title': 'Fluxer i18n Translation',
		},
		body: JSON.stringify({
			model: 'openai/gpt-4o-mini',
			messages: [{role: 'user', content: prompt}],
			temperature: 0.3,
			max_tokens: 4096,
		}),
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
	}

	const data = await response.json();
	const content = data.choices[0]?.message?.content;

	if (!content) {
		throw new Error('Empty response from API');
	}

	const jsonMatch = content.match(/\[[\s\S]*\]/);
	if (!jsonMatch) {
		throw new Error(`Failed to parse JSON from response: ${content}`);
	}

	const translations = JSON.parse(jsonMatch[0]);

	if (translations.length !== strings.length) {
		throw new Error(`Translation count mismatch: expected ${strings.length}, got ${translations.length}`);
	}

	return translations;
}

async function pMap(items, mapper, concurrency) {
	const results = [];
	const executing = new Set();

	for (const [index, item] of items.entries()) {
		const promise = Promise.resolve().then(() => mapper(item, index));
		results.push(promise);
		executing.add(promise);

		const clean = () => executing.delete(promise);
		promise.then(clean, clean);

		if (executing.size >= concurrency) {
			await Promise.race(executing);
		}
	}

	return Promise.all(results);
}

async function processLocale(locale) {
	const poPath = join(LOCALES_DIR, locale, 'messages.po');
	console.log(`[${locale}] Starting...`);

	let content;
	try {
		content = readFileSync(poPath, 'utf-8');
	} catch (error) {
		console.error(`[${locale}] Error reading file: ${error.message}`);
		return {locale, translated: 0, errors: 1};
	}

	const entries = parsePo(content);
	const untranslated = entries.filter((e) => e.msgstr === '');

	if (untranslated.length === 0) {
		console.log(`[${locale}] No untranslated strings`);
		return {locale, translated: 0, errors: 0};
	}

	console.log(`[${locale}] Found ${untranslated.length} untranslated strings`);

	const batches = [];
	for (let i = 0; i < untranslated.length; i += BATCH_SIZE) {
		batches.push({
			index: Math.floor(i / BATCH_SIZE),
			total: Math.ceil(untranslated.length / BATCH_SIZE),
			entries: untranslated.slice(i, i + BATCH_SIZE),
		});
	}

	let errorCount = 0;
	const allTranslations = [];

	const batchResults = await pMap(
		batches,
		async (batch) => {
			const batchStrings = batch.entries.map((e) => unescapePo(e.msgid));

			try {
				const translatedStrings = await translateBatch(batchStrings, locale);
				console.log(`[${locale}] Batch ${batch.index + 1}/${batch.total} complete`);

				return batch.entries.map((entry, j) => ({
					msgid: entry.msgid,
					msgstr: translatedStrings[j],
				}));
			} catch (error) {
				console.error(`[${locale}] Batch ${batch.index + 1}/${batch.total} error: ${error.message}`);
				errorCount++;
				return [];
			}
		},
		CONCURRENT_BATCHES_PER_LOCALE,
	);

	for (const translations of batchResults) {
		allTranslations.push(...translations);
	}

	if (allTranslations.length > 0) {
		const updatedContent = rebuildPo(content, allTranslations);
		writeFileSync(poPath, updatedContent, 'utf-8');
		console.log(`[${locale}] Updated ${allTranslations.length} translations`);
	}

	return {locale, translated: allTranslations.length, errors: errorCount};
}

async function main() {
	console.log('Starting i18n translation...');
	console.log(`Locales directory: ${LOCALES_DIR}`);
	console.log(`Concurrency: ${CONCURRENT_LOCALES} locales, ${CONCURRENT_BATCHES_PER_LOCALE} batches per locale`);

	const locales = readdirSync(LOCALES_DIR).filter((d) => d !== SOURCE_LOCALE && LOCALE_NAMES[d]);

	console.log(`Found ${locales.length} locales to process\n`);

	const startTime = Date.now();
	const results = await pMap(locales, processLocale, CONCURRENT_LOCALES);

	const totalTranslated = results.reduce((sum, r) => sum + (r?.translated || 0), 0);
	const totalErrors = results.reduce((sum, r) => sum + (r?.errors || 0), 0);
	const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

	console.log(`\nTranslation complete in ${elapsed}s`);
	console.log(`Total: ${totalTranslated} strings translated, ${totalErrors} errors`);
}

main().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
