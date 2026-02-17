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

export function areFeatureSetsEqual(
	a: Iterable<string> | null | undefined,
	b: Iterable<string> | null | undefined,
): boolean {
	if (a === b) {
		return true;
	}

	if (!a || !b) {
		return false;
	}

	const setA = new Set<string>();
	for (const entry of a) {
		setA.add(entry);
	}

	const setB = new Set<string>();
	for (const entry of b) {
		setB.add(entry);
	}

	if (setA.size !== setB.size) {
		return false;
	}

	for (const entry of setA) {
		if (!setB.has(entry)) {
			return false;
		}
	}

	return true;
}
