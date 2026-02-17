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

import UserSettingsStore from '@app/stores/UserSettingsStore';
import {makeAutoObservable} from 'mobx';

const IMPLICITLY_TRUSTED_DOMAINS = [
	'fluxer.app',
	'*.fluxer.app',
	'fluxer.gg',
	'fluxer.gift',
	'fluxerusercontent.com',
	'fluxerstatic.com',
] as const;

const TRUSTED_DOMAINS_LOCALSTORAGE_KEY = 'TrustedDomainStore';

class TrustedDomainStore {
	private migrationChecked = false;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
	}

	get trustedDomains(): ReadonlyArray<string> {
		return UserSettingsStore.getTrustedDomains();
	}

	get trustAllDomains(): boolean {
		return UserSettingsStore.trustAllDomains();
	}

	async checkAndMigrateLegacyData(): Promise<void> {
		if (this.migrationChecked) return;
		this.migrationChecked = true;

		const legacyData = localStorage.getItem(TRUSTED_DOMAINS_LOCALSTORAGE_KEY);
		if (!legacyData) return;

		try {
			const parsed = JSON.parse(legacyData);
			const legacyDomains: Array<string> = parsed?.trustedDomains ?? [];

			if (legacyDomains.length > 0 && UserSettingsStore.getTrustedDomains().length === 0) {
				await UserSettingsStore.saveSettings({trustedDomains: legacyDomains});
				localStorage.removeItem(TRUSTED_DOMAINS_LOCALSTORAGE_KEY);
			}
		} catch {}
	}

	async addTrustedDomain(domain: string): Promise<void> {
		if (this.trustAllDomains) return;

		const current = [...this.trustedDomains];
		if (current.includes(domain)) return;

		await UserSettingsStore.saveSettings({
			trustedDomains: [...current, domain],
		});
	}

	async removeTrustedDomain(domain: string): Promise<void> {
		const current = [...this.trustedDomains];
		if (!current.includes(domain)) return;

		await UserSettingsStore.saveSettings({
			trustedDomains: current.filter((d) => d !== domain),
		});
	}

	async clearAllTrustedDomains(): Promise<void> {
		await UserSettingsStore.saveSettings({trustedDomains: []});
	}

	async setTrustAllDomains(trustAll: boolean): Promise<void> {
		if (trustAll) {
			await UserSettingsStore.saveSettings({trustedDomains: ['*']});
		} else {
			await UserSettingsStore.saveSettings({trustedDomains: []});
		}
	}

	isTrustedDomain(hostname: string): boolean {
		if (this.trustAllDomains) return true;

		const currentHostname = location.hostname;
		if (hostname === currentHostname) return true;

		for (const pattern of IMPLICITLY_TRUSTED_DOMAINS) {
			if (this.matchesDomainPattern(hostname, pattern)) return true;
		}

		return this.trustedDomains.some((pattern) => this.matchesDomainPattern(hostname, pattern));
	}

	private matchesDomainPattern(hostname: string, pattern: string): boolean {
		if (pattern.startsWith('*.')) {
			const baseDomain = pattern.slice(2);
			return hostname === baseDomain || hostname.endsWith(`.${baseDomain}`);
		}
		return hostname === pattern;
	}

	getTrustedDomains(): ReadonlyArray<string> {
		return this.trustedDomains;
	}

	getTrustedDomainsCount(): number {
		if (this.trustAllDomains) return 0;
		return this.trustedDomains.length;
	}
}

export default new TrustedDomainStore();
