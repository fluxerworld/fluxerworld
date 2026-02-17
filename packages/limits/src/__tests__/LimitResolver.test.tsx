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

import {DEFAULT_FREE_LIMITS, DEFAULT_PREMIUM_LIMITS} from '@fluxer/limits/src/LimitDefaults';
import {resolveLimit, resolveLimits} from '@fluxer/limits/src/LimitResolver';
import type {LimitConfigSnapshot, LimitMatchContext} from '@fluxer/limits/src/LimitTypes';
import {describe, expect, test} from 'vitest';

describe('LimitResolver', () => {
	test('resolveLimits returns default free limits for empty snapshot', () => {
		const snapshot: LimitConfigSnapshot = {
			traitDefinitions: [],
			rules: [],
		};
		const ctx: LimitMatchContext = {
			traits: new Set(),
			guildFeatures: new Set(),
		};

		const result = resolveLimits(snapshot, ctx);

		expect(result.limits).toEqual(DEFAULT_FREE_LIMITS);
	});

	test('resolveLimits applies premium limits for premium trait', () => {
		const snapshot: LimitConfigSnapshot = {
			traitDefinitions: ['premium'],
			rules: [
				{
					id: 'default',
					limits: {...DEFAULT_FREE_LIMITS},
				},
				{
					id: 'premium',
					filters: {traits: ['premium']},
					limits: {...DEFAULT_PREMIUM_LIMITS},
				},
			],
		};
		const ctx: LimitMatchContext = {
			traits: new Set(['premium']),
			guildFeatures: new Set(),
		};

		const result = resolveLimits(snapshot, ctx);

		expect(result.limits.max_guilds).toBe(200);
		expect(result.limits.max_message_length).toBe(4000);
		expect(result.limits.feature_animated_avatar).toBe(1);
	});

	test('resolveLimits merges with Math.max', () => {
		const snapshot: LimitConfigSnapshot = {
			traitDefinitions: ['premium', 'special'],
			rules: [
				{
					id: 'default',
					limits: {max_guilds: 100},
				},
				{
					id: 'premium',
					filters: {traits: ['premium']},
					limits: {max_guilds: 200},
				},
				{
					id: 'special',
					filters: {traits: ['special']},
					limits: {max_guilds: 150},
				},
			],
		};
		const ctx: LimitMatchContext = {
			traits: new Set(['premium', 'special']),
			guildFeatures: new Set(),
		};

		const result = resolveLimits(snapshot, ctx);

		expect(result.limits.max_guilds).toBe(200);
	});

	test('resolveLimits applies rules by specificity order', () => {
		const snapshot: LimitConfigSnapshot = {
			traitDefinitions: ['premium'],
			rules: [
				{
					id: 'combined',
					filters: {traits: ['premium'], guildFeatures: ['MORE_EMOJI']},
					limits: {max_guild_emojis_static: 500},
				},
				{
					id: 'premium',
					filters: {traits: ['premium']},
					limits: {max_guild_emojis_static: 100},
				},
				{
					id: 'default',
					limits: {max_guild_emojis_static: 50},
				},
			],
		};
		const ctx: LimitMatchContext = {
			traits: new Set(['premium']),
			guildFeatures: new Set(['MORE_EMOJI']),
		};

		const result = resolveLimits(snapshot, ctx, {evaluationContext: 'guild'});

		expect(result.limits.max_guild_emojis_static).toBe(500);
	});

	test('resolveLimit returns specific limit value', () => {
		const snapshot: LimitConfigSnapshot = {
			traitDefinitions: ['premium'],
			rules: [
				{
					id: 'premium',
					filters: {traits: ['premium']},
					limits: {max_guilds: 200},
				},
			],
		};
		const ctx: LimitMatchContext = {
			traits: new Set(['premium']),
			guildFeatures: new Set(),
		};

		const result = resolveLimit(snapshot, ctx, 'max_guilds');

		expect(result).toBe(200);
	});

	test('resolveLimits ignores non-matching rules', () => {
		const snapshot: LimitConfigSnapshot = {
			traitDefinitions: ['premium', 'special'],
			rules: [
				{
					id: 'default',
					limits: {max_guilds: 100},
				},
				{
					id: 'premium',
					filters: {traits: ['premium']},
					limits: {max_guilds: 200},
				},
				{
					id: 'special',
					filters: {traits: ['special']},
					limits: {max_guilds: 300},
				},
			],
		};
		const ctx: LimitMatchContext = {
			traits: new Set(['premium']),
			guildFeatures: new Set(),
		};

		const result = resolveLimits(snapshot, ctx);

		expect(result.limits.max_guilds).toBe(200);
	});
});
