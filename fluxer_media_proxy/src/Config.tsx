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

import {loadConfig} from '@fluxer/config/src/ConfigLoader';
import {extractBaseServiceConfig} from '@fluxer/config/src/ServiceConfigSlices';

const master = await loadConfig();
const s3Config = master.s3;
if (!s3Config?.buckets) {
	throw new Error('Media proxy requires S3 bucket configuration');
}
const mediaProxyBuckets = s3Config.buckets;

export const Config = {
	...extractBaseServiceConfig(master),
	env: master.env === 'test' ? 'development' : master.env,
	server: {
		port: master.services.media_proxy.port,
	},
	aws: {
		accessKeyId: s3Config.access_key_id,
		secretAccessKey: s3Config.secret_access_key,
		s3Endpoint: s3Config.endpoint,
		s3Region: s3Config.region,
		s3BucketCdn: mediaProxyBuckets.cdn,
		s3BucketUploads: mediaProxyBuckets.uploads,
		s3BucketStatic: mediaProxyBuckets.static,
	},
	mediaProxy: {
		secretKey: master.services.media_proxy.secret_key,
		requireCloudflareEdge: master.services.media_proxy.require_cloudflare_edge,
		staticMode: master.services.media_proxy.static_mode,
	},
	rateLimit: master.services.media_proxy.rate_limit ?? null,
};

export type Config = typeof Config;
