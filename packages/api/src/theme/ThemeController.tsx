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

import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {DefaultUserOnly, LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {
	ThemeCreateRequest,
	ThemeCreateResponse,
	ThemeGalleryListResponse,
	ThemeGallerySubmitRequest,
	ThemeGallerySubmitResponse,
	ThemeImageUploadRequest,
	ThemeImageUploadResponse,
} from '@fluxer/schema/src/domains/theme/ThemeSchemas';

export function ThemeController(app: HonoApp) {
	app.post(
		'/users/@me/themes',
		RateLimitMiddleware(RateLimitConfigs.THEME_SHARE_CREATE),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'create_theme',
			summary: 'Create theme',
			responseSchema: ThemeCreateResponse,
			statusCode: 201,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Themes'],
			description: 'Creates a new custom theme with CSS styling that can be shared with other users.',
		}),
		Validator('json', ThemeCreateRequest),
		async (ctx) => {
			const {css} = ctx.req.valid('json');
			const theme = await ctx.get('themeService').createTheme(css);
			return ctx.json(theme, 201);
		},
	);

	// Public gallery — auto-publish on submit. Theme CSS goes straight to
	// S3 with a content-hashed id; metadata goes into kv_store under
	// `gallery_themes` keyed by theme_id. GET /themes/gallery returns the
	// list so the public gallery page can merge community themes with the
	// curated webroot/themes.json. Rate-limited at 3/10min/user (see
	// MiscRateLimitConfig THEME_GALLERY_SUBMIT) to make spam impractical.
	app.post(
		'/themes/gallery/submit',
		RateLimitMiddleware(RateLimitConfigs.THEME_GALLERY_SUBMIT),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'submit_gallery_theme',
			summary: 'Submit a theme to the public gallery',
			responseSchema: ThemeGallerySubmitResponse,
			statusCode: 201,
			security: ['sessionToken', 'bearerToken'],
			tags: ['Themes'],
			description: 'Submit a theme. Auto-published once the request succeeds.',
		}),
		Validator('json', ThemeGallerySubmitRequest),
		async (ctx) => {
			const body = ctx.req.valid('json');
			const user = ctx.get('user');

			// Content-hash id matches scripts/mint-gallery-themes.cjs so the
			// same CSS submitted twice doesn't create two entries.
			const themeId = createHash('sha256').update(body.css).digest('hex').slice(0, 16);

			// Write the CSS file to the local S3 backend — same path the
			// existing ThemeService uses. We do this directly here because the
			// curated mint script also writes here; sharing the path keeps
			// the gallery page free to fetch every theme from /media/themes/.
			const {writeFileSync, mkdirSync} = await import('node:fs');
			const S3_THEMES = '/usr/src/app/data/s3/fluxer/themes';
			mkdirSync(S3_THEMES, {recursive: true});
			writeFileSync(`${S3_THEMES}/${themeId}.css`, body.css, 'utf-8');

			const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || themeId;

			const row = {
				theme_id: themeId,
				slug,
				name: body.name,
				author: body.author,
				description: body.description,
				tags: body.tags ?? [],
				preview: body.preview ?? [],
				submitter_user_id: user.id.toString(),
				added_at: new Date().toISOString().slice(0, 10),
				status: 'approved' as const,
			};

			const db = new DatabaseSync('/usr/src/app/data/fluxer.db');
			try {
				// INSERT OR REPLACE so a re-submission of the same CSS just
				// refreshes the metadata rather than failing on PK conflict.
				db.prepare(
					'INSERT OR REPLACE INTO kv_store (table_name, key, value, expires_at) VALUES (?, ?, ?, NULL)',
				).run('gallery_themes', themeId, JSON.stringify(row));
			} finally {
				db.close();
			}

			// Schema literal still says 'pending' for compatibility with the
			// previous moderation-queue shape; semantically the theme is
			// already live by the time we return.
			return ctx.json({id: themeId, status: 'pending' as const}, 201);
		},
	);

	// Image upload for theme authors. Lets gallery contributors host
	// background images / decorative assets on our CDN instead of
	// hotlinking from random external hosts. Returns a public URL the
	// author pastes into the CSS url(...) clause.
	app.post(
		'/themes/gallery/upload-image',
		RateLimitMiddleware(RateLimitConfigs.THEME_IMAGE_UPLOAD),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'upload_gallery_theme_image',
			summary: 'Upload an image for use in a gallery theme',
			responseSchema: ThemeImageUploadResponse,
			statusCode: 201,
			security: ['sessionToken', 'bearerToken'],
			tags: ['Themes'],
			description: 'Upload an image (JPG/PNG/WebP, ≤4 MB) and get back a /media/themes/assets/... URL.',
		}),
		Validator('json', ThemeImageUploadRequest),
		async (ctx) => {
			const {image} = ctx.req.valid('json');

			// Strip data-URL prefix if present so callers can submit either form.
			const stripped = image.includes(',') ? image.split(',', 2)[1] : image;
			let buf: Buffer;
			try {
				buf = Buffer.from(stripped, 'base64');
			} catch {
				return ctx.json({code: 'INVALID_IMAGE', message: 'Image is not valid base64.'}, 400);
			}

			const MAX_BYTES = 4 * 1024 * 1024;
			if (buf.length === 0 || buf.length > MAX_BYTES) {
				return ctx.json({code: 'INVALID_SIZE', message: 'Image must be 1 byte to 4 MB.'}, 400);
			}

			// Magic-byte sniff so we don't trust the caller's claimed
			// mimetype. JPG / PNG / WebP / GIF only.
			let ext: string;
			if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
				ext = 'jpg';
			} else if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
				ext = 'png';
			} else if (
				buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
				buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
			) {
				ext = 'webp';
			} else if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
				ext = 'gif';
			} else {
				return ctx.json({code: 'UNSUPPORTED_FORMAT', message: 'Only JPG, PNG, WebP, GIF are supported.'}, 400);
			}

			const hash = createHash('sha256').update(buf).digest('hex').slice(0, 24);
			const filename = `${hash}.${ext}`;
			const {writeFileSync, mkdirSync, existsSync} = await import('node:fs');
			const ASSETS_DIR = '/usr/src/app/data/s3/fluxer/themes/assets';
			mkdirSync(ASSETS_DIR, {recursive: true});
			const onDiskPath = `${ASSETS_DIR}/${filename}`;
			// Dedupe: skip the write if a file with this hash already exists.
			if (!existsSync(onDiskPath)) {
				writeFileSync(onDiskPath, buf);
			}

			return ctx.json({url: `/media/themes/assets/${filename}`}, 201);
		},
	);

	app.get(
		'/themes/gallery',
		OpenAPI({
			operationId: 'list_gallery_themes',
			summary: 'List community-submitted gallery themes',
			responseSchema: ThemeGalleryListResponse,
			statusCode: 200,
			security: [],
			tags: ['Themes'],
			description:
				'Returns all community-submitted gallery themes (auto-published on submit). The gallery page merges these with the curated /themes.json.',
		}),
		async (ctx) => {
			const db = new DatabaseSync('/usr/src/app/data/fluxer.db');
			let rows: Array<{value: string | Buffer | Uint8Array}> = [];
			try {
				rows = db
					.prepare(
						"SELECT value FROM kv_store WHERE table_name = 'gallery_themes' ORDER BY key DESC LIMIT 500",
					)
					.all() as Array<{value: string | Buffer | Uint8Array}>;
			} finally {
				db.close();
			}

			const themes = rows
				.map((r) => {
					const text =
						typeof r.value === 'string' ? r.value : Buffer.from(r.value as Uint8Array).toString('utf-8');
					try {
						return JSON.parse(text);
					} catch {
						return null;
					}
				})
				.filter((t): t is Record<string, unknown> => t !== null && (t as {status?: string}).status === 'approved');

			return ctx.json({themes});
		},
	);
}
