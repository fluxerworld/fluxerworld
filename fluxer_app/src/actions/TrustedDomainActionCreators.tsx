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

import {Logger} from '@app/lib/Logger';
import TrustedDomainStore from '@app/stores/TrustedDomainStore';

const logger = new Logger('TrustedDomain');

export async function addTrustedDomain(domain: string): Promise<void> {
	logger.debug(`Adding trusted domain: ${domain}`);
	await TrustedDomainStore.addTrustedDomain(domain);
}

export async function removeTrustedDomain(domain: string): Promise<void> {
	logger.debug(`Removing trusted domain: ${domain}`);
	await TrustedDomainStore.removeTrustedDomain(domain);
}

export async function clearAllTrustedDomains(): Promise<void> {
	logger.debug('Clearing all trusted domains');
	await TrustedDomainStore.clearAllTrustedDomains();
}

export async function setTrustAllDomains(trustAll: boolean): Promise<void> {
	logger.debug(`Setting trust all domains: ${trustAll}`);
	await TrustedDomainStore.setTrustAllDomains(trustAll);
}

export function checkAndMigrateLegacyData(): void {
	void TrustedDomainStore.checkAndMigrateLegacyData();
}
