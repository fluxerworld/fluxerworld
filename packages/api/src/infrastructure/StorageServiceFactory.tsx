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

import {DirectS3StorageService} from '@fluxer/api/src/infrastructure/DirectS3StorageService';
import type {IStorageService} from '@fluxer/api/src/infrastructure/IStorageService';
import {StorageService} from '@fluxer/api/src/infrastructure/StorageService';
import type {S3Service} from '@fluxer/s3/src/s3/S3Service';

export interface CreateStorageServiceOptions {
	s3Service?: S3Service;
}

export function createStorageService(options?: CreateStorageServiceOptions): IStorageService {
	if (options?.s3Service) {
		return new DirectS3StorageService(options.s3Service);
	}
	return new StorageService();
}
