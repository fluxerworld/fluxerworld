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

import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const BUILD_CHANNEL_FILE = path.join(ROOT_DIR, 'src', 'common', 'BuildChannel.tsx');

const channel = process.env.BUILD_CHANNEL || 'stable';

if (channel !== 'stable' && channel !== 'canary') {
	console.error(`Invalid BUILD_CHANNEL: ${channel}. Must be 'stable' or 'canary'.`);
	process.exit(1);
}

const content = `/*
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

export type BuildChannel = 'stable' | 'canary';
export const BUILD_CHANNEL = '${channel}' as BuildChannel;
export const IS_CANARY = BUILD_CHANNEL === 'canary';
export const CHANNEL_DISPLAY_NAME = BUILD_CHANNEL;
`;

fs.writeFileSync(BUILD_CHANNEL_FILE, content, 'utf-8');
console.log(`Set build channel to: ${channel}`);
