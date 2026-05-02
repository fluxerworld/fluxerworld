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

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
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
