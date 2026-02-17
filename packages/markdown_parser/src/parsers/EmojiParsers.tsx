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

import {EmojiKind, NodeType} from '@fluxer/markdown_parser/src/types/Enums';
import type {Node, ParserResult} from '@fluxer/markdown_parser/src/types/Nodes';

export interface UnicodeEmoji {
	surrogates: string;
}

export interface EmojiProvider {
	getSurrogateName(surrogate: string): string | null;
	findEmojiByName(name: string): UnicodeEmoji | null;
	findEmojiWithSkinTone(baseName: string, skinToneSurrogate: string): UnicodeEmoji | null;
}

export interface EmojiParserConfig {
	emojiProvider?: EmojiProvider;
	emojiRegex?: RegExp;
	skinToneSurrogates?: ReadonlyArray<string>;
	convertToCodePoints?: (emoji: string) => string;
}

const VALID_EMOJI_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;
const CUSTOM_EMOJI_REGEX = /^<(a)?:([a-zA-Z0-9_-]+):(\d+)>/;

const PLAINTEXT_SYMBOLS = new Set(['™', '™️', '©', '©️', '®', '®️']);

const TEXT_PRESENTATION_MAP: Record<string, string> = {
	'™️': '™',
	'©️': '©',
	'®️': '®',
};

const NEEDS_VARIATION_SELECTOR_CACHE = new Map<number, boolean>();

const SPECIAL_SHORTCODES: Record<string, string> = {
	tm: '™',
	copyright: '©',
	registered: '®',
};

const EMOJI_NAME_CACHE = new Map<string, string | null>();
const EMOJI_BY_NAME_CACHE = new Map<string, UnicodeEmoji | null>();

let globalEmojiConfig: EmojiParserConfig | null = null;

export function setEmojiParserConfig(config: EmojiParserConfig): void {
	globalEmojiConfig = config;
}

export function getEmojiParserConfig(): EmojiParserConfig | null {
	return globalEmojiConfig;
}

function needsVariationSelector(codePoint: number): boolean {
	if (NEEDS_VARIATION_SELECTOR_CACHE.has(codePoint)) {
		return NEEDS_VARIATION_SELECTOR_CACHE.get(codePoint)!;
	}

	const result =
		(codePoint >= 0x2190 && codePoint <= 0x21ff) ||
		(codePoint >= 0x2300 && codePoint <= 0x23ff) ||
		(codePoint >= 0x2600 && codePoint <= 0x27bf) ||
		(codePoint >= 0x2900 && codePoint <= 0x297f);

	NEEDS_VARIATION_SELECTOR_CACHE.set(codePoint, result);
	return result;
}

function removeVariationSelectors(text: string): string {
	if (text.length < 2 || text.indexOf('\uFE0F') === -1) {
		return text;
	}

	let result = '';
	let i = 0;
	while (i < text.length) {
		if (text.charCodeAt(i) === 0x2122 && i + 1 < text.length && text.charCodeAt(i + 1) === 0xfe0f) {
			result += '™';
			i += 2;
		} else if (text.charCodeAt(i) === 0xa9 && i + 1 < text.length && text.charCodeAt(i + 1) === 0xfe0f) {
			result += '©';
			i += 2;
		} else if (text.charCodeAt(i) === 0xae && i + 1 < text.length && text.charCodeAt(i + 1) === 0xfe0f) {
			result += '®';
			i += 2;
		} else {
			result += text.charAt(i);
			i++;
		}
	}
	return result;
}

function defaultConvertToCodePoints(emoji: string): string {
	const containsZWJ = emoji.includes('\u200D');
	const processedEmoji = containsZWJ ? emoji : emoji.replace(/\uFE0F/g, '');
	return Array.from(processedEmoji)
		.map((char) => char.codePointAt(0)?.toString(16).replace(/^0+/, '') || '')
		.join('-');
}

export function parseStandardEmoji(text: string, start: number): ParserResult | null {
	if (!globalEmojiConfig?.emojiProvider || !globalEmojiConfig?.emojiRegex) {
		return null;
	}

	if (!text || start >= text.length || text.length - start < 1) {
		return null;
	}

	const firstChar = text.charAt(start);
	if (PLAINTEXT_SYMBOLS.has(firstChar)) {
		return null;
	}

	const firstCharCode = text.charCodeAt(start);
	if (
		firstCharCode < 0x80 &&
		firstCharCode !== 0x23 &&
		firstCharCode !== 0x2a &&
		firstCharCode !== 0x30 &&
		firstCharCode !== 0x31 &&
		(firstCharCode < 0x32 || firstCharCode > 0x39)
	) {
		return null;
	}

	const emojiRegex = globalEmojiConfig.emojiRegex;
	emojiRegex.lastIndex = 0;
	const match = emojiRegex.exec(text.slice(start));

	if (match && match.index === 0) {
		const candidate = match[0];

		if (PLAINTEXT_SYMBOLS.has(candidate)) {
			return null;
		}

		if (PLAINTEXT_SYMBOLS.has(candidate)) {
			const textPresentation = TEXT_PRESENTATION_MAP[candidate];
			if (textPresentation) {
				return {
					node: {type: NodeType.Text, content: textPresentation},
					advance: candidate.length,
				};
			}

			return {
				node: {type: NodeType.Text, content: candidate},
				advance: candidate.length,
			};
		}

		const hasVariationSelector = candidate.indexOf('\uFE0F') !== -1;
		const codePoint = candidate.codePointAt(0) || 0;

		const isDingbat = codePoint >= 0x2600 && codePoint <= 0x27bf;
		if (!isDingbat && needsVariationSelector(codePoint) && !hasVariationSelector) {
			return null;
		}

		let name = EMOJI_NAME_CACHE.get(candidate);
		if (name === undefined) {
			name = globalEmojiConfig.emojiProvider.getSurrogateName(candidate);
			EMOJI_NAME_CACHE.set(candidate, name);
		}

		if (!name) {
			return null;
		}

		const convertToCodePoints = globalEmojiConfig.convertToCodePoints || defaultConvertToCodePoints;
		const codepoints = convertToCodePoints(candidate);

		return {
			node: {
				type: NodeType.Emoji,
				kind: {
					kind: EmojiKind.Standard,
					raw: candidate,
					codepoints,
					name,
				},
			},
			advance: candidate.length,
		};
	}

	return null;
}

const SKIN_TONE_SUFFIX_REGEX = /^:skin-tone-([1-5]):/;

export function parseEmojiShortcode(text: string): ParserResult | null {
	if (!text.startsWith(':') || text.length < 3) {
		return null;
	}

	const endPos = text.indexOf(':', 1);
	if (endPos === -1 || endPos === 1) {
		return null;
	}

	const baseName = text.substring(1, endPos);

	const specialSymbol = SPECIAL_SHORTCODES[baseName];
	if (specialSymbol) {
		return {
			node: {type: NodeType.Text, content: specialSymbol},
			advance: endPos + 1,
		};
	}

	if (!globalEmojiConfig?.emojiProvider) {
		return null;
	}

	if (!baseName || !VALID_EMOJI_NAME_REGEX.test(baseName)) {
		return null;
	}

	let emoji = EMOJI_BY_NAME_CACHE.get(baseName);
	if (emoji === undefined) {
		emoji = globalEmojiConfig.emojiProvider.findEmojiByName(baseName);
		EMOJI_BY_NAME_CACHE.set(baseName, emoji);
	}

	if (!emoji) {
		return null;
	}

	const emojiSurrogate = emoji.surrogates;
	if (PLAINTEXT_SYMBOLS.has(emojiSurrogate)) {
		const textPresentation = TEXT_PRESENTATION_MAP[emojiSurrogate];
		if (textPresentation) {
			return {
				node: {type: NodeType.Text, content: textPresentation},
				advance: endPos + 1,
			};
		}

		return {
			node: {type: NodeType.Text, content: emojiSurrogate},
			advance: endPos + 1,
		};
	}

	let finalEmoji = emoji;
	let totalAdvance = endPos + 1;

	const afterEmoji = text.slice(endPos + 1);
	const skinToneMatch = SKIN_TONE_SUFFIX_REGEX.exec(afterEmoji);
	if (skinToneMatch && globalEmojiConfig.skinToneSurrogates) {
		const skinTone = Number.parseInt(skinToneMatch[1], 10);
		const skinToneKey = `${baseName}:tone-${skinTone}`;
		let skinToneEmoji = EMOJI_BY_NAME_CACHE.get(skinToneKey);

		if (skinToneEmoji === undefined) {
			const skinToneSurrogate = globalEmojiConfig.skinToneSurrogates[skinTone - 1];
			skinToneEmoji = globalEmojiConfig.emojiProvider.findEmojiWithSkinTone(baseName, skinToneSurrogate);
			EMOJI_BY_NAME_CACHE.set(skinToneKey, skinToneEmoji);
		}

		if (skinToneEmoji) {
			finalEmoji = skinToneEmoji;
			totalAdvance += skinToneMatch[0].length;
		}
	}

	if (!finalEmoji) {
		return null;
	}

	const convertToCodePoints = globalEmojiConfig.convertToCodePoints || defaultConvertToCodePoints;
	const codepoints = convertToCodePoints(finalEmoji.surrogates);

	return {
		node: {
			type: NodeType.Emoji,
			kind: {
				kind: EmojiKind.Standard,
				raw: finalEmoji.surrogates,
				codepoints,
				name: baseName,
			},
		},
		advance: totalAdvance,
	};
}

export function parseCustomEmoji(text: string): ParserResult | null {
	if (!(text.startsWith('<:') || text.startsWith('<a:'))) {
		return null;
	}

	const lastIdx = text.indexOf('>');
	if (lastIdx === -1 || lastIdx < 4) {
		return null;
	}

	const match = CUSTOM_EMOJI_REGEX.exec(text);
	if (!match) {
		return null;
	}

	const animated = Boolean(match[1]);
	const name = match[2];
	const id = match[3];
	const advance = match[0].length;

	if (!name || !id || id.length === 0) {
		return null;
	}

	for (let i = 0; i < id.length; i++) {
		const charCode = id.charCodeAt(i);
		if (charCode < 48 || charCode > 57) {
			return null;
		}
	}

	return {
		node: {
			type: NodeType.Emoji,
			kind: {
				kind: EmojiKind.Custom,
				name,
				id,
				animated,
			},
		},
		advance,
	};
}

export function applyTextPresentation(node: Node): void {
	if (node && node.type === NodeType.Text && typeof node.content === 'string') {
		if (node.content.indexOf('\uFE0F') !== -1) {
			node.content = removeVariationSelectors(node.content);
		}
	} else if (node && 'children' in node && Array.isArray(node.children)) {
		for (const child of node.children) {
			applyTextPresentation(child);
		}
	}
}
