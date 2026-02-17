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

import Config from '@app/Config';
import {Logger} from '@app/lib/Logger';

const logger = new Logger('ServiceWorkerRegister');

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
	if (!('serviceWorker' in navigator)) {
		return;
	}
	try {
		const versionParam = Config.PUBLIC_BUILD_SHA || Date.now();
		const swUrl = new URL('/sw.js', window.location.origin);
		swUrl.searchParams.set('v', String(versionParam));
		const registration = await navigator.serviceWorker.register(`${swUrl.pathname}${swUrl.search}`);
		return registration;
	} catch (error) {
		logger.error('Registration failed', error);
		return;
	}
}
