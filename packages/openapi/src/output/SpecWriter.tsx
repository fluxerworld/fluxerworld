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
import type {OpenAPIDocument} from '@fluxer/openapi/src/Types';

export function writeSpec(spec: OpenAPIDocument, outputPath: string): void {
	const dir = path.dirname(outputPath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, {recursive: true});
	}

	const json = JSON.stringify(spec, null, 2);
	const tempPath = `${outputPath}.tmp`;
	fs.writeFileSync(tempPath, `${json}\n`, 'utf-8');
	fs.renameSync(tempPath, outputPath);
}

export function readSpec(inputPath: string): OpenAPIDocument {
	const content = fs.readFileSync(inputPath, 'utf-8');
	return JSON.parse(content) as OpenAPIDocument;
}

export function formatSpec(spec: OpenAPIDocument): string {
	return JSON.stringify(spec, null, 2);
}

export function getDefaultOutputPath(basePath: string): string {
	return path.join(basePath, 'fluxer_docs', 'api-reference', 'openapi.json');
}
