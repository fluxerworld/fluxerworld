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

import * as E2EEActionCreators from '@app/actions/E2EEActionCreators';
import {
	deleteVerification as deleteVerificationFromIDB,
	getVerification,
	getVerificationsForUser,
	putVerification,
	type VerificationEntry,
} from '@app/lib/e2ee/E2EEKeyStore';
import {e2eeManager} from '@app/lib/e2ee/E2EEManager';
import {Logger} from '@app/lib/Logger';
import {makeAutoObservable, runInAction} from 'mobx';

const logger = new Logger('E2EEStore');

export type RegistrationStatus = 'idle' | 'initialising' | 'registering' | 'ready' | 'error';

class E2EEStore {
	currentUserId: string | null = null;
	deviceId: string | null = null;
	registrationStatus: RegistrationStatus = 'idle';
	lastError: string | null = null;
	encryptedChannelIds = new Set<string>();

	// In-memory cache mirroring the IndexedDB verification store. Populated
	// lazily per remote user the first time the UI asks. Keyed by
	// remote_user_id -> Map<remote_device_id, VerificationEntry>. Components
	// observe this cache instead of going to IDB on every render.
	private verificationCache = new Map<string, Map<string, VerificationEntry>>();
	private verificationLoadPromises = new Map<string, Promise<void>>();

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
	}

	isChannelEncrypted(channelId: string): boolean {
		return this.encryptedChannelIds.has(channelId);
	}

	setChannelEncrypted(channelId: string, enabled: boolean): void {
		runInAction(() => {
			if (enabled) this.encryptedChannelIds.add(channelId);
			else this.encryptedChannelIds.delete(channelId);
		});
	}

	// Returns the cached verification entry, or null if either no entry
	// exists or the cache hasn't been hydrated yet. Call ensureVerifications
	// once before relying on a synchronous result.
	getVerification(remoteUserId: string, remoteDeviceId: string): VerificationEntry | null {
		return this.verificationCache.get(remoteUserId)?.get(remoteDeviceId) ?? null;
	}

	getVerificationsForUser(remoteUserId: string): Array<VerificationEntry> {
		const map = this.verificationCache.get(remoteUserId);
		return map ? Array.from(map.values()) : [];
	}

	async ensureVerificationsForUser(remoteUserId: string): Promise<void> {
		if (this.verificationCache.has(remoteUserId)) return;
		const inflight = this.verificationLoadPromises.get(remoteUserId);
		if (inflight) return inflight;
		const promise = (async () => {
			const entries = await getVerificationsForUser(remoteUserId);
			runInAction(() => {
				const map = new Map<string, VerificationEntry>();
				for (const e of entries) map.set(e.remote_device_id, e);
				this.verificationCache.set(remoteUserId, map);
			});
		})();
		this.verificationLoadPromises.set(remoteUserId, promise);
		try {
			await promise;
		} finally {
			this.verificationLoadPromises.delete(remoteUserId);
		}
	}

	async markVerified(
		remoteUserId: string,
		remoteDeviceId: string,
		identityKey: string,
		source: VerificationEntry['source'] = 'manual',
	): Promise<void> {
		const entry: VerificationEntry = {
			remote_user_id: remoteUserId,
			remote_device_id: remoteDeviceId,
			identity_key: identityKey,
			verified_at: Date.now(),
			source,
		};
		await putVerification(entry);
		runInAction(() => {
			let map = this.verificationCache.get(remoteUserId);
			if (!map) {
				map = new Map<string, VerificationEntry>();
				this.verificationCache.set(remoteUserId, map);
			}
			map.set(remoteDeviceId, entry);
		});
	}

	async clearVerification(remoteUserId: string, remoteDeviceId: string): Promise<void> {
		await deleteVerificationFromIDB(remoteUserId, remoteDeviceId);
		runInAction(() => {
			this.verificationCache.get(remoteUserId)?.delete(remoteDeviceId);
		});
	}

	// Compares a freshly observed identity key against the cached
	// verification. Returns:
	//   'verified' — verified entry exists and the keys match
	//   'changed'  — verified entry exists but the keys disagree (warn!)
	//   'unverified' — no entry, never verified
	checkVerificationStatus(
		remoteUserId: string,
		remoteDeviceId: string,
		observedIdentityKey: string,
	): 'verified' | 'changed' | 'unverified' {
		const entry = this.getVerification(remoteUserId, remoteDeviceId);
		if (!entry) return 'unverified';
		return entry.identity_key === observedIdentityKey ? 'verified' : 'changed';
	}

	// One-shot load that uses IDB synchronously after caching, used by code
	// paths that can't await before the first read (e.g. message rendering
	// the first time a peer's bubble appears).
	async checkVerificationStatusAsync(
		remoteUserId: string,
		remoteDeviceId: string,
		observedIdentityKey: string,
	): Promise<'verified' | 'changed' | 'unverified'> {
		const cached = this.verificationCache.get(remoteUserId)?.get(remoteDeviceId);
		if (cached) {
			return cached.identity_key === observedIdentityKey ? 'verified' : 'changed';
		}
		const stored = await getVerification(remoteUserId, remoteDeviceId);
		if (!stored) return 'unverified';
		runInAction(() => {
			let map = this.verificationCache.get(remoteUserId);
			if (!map) {
				map = new Map<string, VerificationEntry>();
				this.verificationCache.set(remoteUserId, map);
			}
			map.set(remoteDeviceId, stored);
		});
		return stored.identity_key === observedIdentityKey ? 'verified' : 'changed';
	}

	get isReady(): boolean {
		return this.registrationStatus === 'ready' && this.deviceId !== null;
	}

	// Called once after the user is authenticated. Loads any existing
	// account from IndexedDB; if none exists, generates a fresh device
	// and publishes the bundle to the server. Idempotent — safe to call
	// repeatedly. The first call wins; concurrent callers wait on the
	// resulting promise.
	private bootstrapPromise: Promise<void> | null = null;
	bootstrap(userId: string): Promise<void> {
		if (this.bootstrapPromise && this.currentUserId === userId) {
			return this.bootstrapPromise;
		}
		this.bootstrapPromise = this.doBootstrap(userId).catch((error) => {
			runInAction(() => {
				this.registrationStatus = 'error';
				this.lastError = error instanceof Error ? error.message : String(error);
			});
			logger.error('E2EE bootstrap failed', {error});
			throw error;
		});
		return this.bootstrapPromise;
	}

	private async doBootstrap(userId: string): Promise<void> {
		runInAction(() => {
			this.currentUserId = userId;
			this.registrationStatus = 'initialising';
			this.lastError = null;
		});

		await e2eeManager.initForUser(userId);

		if (e2eeManager.hasAccount() && e2eeManager.currentDeviceId) {
			runInAction(() => {
				this.deviceId = e2eeManager.currentDeviceId;
				this.registrationStatus = 'ready';
			});
			logger.debug('E2EE already registered for this install', {deviceId: this.deviceId});
			void this.maybeReplenishOneTimeKeys();
			return;
		}

		runInAction(() => {
			this.registrationStatus = 'registering';
		});

		const deviceId = generateDeviceId();
		const bundle = await e2eeManager.generateInitialKeys(userId, deviceId);
		await E2EEActionCreators.registerDevice({
			device_id: bundle.device_id,
			device_name: detectDeviceName(),
			identity_key: bundle.identity_key,
			registration_id: bundle.registration_id,
			signed_prekey: bundle.signed_prekey,
			one_time_prekeys: bundle.one_time_prekeys,
		});

		runInAction(() => {
			this.deviceId = deviceId;
			this.registrationStatus = 'ready';
		});
		logger.info('Registered new E2EE device', {deviceId});
	}

	// Called periodically (and after every encrypt) by E2EEManager wiring
	// once we add the message-flow integration. For now exposed publicly
	// so the bootstrap flow can run a check on startup; harmless to call
	// when the device already has plenty of keys queued.
	async maybeReplenishOneTimeKeys(): Promise<void> {
		if (!this.deviceId) return;
		try {
			const devices = await E2EEActionCreators.listOwnDevices();
			const ours = devices.find((d) => d.device_id === this.deviceId);
			if (!ours) {
				logger.warn('Own device missing from server-side device list, re-registering on next bootstrap');
				return;
			}
			if (ours.one_time_prekey_count > 10) return;

			const fresh = await e2eeManager.generateAdditionalOneTimeKeys();
			await E2EEActionCreators.topUpOneTimePrekeys(this.deviceId, fresh);
			logger.debug('Topped up one-time prekeys', {added: fresh.length});
		} catch (error) {
			logger.warn('One-time prekey replenish failed', {error});
		}
	}

	// Wipe local E2EE state. Used on logout to avoid leaking session
	// material into the next account that signs in on the same install.
	reset(): void {
		runInAction(() => {
			this.currentUserId = null;
			this.deviceId = null;
			this.registrationStatus = 'idle';
			this.lastError = null;
			this.bootstrapPromise = null;
			this.verificationCache.clear();
			this.verificationLoadPromises.clear();
		});
	}
}

function generateDeviceId(): string {
	if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function detectDeviceName(): string {
	if (typeof navigator === 'undefined') return 'Unknown device';
	const ua = navigator.userAgent ?? '';
	if (/Android/i.test(ua)) return 'Android';
	if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
	if (/Mac/i.test(ua)) return 'macOS';
	if (/Windows/i.test(ua)) return 'Windows';
	if (/Linux/i.test(ua)) return 'Linux';
	return 'Web';
}

export default new E2EEStore();
