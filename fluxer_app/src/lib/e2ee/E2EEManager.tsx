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

import {
	deleteSessionsForRemoteDevice,
	deleteStoredAccount,
	getInboundGroupSession,
	getOutboundGroupSession,
	getPickleKey,
	getSessionsForRemoteDevice,
	getStoredAccount,
	putInboundGroupSession,
	putOutboundGroupSession,
	putSession,
	putStoredAccount,
} from '@app/lib/e2ee/E2EEKeyStore';
import {Logger} from '@app/lib/Logger';

// We deliberately keep this module independent of the global stores so it
// can be exercised in tests and from worker contexts. State that needs to
// be observed (registration status, etc.) lives in E2EEStore.

const logger = new Logger('E2EEManager');

let olmModulePromise: Promise<typeof import('@matrix-org/olm')> | null = null;

async function ensureOlmInitialised(): Promise<typeof import('@matrix-org/olm')> {
	if (!olmModulePromise) {
		olmModulePromise = (async () => {
			const Olm = (await import('@matrix-org/olm')).default;
			await Olm.init();
			return Olm;
		})();
	}
	return olmModulePromise;
}

export interface IdentityKeys {
	curve25519: string;
	ed25519: string;
}

export interface InitialDeviceKeys {
	device_id: string;
	identity_key: string;
	registration_id: number;
	signed_prekey: {
		id: number;
		public_key: string;
		signature: string;
	};
	one_time_prekeys: Array<{id: number; public_key: string}>;
}

export interface PrekeyBundle {
	user_id: string;
	device_id: string;
	identity_key: string;
	registration_id: number;
	signed_prekey: {
		id: number;
		public_key: string;
		signature: string;
	};
	one_time_prekey: {id: number; public_key: string} | null;
}

export interface EncryptedMessage {
	device_id: string;
	type: 0 | 1;
	body: string;
}

const ONE_TIME_KEY_BATCH_SIZE = 50;
const REPLENISH_THRESHOLD = 10;

export class E2EEManager {
	private accountUserId: string | null = null;
	private deviceId: string | null = null;
	private accountInstance: unknown = null;

	get currentDeviceId(): string | null {
		return this.deviceId;
	}

	async initForUser(userId: string): Promise<void> {
		const Olm = await ensureOlmInitialised();
		const stored = await getStoredAccount(userId);
		const pickleKey = await getPickleKey();

		if (stored) {
			const account = new Olm.Account();
			account.unpickle(pickleKey, stored.pickle);
			this.accountInstance = account;
			this.accountUserId = userId;
			this.deviceId = stored.device_id;
			logger.debug('Loaded existing E2EE account', {userId, deviceId: stored.device_id});
		}
	}

	hasAccount(): boolean {
		return this.accountInstance !== null;
	}

	// Wipe the cached account + the IDB record for the current user so
	// that a follow-up generateInitialKeys/registerFreshDevice flow
	// produces a brand new identity. Used when we detect the local
	// device isn't on the server (failed prior registration, etc.).
	async resetForFreshRegistration(): Promise<void> {
		const userId = this.accountUserId;
		this.accountInstance = null;
		this.deviceId = null;
		if (userId) {
			await deleteStoredAccount(userId);
		}
		this.accountUserId = null;
	}

	private requireAccount(): {account: unknown; userId: string; deviceId: string} {
		if (!this.accountInstance || !this.accountUserId || !this.deviceId) {
			throw new Error('E2EE account not initialised');
		}
		return {account: this.accountInstance, userId: this.accountUserId, deviceId: this.deviceId};
	}

	// Generate a brand-new device. Caller is responsible for posting the
	// returned bundle to /users/@me/e2ee/devices and persisting the
	// resulting state locally on success.
	async generateInitialKeys(userId: string, deviceId: string): Promise<InitialDeviceKeys> {
		const Olm = await ensureOlmInitialised();
		const account = new Olm.Account();
		account.create();

		const identityKeysJson = JSON.parse(account.identity_keys()) as IdentityKeys;
		const curveKey = identityKeysJson.curve25519;
		const ed25519Key = identityKeysJson.ed25519;

		// libolm doesn't have a separate "signed prekey" concept the way
		// Signal does — the identity ed25519 already authenticates the
		// curve25519 identity. Self-sign the curve25519 key so the wire
		// shape matches the schema the API expects, and the signature is
		// verifiable end-to-end.
		const signedPrekeyId = 0;
		const signedPrekeySignature = account.sign(curveKey);

		account.generate_one_time_keys(ONE_TIME_KEY_BATCH_SIZE);
		const oneTimeRaw = JSON.parse(account.one_time_keys()) as {curve25519: Record<string, string>};
		const oneTimePrekeys = Object.entries(oneTimeRaw.curve25519).map(([id, key], index) => ({
			id: hashKeyIdToInt(id, index),
			public_key: key,
			matrix_id: id,
		}));

		// Mark the one-time keys as published — even though we'll only have
		// confirmation when the server acks, we don't want to re-send them
		// in subsequent calls.
		account.mark_keys_as_published();

		const pickleKey = await getPickleKey();
		const pickle = account.pickle(pickleKey);
		await putStoredAccount({user_id: userId, device_id: deviceId, pickle});

		this.accountInstance = account;
		this.accountUserId = userId;
		this.deviceId = deviceId;

		// Store mapping from server prekey IDs back to libolm's keys so we
		// can find the matching key when a sender claims one (libolm wants
		// the raw key string, not our int id).
		await persistKeyIdMap(deviceId, oneTimePrekeys);

		return {
			device_id: deviceId,
			identity_key: curveKey,
			registration_id: deriveRegistrationId(curveKey, ed25519Key),
			signed_prekey: {
				id: signedPrekeyId,
				public_key: curveKey,
				signature: signedPrekeySignature,
			},
			one_time_prekeys: oneTimePrekeys.map((p) => ({id: p.id, public_key: p.public_key})),
		};
	}

	async generateAdditionalOneTimeKeys(): Promise<Array<{id: number; public_key: string}>> {
		const {account: rawAccount, deviceId} = this.requireAccount();
		const account = rawAccount as InstanceType<Awaited<ReturnType<typeof ensureOlmInitialised>>['Account']>;
		account.generate_one_time_keys(ONE_TIME_KEY_BATCH_SIZE);
		const oneTimeRaw = JSON.parse(account.one_time_keys()) as {curve25519: Record<string, string>};
		const newKeys = Object.entries(oneTimeRaw.curve25519).map(([id, key], index) => ({
			id: hashKeyIdToInt(id, index),
			public_key: key,
			matrix_id: id,
		}));
		account.mark_keys_as_published();

		const pickleKey = await getPickleKey();
		const pickle = account.pickle(pickleKey);
		await putStoredAccount({user_id: this.accountUserId!, device_id: deviceId, pickle});
		await persistKeyIdMap(deviceId, newKeys);

		return newKeys.map((k) => ({id: k.id, public_key: k.public_key}));
	}

	async unclaimedOneTimeCountIsLow(currentCount: number): Promise<boolean> {
		return currentCount <= REPLENISH_THRESHOLD;
	}

	// Encrypt a plaintext for every device in the supplied bundle list. If
	// no session exists for a device, X3DH is run inline using the
	// claimed prekey bundle. The output array has the same length as
	// `bundles`; entries are null for devices we couldn't reach (no
	// existing session and no claimable one-time prekey, Olm internal
	// failure, etc.) so the caller can skip them while preserving the
	// indexing it relies on.
	async encryptForBundles(
		bundles: Array<PrekeyBundle>,
		plaintext: string,
	): Promise<Array<EncryptedMessage | null>> {
		const Olm = await ensureOlmInitialised();
		const {account, deviceId: ourDeviceId} = this.requireAccount();
		const pickleKey = await getPickleKey();
		const out: Array<EncryptedMessage | null> = [];

		for (const bundle of bundles) {
			try {
				const session = await this.loadOrCreateOutboundSession(Olm, account, bundle, pickleKey);
				const message = session.encrypt(plaintext) as {type: 0 | 1; body: string};
				out.push({device_id: ourDeviceId, type: message.type, body: message.body});

				await putSession({
					remote_user_id: bundle.user_id,
					remote_device_id: bundle.device_id,
					session_id: session.session_id(),
					pickle: session.pickle(pickleKey),
					created_at: Date.now(),
					last_used_at: Date.now(),
				});
				session.free();
			} catch (error) {
				logger.warn('Skipping unreachable peer bundle', {
					userId: bundle.user_id,
					deviceId: bundle.device_id,
					error,
				});
				out.push(null);
			}
		}

		return out;
	}

	async decrypt(
		remoteUserId: string,
		remoteDeviceId: string,
		remoteIdentityKey: string,
		message: EncryptedMessage,
	): Promise<string> {
		const Olm = await ensureOlmInitialised();
		const {account} = this.requireAccount();
		const pickleKey = await getPickleKey();

		const existingSessions = await getSessionsForRemoteDevice(remoteUserId, remoteDeviceId);
		for (const stored of existingSessions) {
			const session = new Olm.Session();
			session.unpickle(pickleKey, stored.pickle);
			try {
				if (message.type === 1 || (message.type === 0 && session.matches_inbound(message.body))) {
					const plaintext = session.decrypt(message.type, message.body);
					await putSession({
						...stored,
						pickle: session.pickle(pickleKey),
						last_used_at: Date.now(),
					});
					session.free();
					return plaintext;
				}
				session.free();
			} catch (err) {
				logger.warn('Olm session failed to decrypt, will try alternatives', {err});
				session.free();
			}
		}

		// Fall back to creating a new inbound session from a prekey message.
		if (message.type !== 0) {
			throw new Error('No matching session and message is not a prekey message');
		}
		const session = new Olm.Session();
		const accountTyped = account as InstanceType<Awaited<ReturnType<typeof ensureOlmInitialised>>['Account']>;
		session.create_inbound_from(accountTyped, remoteIdentityKey, message.body);
		const plaintext = session.decrypt(message.type, message.body);
		accountTyped.remove_one_time_keys(session);

		const accountPickle = accountTyped.pickle(pickleKey);
		await putStoredAccount({user_id: this.accountUserId!, device_id: this.deviceId!, pickle: accountPickle});

		await putSession({
			remote_user_id: remoteUserId,
			remote_device_id: remoteDeviceId,
			session_id: session.session_id(),
			pickle: session.pickle(pickleKey),
			created_at: Date.now(),
			last_used_at: Date.now(),
		});
		session.free();
		return plaintext;
	}

	async forgetSessionsForDevice(remoteUserId: string, remoteDeviceId: string): Promise<void> {
		await deleteSessionsForRemoteDevice(remoteUserId, remoteDeviceId);
	}

	// ── Megolm (group DM E2EE) ──────────────────────────────────────────
	// One outbound session per channel for the sender. Returns the
	// existing session if one is stored; creates and persists a new one
	// otherwise. The returned object's session_key is the secret that
	// must be encrypted to each recipient device via Olm and posted to
	// the group-session endpoint so members can decrypt subsequent
	// messages.
	async getOrCreateOutboundGroupSession(channelId: string): Promise<{
		sessionId: string;
		sessionKey: string;
		isNew: boolean;
	}> {
		const Olm = await ensureOlmInitialised();
		const pickleKey = await getPickleKey();
		const existing = await getOutboundGroupSession(channelId);
		if (existing) {
			const session = new Olm.OutboundGroupSession();
			try {
				session.unpickle(pickleKey, existing.pickle);
				const result = {sessionId: session.session_id(), sessionKey: session.session_key(), isNew: false};
				session.free();
				return result;
			} catch (err) {
				session.free();
				logger.warn('Stored outbound group session unpickle failed, creating new', {channelId, err});
				// Fall through to fresh creation.
			}
		}
		const session = new Olm.OutboundGroupSession();
		session.create();
		const sessionId = session.session_id();
		const sessionKey = session.session_key();
		const pickle = session.pickle(pickleKey);
		session.free();
		await putOutboundGroupSession({
			channel_id: channelId,
			session_id: sessionId,
			pickle,
			created_at: Date.now(),
			message_count: 0,
		});
		return {sessionId, sessionKey, isNew: true};
	}

	// Encrypt a message with the current outbound group session.
	// Auto-creates the session if none exists (caller is expected to
	// distribute the session_key in that case — see isNew on the get
	// helper for the signal). Always persists the post-encrypt session
	// state so the ratchet survives reloads.
	async encryptGroupMessage(channelId: string, plaintext: string): Promise<{
		sessionId: string;
		ciphertext: string;
		messageIndex: number;
	}> {
		const Olm = await ensureOlmInitialised();
		const pickleKey = await getPickleKey();
		const existing = await getOutboundGroupSession(channelId);
		if (!existing) {
			throw new Error(`No outbound group session for channel ${channelId} — call getOrCreateOutboundGroupSession first.`);
		}
		const session = new Olm.OutboundGroupSession();
		session.unpickle(pickleKey, existing.pickle);
		const ciphertext = session.encrypt(plaintext);
		const messageIndex = session.message_index();
		const sessionId = session.session_id();
		const pickle = session.pickle(pickleKey);
		session.free();
		await putOutboundGroupSession({
			...existing,
			session_id: sessionId,
			pickle,
			message_count: existing.message_count + 1,
		});
		return {sessionId, ciphertext, messageIndex};
	}

	// Persist a received group session key as an inbound session. Called
	// by recipients when they receive a session_key (decrypted from an
	// Olm-wrapped session-key payload). Idempotent — if we already have
	// this session, the put just refreshes the pickle.
	async importInboundGroupSession(params: {
		channelId: string;
		senderUserId: string;
		senderDeviceId: string;
		senderIdentityKey: string;
		sessionKey: string;
	}): Promise<{sessionId: string}> {
		const Olm = await ensureOlmInitialised();
		const pickleKey = await getPickleKey();
		const session = new Olm.InboundGroupSession();
		try {
			session.create(params.sessionKey);
			const sessionId = session.session_id();
			const pickle = session.pickle(pickleKey);
			session.free();
			await putInboundGroupSession({
				channel_id: params.channelId,
				sender_user_id: params.senderUserId,
				sender_device_id: params.senderDeviceId,
				session_id: sessionId,
				pickle,
				sender_identity_key: params.senderIdentityKey,
				created_at: Date.now(),
			});
			return {sessionId};
		} catch (err) {
			session.free();
			throw err;
		}
	}

	// Decrypt an inbound group message. Caller must already have imported
	// the matching session via importInboundGroupSession — if not, this
	// throws and the caller is expected to request the session from the
	// sender (out of band).
	async decryptGroupMessage(params: {
		channelId: string;
		senderUserId: string;
		senderDeviceId: string;
		sessionId: string;
		ciphertext: string;
	}): Promise<{plaintext: string; messageIndex: number}> {
		const Olm = await ensureOlmInitialised();
		const pickleKey = await getPickleKey();
		const stored = await getInboundGroupSession(
			params.channelId,
			params.senderUserId,
			params.senderDeviceId,
			params.sessionId,
		);
		if (!stored) {
			throw new Error(`No inbound group session for ${params.channelId}/${params.senderDeviceId}/${params.sessionId}`);
		}
		const session = new Olm.InboundGroupSession();
		session.unpickle(pickleKey, stored.pickle);
		try {
			const {plaintext, message_index} = session.decrypt(params.ciphertext);
			session.free();
			// IMPORTANT: do NOT persist the ratcheted state. Megolm's
			// internal ratchet may advance during decrypt and forget the
			// derivation path to earlier indices, which would make a
			// future history-fetch decrypt of older messages fail (the
			// classic "everything garbled after refresh" symptom).
			// The stored pickle is kept at first_known_index — every
			// future decrypt re-derives from there, which is cheap for
			// chat-sized session lengths.
			return {plaintext, messageIndex: message_index};
		} catch (err) {
			session.free();
			throw err;
		}
	}

	private async loadOrCreateOutboundSession(
		Olm: Awaited<ReturnType<typeof ensureOlmInitialised>>,
		account: unknown,
		bundle: PrekeyBundle,
		pickleKey: string,
	) {
		const existing = await getSessionsForRemoteDevice(bundle.user_id, bundle.device_id);
		const recent = existing.sort((a, b) => b.last_used_at - a.last_used_at)[0];
		if (recent) {
			const session = new Olm.Session();
			session.unpickle(pickleKey, recent.pickle);
			return session;
		}

		if (!bundle.one_time_prekey) {
			throw new Error(`No one-time prekey available for ${bundle.user_id}:${bundle.device_id}`);
		}

		const session = new Olm.Session();
		const accountTyped = account as InstanceType<typeof Olm.Account>;
		session.create_outbound(accountTyped, bundle.identity_key, bundle.one_time_prekey.public_key);
		return session;
	}

}

// Stable mapping from libolm one-time key IDs (base64 strings of varying
// length) to the int IDs we publish to the server. The hash blends the
// matrix_id with the index so two batches with overlapping prefixes don't
// collide.
function hashKeyIdToInt(matrixId: string, index: number): number {
	let h = 0;
	for (let i = 0; i < matrixId.length; i++) {
		h = (h * 31 + matrixId.charCodeAt(i)) | 0;
	}
	return Math.abs((h ^ (index << 16)) | 0);
}

function deriveRegistrationId(curveKey: string, ed25519Key: string): number {
	let h = 0;
	const combined = `${curveKey}:${ed25519Key}`;
	for (let i = 0; i < combined.length; i++) {
		h = (h * 33 + combined.charCodeAt(i)) | 0;
	}
	return Math.abs(h) & 0x7fffffff;
}

async function persistKeyIdMap(_deviceId: string, _keys: Array<{id: number; matrix_id: string}>): Promise<void> {
	// Phase 1 placeholder. The libolm-id <-> server-id mapping only matters
	// when we want to top up rather than wholesale-republish, and the
	// initial implementation always replaces. Fold this in when we add
	// the partial top-up path.
}

export const e2eeManager = new E2EEManager();
