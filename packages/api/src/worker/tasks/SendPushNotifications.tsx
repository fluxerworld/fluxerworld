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

import {createChannelID, createUserID, type UserID} from '@fluxer/api/src/BrandedTypes';
import {Config} from '@fluxer/api/src/Config';
import {Logger} from '@fluxer/api/src/Logger';
import type {PushSubscription} from '@fluxer/api/src/models/PushSubscription';
import {getWorkerDependencies} from '@fluxer/api/src/worker/WorkerContext';
import type {WorkerTaskHandler} from '@fluxer/worker/src/contracts/WorkerTask';
import * as crypto from 'crypto';
import {z} from 'zod';

const PayloadSchema = z.object({
	channelId: z.string(),
	authorId: z.string(),
	authorUsername: z.string(),
	authorAvatar: z.string().optional(),
	channelName: z.string().optional(),
	guildName: z.string().optional(),
	guildId: z.string().optional(),
	content: z.string().optional(),
	recipientUserIds: z.array(z.string()).optional(),
});

// ─── Web Push Protocol Implementation ────────────────────────────────────────
// Implements RFC 8291 (Message Encryption for Web Push) and
// RFC 8292 (VAPID) using Node.js built-in crypto.

function base64UrlEncode(buffer: Buffer): string {
	return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str: string): Buffer {
	let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
	while (base64.length % 4 !== 0) {
		base64 += '=';
	}
	return Buffer.from(base64, 'base64');
}

function createVapidAuthHeaders(
	endpoint: string,
	vapidPublicKey: string,
	vapidPrivateKey: string,
): {authorization: string; cryptoKey: string} {
	const endpointUrl = new URL(endpoint);
	const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

	const header = {typ: 'JWT', alg: 'ES256'};
	const now = Math.floor(Date.now() / 1000);
	const payload = {
		aud: audience,
		exp: now + 12 * 3600,
		sub: 'mailto:noreply@fluxer.world',
	};

	const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)));
	const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
	const unsignedToken = `${headerB64}.${payloadB64}`;

	// Convert URL-safe base64 VAPID private key to a JWK for signing
	const privateKeyBuffer = base64UrlDecode(vapidPrivateKey);
	const publicKeyBuffer = base64UrlDecode(vapidPublicKey);

	// Build the raw PKCS8-like key for Node.js crypto
	const jwk = {
		kty: 'EC',
		crv: 'P-256',
		x: base64UrlEncode(publicKeyBuffer.subarray(1, 33)),
		y: base64UrlEncode(publicKeyBuffer.subarray(33, 65)),
		d: base64UrlEncode(privateKeyBuffer),
	};

	const key = crypto.createPrivateKey({key: jwk, format: 'jwk'});
	const signature = crypto.sign('SHA256', Buffer.from(unsignedToken), {key, dsaEncoding: 'ieee-p1363'});

	const token = `${unsignedToken}.${base64UrlEncode(signature)}`;

	return {
		authorization: `vapid t=${token}, k=${base64UrlEncode(publicKeyBuffer)}`,
		cryptoKey: `p256ecdsa=${base64UrlEncode(publicKeyBuffer)}`,
	};
}

function encryptPayload(
	payload: string,
	p256dhKey: string,
	authKey: string,
): {ciphertext: Buffer; salt: Buffer; localPublicKey: Buffer} {
	const userPublicKey = base64UrlDecode(p256dhKey);
	const userAuth = base64UrlDecode(authKey);

	// Generate local ECDH key pair
	const localKeyPair = crypto.createECDH('prime256v1');
	localKeyPair.generateKeys();
	const localPublicKey = localKeyPair.getPublicKey();

	// Shared secret via ECDH
	const sharedSecret = localKeyPair.computeSecret(userPublicKey);

	// Generate salt
	const salt = crypto.randomBytes(16);

	// PRK for auth (RFC 8291 Section 3.3)
	const authInfo = Buffer.concat([
		Buffer.from('WebPush: info\0'),
		userPublicKey,
		localPublicKey,
	]);
	const prkAuth = crypto.createHmac('sha256', userAuth).update(sharedSecret).digest();

	// IKM (Input Keying Material)
	const ikm = hkdfExpand(prkAuth, authInfo, 32);

	// PRK
	const prk = crypto.createHmac('sha256', salt).update(ikm).digest();

	// Content Encryption Key
	const cekInfo = Buffer.from('Content-Encoding: aes128gcm\0');
	const contentEncryptionKey = hkdfExpand(prk, cekInfo, 16);

	// Nonce
	const nonceInfo = Buffer.from('Content-Encoding: nonce\0');
	const nonce = hkdfExpand(prk, nonceInfo, 12);

	// Encrypt with AES-128-GCM
	const payloadBuffer = Buffer.from(payload, 'utf8');
	// Add padding delimiter (0x02 = final record)
	const paddedPayload = Buffer.concat([payloadBuffer, Buffer.from([2])]);

	const cipher = crypto.createCipheriv('aes-128-gcm', contentEncryptionKey, nonce);
	const encrypted = Buffer.concat([cipher.update(paddedPayload), cipher.final()]);
	const tag = cipher.getAuthTag();

	// Build aes128gcm content coding header
	const recordSize = Buffer.alloc(4);
	recordSize.writeUInt32BE(encrypted.length + tag.length + 1 + 16 + 4 + 1 + localPublicKey.length);

	const header = Buffer.concat([
		salt,                          // 16 bytes salt
		recordSize,                    // 4 bytes record size
		Buffer.from([localPublicKey.length]), // 1 byte key length
		localPublicKey,                // 65 bytes uncompressed EC point
	]);

	const ciphertext = Buffer.concat([header, encrypted, tag]);

	return {ciphertext, salt, localPublicKey: Buffer.from(localPublicKey)};
}

function hkdfExpand(prk: Buffer, info: Buffer, length: number): Buffer {
	const infoWithCounter = Buffer.concat([info, Buffer.from([1])]);
	const hmac = crypto.createHmac('sha256', prk).update(infoWithCounter).digest();
	return hmac.subarray(0, length);
}

async function sendWebPush(
	subscription: PushSubscription,
	payloadJson: string,
	vapidPublicKey: string,
	vapidPrivateKey: string,
): Promise<{success: boolean; statusCode?: number; expired?: boolean}> {
	try {
		const {ciphertext} = encryptPayload(payloadJson, subscription.p256dhKey, subscription.authKey);

		const vapidHeaders = createVapidAuthHeaders(subscription.endpoint, vapidPublicKey, vapidPrivateKey);

		const endpointUrl = new URL(subscription.endpoint);

		const response = await fetch(subscription.endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/octet-stream',
				'Content-Encoding': 'aes128gcm',
				'Content-Length': ciphertext.length.toString(),
				Authorization: vapidHeaders.authorization,
				TTL: '86400',
				Urgency: 'normal',
			},
			body: ciphertext,
		});

		if (response.status === 201 || response.status === 202) {
			return {success: true, statusCode: response.status};
		}

		// 404 or 410 = subscription expired/invalid
		if (response.status === 404 || response.status === 410) {
			return {success: false, statusCode: response.status, expired: true};
		}

		return {success: false, statusCode: response.status};
	} catch (error) {
		Logger.warn({endpoint: subscription.endpoint, error}, 'Failed to send web push');
		return {success: false};
	}
}

// ─── Worker Task ─────────────────────────────────────────────────────────────

const sendPushNotifications: WorkerTaskHandler = async (payload, helpers) => {
	const validated = PayloadSchema.parse(payload);
	helpers.logger.debug({payload: validated}, 'Processing sendPushNotifications task');

	const vapidPublicKey = Config.auth.vapid.publicKey;
	const vapidPrivateKey = Config.auth.vapid.privateKey;

	if (!vapidPublicKey || !vapidPrivateKey || vapidPublicKey === 'YOUR_VAPID_PUBLIC_KEY') {
		helpers.logger.debug('VAPID keys not configured, skipping push notifications');
		return;
	}

	const {userRepository} = getWorkerDependencies();
	const authorId = createUserID(BigInt(validated.authorId));
	const channelId = createChannelID(BigInt(validated.channelId));

	// Determine recipients
	let recipientUserIds: Array<UserID>;

	if (validated.recipientUserIds && validated.recipientUserIds.length > 0) {
		recipientUserIds = validated.recipientUserIds
			.map((id) => createUserID(BigInt(id)))
			.filter((id) => id !== authorId);
	} else {
		helpers.logger.debug('No recipient user IDs provided, skipping');
		return;
	}

	if (recipientUserIds.length === 0) {
		helpers.logger.debug('No recipients after filtering author, skipping');
		return;
	}

	// Fetch push subscriptions for all recipients
	const subscriptionsMap = await userRepository.getBulkPushSubscriptions(recipientUserIds);

	if (subscriptionsMap.size === 0) {
		helpers.logger.debug('No push subscriptions found for recipients');
		return;
	}

	// Build notification payload
	const title = validated.guildName
		? `${validated.authorUsername} in #${validated.channelName ?? 'channel'}`
		: validated.authorUsername;

	const body = validated.content
		? validated.content.substring(0, 200)
		: 'Sent a message';

	const notificationPayload = JSON.stringify({
		title,
		body,
		icon: validated.authorAvatar ?? null,
		badge: '/badge.png',
		tag: `channel-${validated.channelId}`,
		data: {
			url: validated.guildId
				? `/channels/${validated.guildId}/${validated.channelId}`
				: `/channels/@me/${validated.channelId}`,
			channel_id: validated.channelId,
			target_user_id: null,
		},
	});

	// Send to all subscriptions
	let sent = 0;
	let failed = 0;
	const expiredSubscriptions: Array<{userId: UserID; subscriptionId: string}> = [];

	const sendPromises: Array<Promise<void>> = [];

	for (const [userId, subscriptions] of subscriptionsMap) {
		for (const subscription of subscriptions) {
			sendPromises.push(
				(async () => {
					const result = await sendWebPush(subscription, notificationPayload, vapidPublicKey, vapidPrivateKey);
					if (result.success) {
						sent++;
					} else {
						failed++;
						if (result.expired) {
							expiredSubscriptions.push({userId, subscriptionId: subscription.subscriptionId});
						}
					}
				})(),
			);
		}
	}

	await Promise.all(sendPromises);

	// Clean up expired subscriptions
	if (expiredSubscriptions.length > 0) {
		helpers.logger.info({count: expiredSubscriptions.length}, 'Cleaning up expired push subscriptions');
		await Promise.all(
			expiredSubscriptions.map(({userId, subscriptionId}) =>
				userRepository.deletePushSubscription(userId, subscriptionId).catch((err) => {
					helpers.logger.warn({userId, subscriptionId, err}, 'Failed to delete expired push subscription');
				}),
			),
		);
	}

	helpers.logger.info(
		{sent, failed, expired: expiredSubscriptions.length, totalRecipients: recipientUserIds.length},
		'Push notifications sent',
	);
};

export default sendPushNotifications;
