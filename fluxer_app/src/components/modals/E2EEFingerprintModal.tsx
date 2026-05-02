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
import E2EEStore from '@app/stores/E2EEStore';
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

const VerificationBadge: React.FC<{status: 'verified' | 'changed' | 'unverified'}> = ({status}) => {
	if (status === 'verified') {
		return (
			<span style={{color: 'var(--status-positive)', fontSize: '0.75rem'}}>
				<Trans>Verified</Trans>
			</span>
		);
	}
	if (status === 'changed') {
		return (
			<span style={{color: 'var(--status-warning, var(--status-danger))', fontSize: '0.75rem'}}>
				<Trans>Key changed — re-verify!</Trans>
			</span>
		);
	}
	return (
		<span style={{color: 'var(--text-tertiary)', fontSize: '0.75rem'}}>
			<Trans>Not verified</Trans>
		</span>
	);
};

interface SectionProps {
	title: string;
	devices: Array<E2EEActionCreators.E2EEPublicDeviceResponse>;
	verifiable: boolean;
}

const Section: React.FC<SectionProps> = observer(({title, devices, verifiable}) => {
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
				{devices.map((device) => {
					const status = verifiable
						? E2EEStore.checkVerificationStatus(device.user_id, device.device_id, device.identity_key)
						: 'unverified';
					const handleVerify = () =>
						void E2EEStore.markVerified(device.user_id, device.device_id, device.identity_key);
					const handleUnverify = () => void E2EEStore.clearVerification(device.user_id, device.device_id);
					return (
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
							<div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem'}}>
								<span style={{fontSize: '0.875rem'}}>{device.device_name || t`Unnamed device`}</span>
								{verifiable && <VerificationBadge status={status} />}
							</div>
							<span style={{fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all'}}>
								{formatFingerprint(device.identity_key)}
							</span>
							{verifiable && (
								<div style={{display: 'flex', gap: '0.5rem', marginTop: '0.25rem'}}>
									{status !== 'verified' && (
										<Button variant="primary" small onClick={handleVerify}>
											<Trans>Mark verified</Trans>
										</Button>
									)}
									{status !== 'unverified' && (
										<Button variant="secondary" small onClick={handleUnverify}>
											<Trans>Clear</Trans>
										</Button>
									)}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
});

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
					E2EEStore.ensureVerificationsForUser(recipientUserId),
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
								<Section title={t`Your devices`} devices={own ?? []} verifiable={false} />
								<Section
									title={t`${recipientName}'s devices`}
									devices={theirs ?? []}
									verifiable={true}
								/>
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
