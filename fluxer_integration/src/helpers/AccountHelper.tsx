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

import {randomUUID} from 'node:crypto';
import {apiClient} from '@fluxer/integration/helpers/ApiClient';

export interface TestAccount {
	userId: string;
	token: string;
	email: string;
	username: string;
}

interface RegisterResponse {
	token: string;
}

interface UsersMeResponse {
	id: string;
	username: string;
	email: string;
}

let accountCounter = 0;

export async function createTestAccount(): Promise<TestAccount> {
	const uniqueId = `${Date.now()}_${++accountCounter}_${randomUUID().slice(0, 8)}`;
	const email = `test_${uniqueId}@integration.test`;
	const username = `tu_${uniqueId.slice(0, 12)}`;
	const password = `Str0ng$Pass_${randomUUID()}_X2y!Z3`;

	const registerResponse = await apiClient.post<RegisterResponse>('/auth/register', {
		email,
		username,
		global_name: 'Test User',
		password,
		date_of_birth: '2000-01-01',
		consent: true,
	});

	if (!registerResponse.ok) {
		throw new Error(`Failed to register test account: ${JSON.stringify(registerResponse.data)}`);
	}

	const token = registerResponse.data.token;

	const meResponse = await apiClient.get<UsersMeResponse>('/users/@me', token);
	if (!meResponse.ok) {
		throw new Error(`Failed to get user info: ${JSON.stringify(meResponse.data)}`);
	}

	return {
		userId: meResponse.data.id,
		token,
		email,
		username: meResponse.data.username,
	};
}

export async function ensureSessionStarted(token: string): Promise<void> {
	await apiClient.post('/users/@me/sessions', {session_id: randomUUID()}, token);
}
