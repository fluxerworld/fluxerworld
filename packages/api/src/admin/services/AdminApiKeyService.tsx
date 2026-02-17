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

import type {IAdminApiKeyRepository} from '@fluxer/api/src/admin/repositories/IAdminApiKeyRepository';
import type {UserID} from '@fluxer/api/src/BrandedTypes';
import type {SnowflakeService} from '@fluxer/api/src/infrastructure/SnowflakeService';
import {verifyPassword} from '@fluxer/api/src/utils/PasswordUtils';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import {AdminApiKeyNotFoundError} from '@fluxer/errors/src/domains/admin/AdminApiKeyNotFoundError';
import {MissingACLError} from '@fluxer/errors/src/domains/core/MissingACLError';
import type {CreateAdminApiKeyRequest} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import {ms} from 'itty-time';

const ADMIN_KEY_PREFIX = 'fa_';
const RANDOM_KEY_LENGTH = 32;
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

interface CreateApiKeyResult {
	key: string;
	apiKey: {
		keyId: string;
		name: string;
		createdAt: Date;
		expiresAt: Date | null;
		acls: Set<string>;
	};
}

export class AdminApiKeyService {
	constructor(
		private readonly adminApiKeyRepository: IAdminApiKeyRepository,
		private readonly snowflakeService: SnowflakeService,
	) {}

	private generateRawKey(keyId: bigint): string {
		const randomBytes = new Uint8Array(RANDOM_KEY_LENGTH);
		crypto.getRandomValues(randomBytes);

		const randomChars = Array.from(randomBytes)
			.map((byte) => CHARSET[byte % CHARSET.length])
			.join('');

		return `${ADMIN_KEY_PREFIX}${keyId.toString()}_${randomChars}`;
	}

	private extractKeyId(rawKey: string): bigint | null {
		if (!rawKey.startsWith(ADMIN_KEY_PREFIX)) {
			return null;
		}

		const remainder = rawKey.slice(ADMIN_KEY_PREFIX.length);
		const underscoreIdx = remainder.indexOf('_');
		if (underscoreIdx <= 0) {
			return null;
		}

		const keyIdStr = remainder.slice(0, underscoreIdx);
		if (!/^\d+$/.test(keyIdStr)) {
			return null;
		}

		try {
			return BigInt(keyIdStr);
		} catch {
			return null;
		}
	}

	async createApiKey(
		request: CreateAdminApiKeyRequest,
		createdBy: UserID,
		creatorAcls?: Set<string>,
	): Promise<CreateApiKeyResult> {
		const keyId = await this.snowflakeService.generate();
		const rawKey = this.generateRawKey(keyId);

		const expiresAt = request.expires_in_days ? new Date(Date.now() + request.expires_in_days * ms('1 day')) : null;

		if (creatorAcls) {
			const invalidACLs = request.acls.filter((acl) => !creatorAcls.has(acl) && !creatorAcls.has(AdminACLs.WILDCARD));
			if (invalidACLs.length > 0) {
				throw new MissingACLError(invalidACLs[0]);
			}
		}

		const aclsSet = new Set(request.acls);

		const apiKey = await this.adminApiKeyRepository.create(
			{
				name: request.name,
				expiresAt,
				acls: aclsSet,
			},
			createdBy,
			keyId,
			rawKey,
		);

		return {
			key: rawKey,
			apiKey: {
				keyId: apiKey.keyId.toString(),
				name: apiKey.name,
				createdAt: apiKey.createdAt,
				expiresAt: apiKey.expiresAt,
				acls: apiKey.acls,
			},
		};
	}

	async validateApiKey(rawKey: string): Promise<{keyId: bigint; createdById: UserID; acls: Set<string> | null} | null> {
		const keyId = this.extractKeyId(rawKey);
		if (keyId === null) return null;

		const apiKey = await this.adminApiKeyRepository.findById(keyId);

		if (!apiKey) {
			return null;
		}

		if (apiKey.isExpired()) {
			return null;
		}

		const valid = await verifyPassword({password: rawKey, passwordHash: apiKey.keyHash});
		if (!valid) {
			return null;
		}

		await this.adminApiKeyRepository.updateLastUsed(apiKey.keyId);

		return {
			keyId: apiKey.keyId,
			createdById: apiKey.createdById,
			acls: apiKey.acls,
		};
	}

	async listKeys(createdBy: UserID): Promise<
		Array<{
			keyId: string;
			name: string;
			createdAt: Date;
			lastUsedAt: Date | null;
			expiresAt: Date | null;
			createdById: UserID;
			acls: Set<string>;
		}>
	> {
		const apiKeys = await this.adminApiKeyRepository.listByCreator(createdBy);

		return apiKeys.map((key) => ({
			keyId: key.keyId.toString(),
			name: key.name,
			createdAt: key.createdAt,
			lastUsedAt: key.lastUsedAt,
			expiresAt: key.expiresAt,
			createdById: key.createdById,
			acls: key.acls ?? new Set(),
		}));
	}

	async revokeKey(keyId: string, createdBy: UserID): Promise<void> {
		if (!/^\d+$/.test(keyId)) {
			throw new AdminApiKeyNotFoundError();
		}

		const keyIdBigInt = BigInt(keyId);

		const apiKey = await this.adminApiKeyRepository.findById(keyIdBigInt);

		if (!apiKey) {
			throw new AdminApiKeyNotFoundError();
		}

		if (apiKey.createdById !== createdBy) {
			throw new AdminApiKeyNotFoundError();
		}

		await this.adminApiKeyRepository.revoke(keyIdBigInt, createdBy);
	}
}
