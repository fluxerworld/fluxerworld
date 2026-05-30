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
import {Endpoints} from '@app/Endpoints';
import http from '@app/lib/HttpClient';
import * as E2EEBackup from '@app/lib/e2ee/E2EEBackup';
import ChannelStore from '@app/stores/ChannelStore';
import {
	deleteSessionsForRemoteDevice,
	deleteVerification as deleteVerificationFromIDB,
	getVerification,
	getVerificationsForUser,
	putVerification,
	setPeerIdentityKey,
	type VerificationEntry,
} from '@app/lib/e2ee/E2EEKeyStore';
import {e2eeManager} from '@app/lib/e2ee/E2EEManager';
import {clearAllMessageCaches} from '@app/lib/e2ee/E2EEMessageIntegration';
import {revokeAllDecryptedAttachments} from '@app/lib/e2ee/EncryptedAttachmentLoader';
import {Logger} from '@app/lib/Logger';
import {makeAutoObservable, runInAction} from 'mobx';

const logger = new Logger('E2EEStore');

export type RegistrationStatus =
	| 'idle'
	| 'initialising'
	| 'awaiting_backup_decision'
	| 'registering'
	| 'ready'
	| 'error';

export interface PendingBackup {
	created_at: string;
	updated_at: string;
}

class E2EEStore {
	currentUserId: string | null = null;
	deviceId: string | null = null;
	registrationStatus: RegistrationStatus = 'idle';
	lastError: string | null = null;
	pendingBackup: PendingBackup | null = null;
	encryptedChannelIds = new Set<string>();

	// In-memory cache mirroring the IndexedDB verification store. Populated
	// lazily per remote user the first time the UI asks. Keyed by
	// remote_user_id -> Map<remote_device_id, VerificationEntry>. Components
	// observe this cache instead of going to IDB on every render.
	private verificationCache = new Map<string, Map<string, VerificationEntry>>();
	private verificationLoadPromises = new Map<string, Promise<void>>();

	// Cache of the peer's currently-published device list. Refreshed when
	// the DM is opened (and on demand) so we can spot devices the peer
	// added since the last verification — those land as unverified and
	// drop the channel-level shield to "partial". Without this we'd never
	// notice a brand-new device until a message decrypt failed.
	private peerDeviceCache = new Map<string, ReadonlyArray<E2EEActionCreators.E2EEPublicDeviceResponse>>();
	private peerDeviceFetchedAt = new Map<string, number>();
	private peerDeviceInflight = new Map<string, Promise<void>>();

	// Throttle for opportunistic one-time-prekey replenish checks. Each
	// successful encrypt schedules a check, but we don't want N parallel
	// /devices fetches per chatty session — once every five minutes is
	// plenty given the 50-key initial budget and the 10-key replenish
	// threshold.
	private lastReplenishCheckAt = 0;
	private replenishInflight: Promise<void> | null = null;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
	}

	// DEAD CODE as of the always-on E2EE migration (Phase B+C): isChannelEncrypted
	// and setChannelEncrypted no longer have callers — encryption is gated on
	// channel TYPE, not this flag, and the toggle UI is gone. Kept intact for one
	// release cycle alongside the 204-noop PUT /channels/:id/e2ee endpoint.
	// TODO (Phase D): delete both methods and drop the e2ee_enabled column.
	//
	// Encryption state lives on the DM channel record now (server-side
	// shared flag). Reading from ChannelStore means CHANNEL_UPDATE events
	// from the gateway flow into the UI for both participants without any
	// extra plumbing. The local `encryptedChannelIds` set is left in place
	// as a transient mirror in case future code needs to subscribe — but
	// the channel record is authoritative.
	isChannelEncrypted(channelId: string): boolean {
		const channel = ChannelStore.getChannel(channelId);
		return Boolean(channel?.e2eeEnabled);
	}

	async setChannelEncrypted(channelId: string, enabled: boolean): Promise<void> {
		// Fire the server-side toggle. The other participant's client gets
		// CHANNEL_UPDATE via gateway and re-renders without refresh.
		try {
			await http.put(Endpoints.CHANNEL_E2EE(channelId), {enabled});
		} catch (err) {
			logger.error('Failed to toggle channel E2EE', {channelId, enabled, error: err});
		}
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

	// Channel-level "is this peer verified" indicator. True when we have at
	// least one verification entry for the remote user. This is a coarse
	// signal — a peer with multiple devices where only some are verified
	// will read as verified here. The fingerprint modal is what surfaces
	// per-device status. Call ensureVerificationsForUser before relying on
	// the result, otherwise a cold cache reads as not-verified.
	isPeerVerified(remoteUserId: string): boolean {
		const map = this.verificationCache.get(remoteUserId);
		return map !== undefined && map.size > 0;
	}

	// Three-state verification readout, computed against the peer's live
	// device list (not just the verification cache). Falls back to
	// isPeerVerified when the device list hasn't been fetched yet so we
	// don't briefly show "unverified" before the network round-trip.
	//   'verified'   — every published device of the peer is in our
	//                  verification store (and matches its identity key)
	//   'partial'    — some but not all peer devices are verified, OR a
	//                  verified device's identity key has rotated
	//                  (treated as a re-verify situation)
	//   'unverified' — no devices verified yet
	getPeerVerificationStatus(remoteUserId: string): 'verified' | 'partial' | 'unverified' {
		const verifications = this.verificationCache.get(remoteUserId);
		const verifiedCount = verifications?.size ?? 0;

		const devices = this.peerDeviceCache.get(remoteUserId);
		if (!devices) {
			return verifiedCount > 0 ? 'verified' : 'unverified';
		}

		if (devices.length === 0) return 'unverified';
		if (!verifications || verifications.size === 0) return 'unverified';

		let verifiedDevices = 0;
		let mismatched = false;
		for (const device of devices) {
			const entry = verifications.get(device.device_id);
			if (!entry) continue;
			if (entry.identity_key !== device.identity_key) {
				mismatched = true;
				continue;
			}
			verifiedDevices++;
		}

		if (mismatched) return 'partial';
		if (verifiedDevices === devices.length) return 'verified';
		if (verifiedDevices > 0) return 'partial';
		return 'unverified';
	}

	getPeerDevices(remoteUserId: string): ReadonlyArray<E2EEActionCreators.E2EEPublicDeviceResponse> | null {
		return this.peerDeviceCache.get(remoteUserId) ?? null;
	}

	// Manual escape hatch for "encryption is broken with this peer." Wipes
	// every locally stored Olm session for the peer's devices and the
	// cached identity-key hashes, so the next encrypt builds a clean
	// session against whatever identity_key the server hands back. The
	// rotation guard in tryEncryptForChannel does this automatically when
	// it detects an identity change, but this button covers the cases
	// where a session goes bad without a visible identity rotation
	// (corrupted ratchet, lost recipient state, etc.).
	async resetSessionsForPeer(remoteUserId: string): Promise<void> {
		// Refresh the device list before iterating — the cached copy may
		// predate a re-registration we need to clean up after.
		await this.refreshPeerDevices(remoteUserId);
		const devices = this.peerDeviceCache.get(remoteUserId) ?? [];
		for (const device of devices) {
			await deleteSessionsForRemoteDevice(remoteUserId, device.device_id);
			// Reset the cached identity to the current one so the rotation
			// guard doesn't double-fire on the next encrypt.
			await setPeerIdentityKey(remoteUserId, device.device_id, device.identity_key);
		}
		logger.info('Reset E2EE sessions for peer', {remoteUserId, deviceCount: devices.length});
	}

	// Refresh the cached peer device list from the server. Dedupes
	// concurrent callers via the inflight map. Stale-while-revalidate: a
	// previous cache stays visible until the new fetch resolves.
	async refreshPeerDevices(remoteUserId: string, options?: {minIntervalMs?: number}): Promise<void> {
		const minInterval = options?.minIntervalMs ?? 0;
		if (minInterval > 0) {
			const fetchedAt = this.peerDeviceFetchedAt.get(remoteUserId) ?? 0;
			if (Date.now() - fetchedAt < minInterval) return;
		}
		const inflight = this.peerDeviceInflight.get(remoteUserId);
		if (inflight) return inflight;

		const promise = (async () => {
			try {
				const devices = await E2EEActionCreators.listPublicDevices(remoteUserId);
				runInAction(() => {
					this.peerDeviceCache.set(remoteUserId, devices);
					this.peerDeviceFetchedAt.set(remoteUserId, Date.now());
				});
			} catch (error) {
				logger.warn('Failed to refresh peer device list', {remoteUserId, error});
			}
		})();
		this.peerDeviceInflight.set(remoteUserId, promise);
		try {
			await promise;
		} finally {
			this.peerDeviceInflight.delete(remoteUserId);
		}
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
	private lastBootstrapFailureAt = 0;
	private readonly BOOTSTRAP_RETRY_MIN_MS = 30_000;
	bootstrap(userId: string): Promise<void> {
		if (this.bootstrapPromise && this.currentUserId === userId) {
			return this.bootstrapPromise;
		}
		// Throttle retries after a recent failure so a flapping gateway
		// connection doesn't hammer registerDevice. Resolves rather than
		// rejects — the Ready.tsx fire-and-forget call site swallows
		// rejections anyway, and resolving avoids unhandled-rejection
		// noise in dev tools.
		if (
			this.currentUserId === userId &&
			this.registrationStatus === 'error' &&
			Date.now() - this.lastBootstrapFailureAt < this.BOOTSTRAP_RETRY_MIN_MS
		) {
			return Promise.resolve();
		}
		this.bootstrapPromise = this.doBootstrap(userId).catch((error) => {
			runInAction(() => {
				this.registrationStatus = 'error';
				this.lastError = error instanceof Error ? error.message : String(error);
			});
			// Clear the cached promise so the next READY (gateway reconnect)
			// builds a fresh attempt instead of returning the rejected one.
			// Without this, a single network blip during the first bootstrap
			// stuck the tab until manual reload.
			this.lastBootstrapFailureAt = Date.now();
			this.bootstrapPromise = null;
			const message = error instanceof Error ? error.message : String(error);
			const stack = error instanceof Error && error.stack ? error.stack : '(no stack)';
			logger.error(`E2EE bootstrap failed: ${message} | stack: ${stack}`);
			throw error;
		});
		return this.bootstrapPromise;
	}

	private async doBootstrap(userId: string): Promise<void> {
		runInAction(() => {
			this.currentUserId = userId;
			this.registrationStatus = 'initialising';
			this.lastError = null;
			this.pendingBackup = null;
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

		// No local account on this install. We used to pause here to ask the
		// user whether to restore from a server-side backup before generating
		// a fresh device. That gate has been removed: a stuck user blocks
		// the whole conversation (their isReady stays false, so encrypt fails
		// and the peer keeps getting "can't encrypt" errors). Old test-era
		// Olm sessions are forward-secret and already unrecoverable, so the
		// trade-off is acceptable. A future explicit "Restore from backup"
		// affordance can still call restorePendingBackup() out-of-band.
		await this.registerFreshDevice(userId);
	}

	private async registerFreshDevice(userId: string): Promise<void> {
		runInAction(() => {
			this.registrationStatus = 'registering';
			this.pendingBackup = null;
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

	// User-driven decisions out of the awaiting_backup_decision state.
	async restorePendingBackup(passphrase: string): Promise<void> {
		const userId = this.currentUserId;
		if (!userId) throw new Error('No active session');
		if (this.registrationStatus !== 'awaiting_backup_decision') {
			throw new Error('No backup decision pending');
		}
		await E2EEBackup.downloadAndRestoreBackup(passphrase);
		await e2eeManager.initForUser(userId);
		if (!e2eeManager.hasAccount() || !e2eeManager.currentDeviceId) {
			throw new Error('Backup did not contain a device account');
		}
		runInAction(() => {
			this.deviceId = e2eeManager.currentDeviceId;
			this.registrationStatus = 'ready';
			this.pendingBackup = null;
			this.bootstrapPromise = null;
		});
		void this.maybeReplenishOneTimeKeys();
	}

	async skipPendingBackupAndRegister(): Promise<void> {
		const userId = this.currentUserId;
		if (!userId) throw new Error('No active session');
		if (this.registrationStatus !== 'awaiting_backup_decision') {
			throw new Error('No backup decision pending');
		}
		await this.registerFreshDevice(userId);
	}

	// Throttled wrapper around maybeReplenishOneTimeKeys. Safe to call on
	// every successful encrypt — back-to-back calls within the throttle
	// window resolve to the inflight check rather than firing a fresh
	// /devices fetch each time.
	scheduleReplenishCheck(): void {
		const REPLENISH_INTERVAL_MS = 5 * 60_000;
		if (this.replenishInflight) return;
		if (Date.now() - this.lastReplenishCheckAt < REPLENISH_INTERVAL_MS) return;
		this.lastReplenishCheckAt = Date.now();
		this.replenishInflight = this.maybeReplenishOneTimeKeys().finally(() => {
			this.replenishInflight = null;
		});
	}

	// Called periodically (and after every encrypt) by E2EEManager wiring
	// once we add the message-flow integration. For now exposed publicly
	// so the bootstrap flow can run a check on startup; harmless to call
	// when the device already has plenty of keys queued.
	async maybeReplenishOneTimeKeys(): Promise<void> {
		if (!this.deviceId || !this.currentUserId) return;
		try {
			const devices = await E2EEActionCreators.listOwnDevices();
			const ours = devices.find((d) => d.device_id === this.deviceId);
			if (!ours) {
				// Local IDB has a device the server doesn't know about —
				// almost always because the previous registration call
				// failed or the device was wiped server-side. Force a
				// fresh registration so the rest of the flow has a real
				// device to point at instead of silently sending requests
				// the server rejects.
				logger.warn('Own device missing from server-side device list, re-registering');
				const userId = this.currentUserId;
				await e2eeManager.resetForFreshRegistration();
				runInAction(() => {
					this.deviceId = null;
				});
				await this.registerFreshDevice(userId);
				return;
			}
			if (ours.one_time_prekey_count > 10) return;

			const previousCount = ours.one_time_prekey_count;
			const fresh = await e2eeManager.generateAdditionalOneTimeKeys();
			await E2EEActionCreators.topUpOneTimePrekeys(this.deviceId, fresh);
			logger.info('Topped up one-time prekeys', {
				added: fresh.length,
				deviceId: this.deviceId,
				previousCount,
			});
			// When we topped up from a critically low count, peers are likely
			// still draining what we just uploaded as fast as we can post it.
			// Reset the throttle so the very next encrypt re-checks instead of
			// waiting the full 5 minutes.
			if (previousCount <= 1) {
				this.lastReplenishCheckAt = 0;
			}
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
			this.pendingBackup = null;
			this.bootstrapPromise = null;
			this.lastBootstrapFailureAt = 0;
			this.verificationCache.clear();
			this.verificationLoadPromises.clear();
			this.peerDeviceCache.clear();
			this.peerDeviceFetchedAt.clear();
			this.peerDeviceInflight.clear();
			this.lastReplenishCheckAt = 0;
			this.replenishInflight = null;
		});
		clearAllMessageCaches();
		revokeAllDecryptedAttachments();
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
