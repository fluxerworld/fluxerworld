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
	CustomStatusResponse,
	RelationshipResponse,
	UserPartialResponse,
} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {describe, expect, it} from 'vitest';

describe('UserPartialResponse', () => {
	const validUser = {
		id: '123456789012345678',
		username: 'testuser',
		discriminator: '0001',
		global_name: 'Test User',
		avatar: 'avatar_hash',
		avatar_color: 0xff5500,
		flags: 0,
	};

	it('accepts valid user partial response', () => {
		const result = UserPartialResponse.safeParse(validUser);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.id).toBe('123456789012345678');
			expect(result.data.username).toBe('testuser');
		}
	});

	it('accepts null global_name and avatar', () => {
		const user = {
			...validUser,
			global_name: null,
			avatar: null,
			avatar_color: null,
		};
		const result = UserPartialResponse.safeParse(user);
		expect(result.success).toBe(true);
	});

	it('accepts optional bot flag', () => {
		const user = {...validUser, bot: true};
		const result = UserPartialResponse.safeParse(user);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.bot).toBe(true);
		}
	});

	it('accepts optional system flag', () => {
		const user = {...validUser, system: true};
		const result = UserPartialResponse.safeParse(user);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.system).toBe(true);
		}
	});

	it('requires id', () => {
		const {id, ...userWithoutId} = validUser;
		const result = UserPartialResponse.safeParse(userWithoutId);
		expect(result.success).toBe(false);
	});

	it('requires username', () => {
		const {username, ...userWithoutUsername} = validUser;
		const result = UserPartialResponse.safeParse(userWithoutUsername);
		expect(result.success).toBe(false);
	});

	it('requires discriminator', () => {
		const {discriminator, ...userWithoutDiscriminator} = validUser;
		const result = UserPartialResponse.safeParse(userWithoutDiscriminator);
		expect(result.success).toBe(false);
	});

	it('requires flags', () => {
		const {flags, ...userWithoutFlags} = validUser;
		const result = UserPartialResponse.safeParse(userWithoutFlags);
		expect(result.success).toBe(false);
	});
});

describe('CustomStatusResponse', () => {
	it('accepts valid custom status', () => {
		const result = CustomStatusResponse.safeParse({
			text: 'Working on a project',
			expires_at: '2024-01-15T18:00:00.000Z',
			emoji_id: '123456789012345678',
			emoji_name: 'custom_emoji',
			emoji_animated: false,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.text).toBe('Working on a project');
		}
	});

	it('accepts minimal custom status', () => {
		const result = CustomStatusResponse.safeParse({
			emoji_animated: false,
		});
		expect(result.success).toBe(true);
	});

	it('accepts null optional fields', () => {
		const result = CustomStatusResponse.safeParse({
			text: null,
			expires_at: null,
			emoji_id: null,
			emoji_name: null,
			emoji_animated: false,
		});
		expect(result.success).toBe(true);
	});

	it('accepts unicode emoji name', () => {
		const result = CustomStatusResponse.safeParse({
			emoji_name: '\uD83D\uDE00',
			emoji_animated: false,
		});
		expect(result.success).toBe(true);
	});

	it('requires emoji_animated', () => {
		const result = CustomStatusResponse.safeParse({
			text: 'Hello',
		});
		expect(result.success).toBe(false);
	});

	it('accepts animated emoji', () => {
		const result = CustomStatusResponse.safeParse({
			emoji_id: '123456789012345678',
			emoji_name: 'animated_emoji',
			emoji_animated: true,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.emoji_animated).toBe(true);
		}
	});
});

describe('RelationshipResponse', () => {
	const validRelationship = {
		id: '123456789012345678',
		type: 1,
		user: {
			id: '987654321098765432',
			username: 'friend',
			discriminator: '0001',
			global_name: 'Friend',
			avatar: null,
			avatar_color: null,
			flags: 0,
		},
		nickname: 'Best Friend',
	};

	it('accepts valid relationship', () => {
		const result = RelationshipResponse.safeParse(validRelationship);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.id).toBe('123456789012345678');
			expect(result.data.type).toBe(1);
		}
	});

	it('accepts relationship with null nickname', () => {
		const relationship = {...validRelationship, nickname: null};
		const result = RelationshipResponse.safeParse(relationship);
		expect(result.success).toBe(true);
	});

	it('accepts relationship with since date', () => {
		const relationship = {...validRelationship, since: '2024-01-01T00:00:00.000Z'};
		const result = RelationshipResponse.safeParse(relationship);
		expect(result.success).toBe(true);
	});

	it('requires id', () => {
		const {id, ...relationshipWithoutId} = validRelationship;
		const result = RelationshipResponse.safeParse(relationshipWithoutId);
		expect(result.success).toBe(false);
	});

	it('requires type', () => {
		const {type, ...relationshipWithoutType} = validRelationship;
		const result = RelationshipResponse.safeParse(relationshipWithoutType);
		expect(result.success).toBe(false);
	});

	it('requires user', () => {
		const {user, ...relationshipWithoutUser} = validRelationship;
		const result = RelationshipResponse.safeParse(relationshipWithoutUser);
		expect(result.success).toBe(false);
	});

	it('validates nested user object', () => {
		const relationship = {
			...validRelationship,
			user: {id: 'invalid'},
		};
		const result = RelationshipResponse.safeParse(relationship);
		expect(result.success).toBe(false);
	});

	it('accepts different relationship types', () => {
		for (const type of [0, 1, 2, 3, 4]) {
			const relationship = {...validRelationship, type};
			const result = RelationshipResponse.safeParse(relationship);
			expect(result.success).toBe(true);
		}
	});
});
