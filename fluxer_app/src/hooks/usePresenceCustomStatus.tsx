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

import type {CustomStatus} from '@app/lib/CustomStatus';
import {isCustomStatusExpired} from '@app/lib/CustomStatus';
import {CustomStatusEmitter} from '@app/lib/CustomStatusEmitter';
import PresenceStore from '@app/stores/PresenceStore';
import {useCallback, useEffect, useRef, useState, useSyncExternalStore} from 'react';

interface UsePresenceCustomStatusOptions {
	userId: string;
	enabled?: boolean;
}

function filterExpiredStatus(status: CustomStatus | null): CustomStatus | null {
	if (status === null || isCustomStatusExpired(status)) {
		return null;
	}
	return status;
}

export function usePresenceCustomStatus({userId, enabled = true}: UsePresenceCustomStatusOptions): CustomStatus | null {
	const [expiryTick, setExpiryTick] = useState(0);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearTimer = useCallback(() => {
		if (timerRef.current !== null) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const subscribe = useCallback(
		(onStoreChange: () => void) => {
			if (!enabled) {
				return () => {};
			}
			return CustomStatusEmitter.subscribeToPresence(userId, onStoreChange);
		},
		[userId, enabled],
	);

	const getSnapshot = useCallback((): CustomStatus | null => {
		void expiryTick;
		if (!enabled) {
			return null;
		}
		return filterExpiredStatus(PresenceStore.getCustomStatus(userId));
	}, [userId, enabled, expiryTick]);

	const customStatus = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

	useEffect(() => {
		clearTimer();

		if (!customStatus?.expiresAt) {
			return;
		}

		const expiresAtMs = Date.parse(customStatus.expiresAt);
		if (Number.isNaN(expiresAtMs)) {
			return;
		}

		const delay = expiresAtMs - Date.now();
		if (delay <= 0) {
			return;
		}

		timerRef.current = setTimeout(() => {
			setExpiryTick((t) => t + 1);
		}, delay);

		return clearTimer;
	}, [customStatus?.expiresAt, clearTimer]);

	return customStatus;
}
