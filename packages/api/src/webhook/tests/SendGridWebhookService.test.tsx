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

import crypto from 'node:crypto';
import {
	type ISendGridGatewayService,
	type ISendGridUserRepository,
	type SendGridEvent,
	SendGridWebhookService,
} from '@fluxer/api/src/webhook/SendGridWebhookService';
import {SuspiciousActivityFlags} from '@fluxer/constants/src/UserConstants';
import {describe, expect, it, vi} from 'vitest';

function createMockUserRepository(): ISendGridUserRepository {
	return {
		findByEmail: vi.fn().mockResolvedValue(null),
		patchUpsert: vi.fn().mockResolvedValue(null),
	};
}

function createMockGatewayService(): ISendGridGatewayService {
	return {
		dispatchPresence: vi.fn().mockResolvedValue(undefined),
	};
}

function signPayload(privateKey: string, payload: string, timestamp: string): string {
	const signer = crypto.createSign('sha256');
	signer.update(timestamp + payload);
	signer.end();
	return signer.sign(privateKey).toString('base64');
}

describe('SendGridWebhookService', () => {
	describe('verifySignature', () => {
		it('returns true for valid signature with PEM key', () => {
			const userRepo = createMockUserRepository();
			const gateway = createMockGatewayService();
			const service = new SendGridWebhookService(userRepo, gateway);

			const {privateKey, publicKey} = crypto.generateKeyPairSync('ec', {
				namedCurve: 'prime256v1',
				privateKeyEncoding: {format: 'pem', type: 'pkcs8'},
				publicKeyEncoding: {format: 'pem', type: 'spki'},
			});

			const payload = JSON.stringify({event: 'bounce', email: 'test@example.com'});
			const timestamp = '1700000000';
			const signature = signPayload(privateKey, payload, timestamp);

			const result = service.verifySignature(payload, signature, timestamp, publicKey);
			expect(result).toBe(true);
		});

		it('returns true for valid signature with base64 DER key', () => {
			const userRepo = createMockUserRepository();
			const gateway = createMockGatewayService();
			const service = new SendGridWebhookService(userRepo, gateway);

			const {privateKey, publicKey} = crypto.generateKeyPairSync('ec', {
				namedCurve: 'prime256v1',
				privateKeyEncoding: {format: 'pem', type: 'pkcs8'},
				publicKeyEncoding: {format: 'der', type: 'spki'},
			});

			const payload = JSON.stringify({event: 'bounce', email: 'test@example.com'});
			const timestamp = '1700000000';
			const signature = signPayload(privateKey, payload, timestamp);
			const publicKeyBase64 = publicKey.toString('base64');

			const result = service.verifySignature(payload, signature, timestamp, publicKeyBase64);
			expect(result).toBe(true);
		});

		it('returns false for invalid signature', () => {
			const userRepo = createMockUserRepository();
			const gateway = createMockGatewayService();
			const service = new SendGridWebhookService(userRepo, gateway);

			const {publicKey} = crypto.generateKeyPairSync('ec', {
				namedCurve: 'prime256v1',
				publicKeyEncoding: {format: 'pem', type: 'spki'},
				privateKeyEncoding: {format: 'pem', type: 'pkcs8'},
			});

			const payload = JSON.stringify({event: 'bounce', email: 'test@example.com'});
			const timestamp = '1700000000';
			const signature = 'invalid-signature';

			const result = service.verifySignature(payload, signature, timestamp, publicKey);
			expect(result).toBe(false);
		});
	});

	describe('processEvents', () => {
		it('ignores non-bounce events', async () => {
			const userRepo = createMockUserRepository();
			const gateway = createMockGatewayService();
			const service = new SendGridWebhookService(userRepo, gateway);

			const events: Array<SendGridEvent> = [{event: 'delivered', email: 'soft@example.com'}];
			await service.processEvents(events);

			expect(userRepo.findByEmail).not.toHaveBeenCalled();
			expect(userRepo.patchUpsert).not.toHaveBeenCalled();
		});

		it('marks hard bounces as unverified', async () => {
			const userRepo = createMockUserRepository();
			const gateway = createMockGatewayService();
			const service = new SendGridWebhookService(userRepo, gateway);

			const mockUser = {
				id: BigInt(123),
				email: 'bounced@example.com',
				emailBounced: false,
				emailVerified: true,
				suspiciousActivityFlags: 0,
				toRow: () => ({}),
			};
			(userRepo.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
			(userRepo.patchUpsert as ReturnType<typeof vi.fn>).mockResolvedValue({
				...mockUser,
				emailBounced: true,
				emailVerified: false,
			});

			const events: Array<SendGridEvent> = [
				{
					event: 'bounce',
					type: 'bounce',
					email: 'bounced@example.com',
					sg_event_id: 'event-1',
				},
			];

			await service.processEvents(events);

			expect(userRepo.findByEmail).toHaveBeenCalledWith('bounced@example.com');
			expect(userRepo.patchUpsert).toHaveBeenCalledWith(
				mockUser.id,
				{
					email_bounced: true,
					email_verified: false,
					suspicious_activity_flags: SuspiciousActivityFlags.REQUIRE_REVERIFIED_EMAIL,
				},
				mockUser.toRow(),
			);
		});

		it('skips already bounced users', async () => {
			const userRepo = createMockUserRepository();
			const gateway = createMockGatewayService();
			const service = new SendGridWebhookService(userRepo, gateway);

			const mockUser = {
				id: BigInt(456),
				email: 'already@example.com',
				emailBounced: true,
				suspiciousActivityFlags: 0,
				toRow: () => ({}),
			};
			(userRepo.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

			const events: Array<SendGridEvent> = [
				{
					event: 'bounce',
					type: 'bounce',
					email: 'already@example.com',
				},
			];

			await service.processEvents(events);

			expect(userRepo.patchUpsert).not.toHaveBeenCalled();
		});
	});
});
