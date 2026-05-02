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
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import {Spinner} from '@app/components/uikit/Spinner';
import {Logger} from '@app/lib/Logger';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useState} from 'react';

const logger = new Logger('E2EEFingerprintModal');

interface E2EEFingerprintModalProps {
	recipientUserId: string;
	recipientName: string;
}

const formatFingerprint = (key: string): string => {
	const groups = key.match(/.{1,4}/g) ?? [];
	return groups.join(' ');
};

const Section: React.FC<{title: string; devices: Array<E2EEActionCreators.E2EEPublicDeviceResponse>}> = ({
	title,
	devices,
}) => {
	const {t} = useLingui();
	if (devices.length === 0) {
		return (
			<div>
				<strong>{title}</strong>
				<p style={{color: 'var(--text-tertiary)', marginTop: '0.25rem'}}>
					<Trans>No registered devices.</Trans>
				</p>
			</div>
		);
	}
	return (
		<div>
			<strong>{title}</strong>
			<div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem'}}>
				{devices.map((device) => (
					<div
						key={device.device_id}
						style={{
							padding: '0.5rem 0.75rem',
							borderRadius: '6px',
							background: 'var(--background-secondary)',
							display: 'flex',
							flexDirection: 'column',
							gap: '0.25rem',
						}}
					>
						<span style={{fontSize: '0.875rem'}}>{device.device_name || t`Unnamed device`}</span>
						<span style={{fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all'}}>
							{formatFingerprint(device.identity_key)}
						</span>
					</div>
				))}
			</div>
		</div>
	);
};

export const E2EEFingerprintModal: React.FC<E2EEFingerprintModalProps> = observer(
	({recipientUserId, recipientName}) => {
		const {t} = useLingui();
		const [own, setOwn] = useState<Array<E2EEActionCreators.E2EEPublicDeviceResponse> | null>(null);
		const [theirs, setTheirs] = useState<Array<E2EEActionCreators.E2EEPublicDeviceResponse> | null>(null);
		const [error, setError] = useState<string | null>(null);
		const [loading, setLoading] = useState(true);

		const load = useCallback(async () => {
			setLoading(true);
			setError(null);
			const ownId = AuthenticationStore.currentUserId;
			if (!ownId) {
				setError(t`You're not signed in.`);
				setLoading(false);
				return;
			}
			try {
				const [a, b] = await Promise.all([
					E2EEActionCreators.listPublicDevices(ownId),
					E2EEActionCreators.listPublicDevices(recipientUserId),
				]);
				setOwn(a);
				setTheirs(b);
			} catch (err) {
				logger.warn('Failed to fetch fingerprints', {err});
				setError(t`Couldn't load encryption fingerprints. Try again in a moment.`);
			} finally {
				setLoading(false);
			}
		}, [recipientUserId, t]);

		useEffect(() => {
			void load();
		}, [load]);

		return (
			<Modal.Root size="medium" centered>
				<Modal.Header title={t`Verify Encryption with ${recipientName}`} />
				<Modal.Content>
					<Modal.ContentLayout>
						<Modal.Description>
							<Trans>
								Compare the fingerprints below with {recipientName} over a separate channel (in person, voice
								call, etc.). If both match exactly, your messages are encrypted end-to-end with the right keys.
							</Trans>
						</Modal.Description>
						{loading ? (
							<Spinner />
						) : error ? (
							<>
								<p>{error}</p>
								<Button variant="secondary" small onClick={() => void load()}>
									<Trans>Retry</Trans>
								</Button>
							</>
						) : (
							<div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
								<Section title={t`Your devices`} devices={own ?? []} />
								<Section title={t`${recipientName}'s devices`} devices={theirs ?? []} />
							</div>
						)}
					</Modal.ContentLayout>
				</Modal.Content>
				<Modal.Footer>
					<Button variant="secondary" onClick={() => ModalActionCreators.pop()}>
						<Trans>Close</Trans>
					</Button>
				</Modal.Footer>
			</Modal.Root>
		);
	},
);
