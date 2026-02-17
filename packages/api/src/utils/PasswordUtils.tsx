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

import {Config} from '@fluxer/api/src/Config';
import argon2 from 'argon2';

const TEST_ARGON2_OPTIONS: argon2.Options = {
	memoryCost: 1024,
	timeCost: 1,
	parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
	const options = Config.dev.testModeEnabled ? TEST_ARGON2_OPTIONS : undefined;
	return argon2.hash(password, options);
}

export async function verifyPassword({
	password,
	passwordHash,
}: {
	password: string;
	passwordHash: string;
}): Promise<boolean> {
	return argon2.verify(passwordHash, password);
}
