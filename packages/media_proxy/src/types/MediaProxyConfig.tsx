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

export interface S3Config {
	endpoint: string;
	region: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucketCdn: string;
	bucketUploads: string;
	bucketStatic?: string | undefined;
}

export interface MediaProxyConfig {
	nodeEnv: 'development' | 'production';
	secretKey: string;
	requireCloudflareEdge: boolean;
	staticMode: boolean;
	s3: S3Config;
	nsfwModelPath?: string | undefined;
}
