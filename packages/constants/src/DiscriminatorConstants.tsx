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

export const NON_SELF_HOSTED_RESERVED_DISCRIMINATORS = new Set<number>([
	1, 2, 3, 4, 5, 6, 7, 8, 9, 67, 69, 404, 420, 666, 911, 1000, 1111, 1234, 1337, 2000, 2025, 2026, 2027, 2222, 2345,
	3000, 3333, 3456, 4000, 4321, 4444, 4567, 5000, 5432, 5555, 5678, 6000, 6543, 6666, 6789, 6969, 7000, 7654, 7777,
	7890, 8000, 8008, 8055, 8080, 8765, 8888, 9000, 9001, 9876, 9999,
]);
