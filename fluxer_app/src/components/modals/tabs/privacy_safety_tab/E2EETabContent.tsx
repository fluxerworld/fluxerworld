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
import {Button} from '@app/components/uikit/button/Button';
import {Spinner} from '@app/components/uikit/Spinner';
import {Logger} from '@app/lib/Logger';
import E2EEStore from '@app/stores/E2EEStore';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useState} from 'react';

const logger = new Logger('E2EETabContent');

const formatFingerprint = (key: string): string => {
	const truncated = key.length > 32 ? `${key.slice(0, 32)}…` : key;
	return truncated.replace(/(.{4})/g, '$1 ').trim();
};

const formatDate = (iso: string): string => {
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
};

export const E2EETabContent = observer(() => {
	const {t} = useLingui();
	const [devices, setDevices] = useState<Array<E2EEActionCreators.E2EEDeviceResponse> | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [busyDeviceId, setBusyDeviceId] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const list = await E2EEActionCreators.listOwnDevices();
			setDevices(list);
		} catch (err) {
			logger.warn('Failed to list E2EE devices', {err});
			setError(t`Couldn't load encryption devices. Try again in a moment.`);
		} finally {
			setLoading(false);
		}
	}, [t]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const handleRevoke = useCallback(
		async (deviceId: string) => {
			setBusyDeviceId(deviceId);
			try {
				await E2EEActionCreators.deleteDevice(deviceId);
				if (deviceId === E2EEStore.deviceId) {
					E2EEStore.reset();
				}
				await refresh();
			} catch (err) {
				logger.error('Failed to revoke E2EE device', {err});
				setError(t`Couldn't revoke that device. Try again in a moment.`);
			} finally {
				setBusyDeviceId(null);
			}
		},
		[refresh, t],
	);

	if (loading && !devices) {
		return (
			<div>
				<Spinner />
			</div>
		);
	}

	if (error) {
		return (
			<div>
				<p>{error}</p>
				<Button variant="secondary" small onClick={() => void refresh()}>
					<Trans>Retry</Trans>
				</Button>
			</div>
		);
	}

	if (!devices || devices.length === 0) {
		return (
			<div>
				<p>
					<Trans>You don't have any registered E2EE devices yet. Open a DM you've enabled encryption on to register one.</Trans>
				</p>
			</div>
		);
	}

	return (
		<div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
			<p>
				<Trans>
					Each device you sign in on registers its own keys. Removing a device drops its sessions immediately — you'll
					need to start fresh DMs from that device after re-registering.
				</Trans>
			</p>
			{devices.map((device) => {
				const isCurrent = device.device_id === E2EEStore.deviceId;
				return (
					<div
						key={device.device_id}
						style={{
							border: '1px solid var(--background-modifier-accent)',
							borderRadius: '8px',
							padding: '0.75rem 1rem',
							display: 'flex',
							flexDirection: 'column',
							gap: '0.25rem',
						}}
					>
						<div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem'}}>
							<div>
								<strong>{device.device_name || t`Unnamed device`}</strong>
								{isCurrent && (
									<span style={{marginLeft: '0.5rem', color: 'var(--text-tertiary)'}}>
										<Trans>(this device)</Trans>
									</span>
								)}
							</div>
							<Button
								variant="danger-secondary"
								small
								submitting={busyDeviceId === device.device_id}
								onClick={() => void handleRevoke(device.device_id)}
							>
								<Trans>Remove</Trans>
							</Button>
						</div>
						<div style={{fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)'}}>
							{formatFingerprint(device.identity_key)}
						</div>
						<div style={{fontSize: '0.75rem', color: 'var(--text-tertiary)'}}>
							<Trans>
								Registered {formatDate(device.created_at)} · {device.one_time_prekey_count} prekeys remaining
							</Trans>
						</div>
					</div>
				);
			})}
		</div>
	);
});
