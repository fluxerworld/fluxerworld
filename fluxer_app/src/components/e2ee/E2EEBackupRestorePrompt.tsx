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

import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import {Logger} from '@app/lib/Logger';
import E2EEStore from '@app/stores/E2EEStore';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useState} from 'react';

const logger = new Logger('E2EEBackupRestorePrompt');

const formatDate = (iso: string): string => {
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
};

// Modal that surfaces whenever bootstrap finds a server-side backup but
// no local account. Two paths: restore (passphrase + decrypt) or skip
// (forget the backup, register a fresh device). Mounted unconditionally
// at the app shell — it renders nothing unless the store is in the
// awaiting_backup_decision state.
export const E2EEBackupRestorePrompt: React.FC = observer(() => {
	const {t} = useLingui();
	const [passphrase, setPassphrase] = useState('');
	const [busy, setBusy] = useState<'restore' | 'skip' | null>(null);
	const [error, setError] = useState<string | null>(null);

	const isOpen = E2EEStore.registrationStatus === 'awaiting_backup_decision' && E2EEStore.pendingBackup !== null;
	const updatedAt = E2EEStore.pendingBackup?.updated_at;

	const handleRestore = useCallback(async () => {
		if (passphrase.length < 8) {
			setError(t`Passphrase must be at least 8 characters.`);
			return;
		}
		setBusy('restore');
		setError(null);
		try {
			await E2EEStore.restorePendingBackup(passphrase);
			setPassphrase('');
		} catch (err) {
			logger.warn('Backup restore failed', {err});
			setError(err instanceof Error ? err.message : t`Couldn't restore the backup. Try again.`);
		} finally {
			setBusy(null);
		}
	}, [passphrase, t]);

	const handleSkip = useCallback(async () => {
		setBusy('skip');
		setError(null);
		try {
			await E2EEStore.skipPendingBackupAndRegister();
			setPassphrase('');
		} catch (err) {
			logger.warn('Backup skip / fresh registration failed', {err});
			setError(err instanceof Error ? err.message : t`Couldn't register a fresh device. Try again.`);
		} finally {
			setBusy(null);
		}
	}, [t]);

	if (!isOpen) return null;

	return (
		<Modal.Root size="small" centered>
			<Modal.Header title={t`Restore encryption keys?`} />
			<Modal.Content>
				<Modal.ContentLayout>
					<Modal.Description>
						<Trans>
							We found an encrypted backup of your end-to-end encryption keys on the server (last updated{' '}
							{formatDate(updatedAt ?? '')}). Enter the passphrase you saved with it to restore your existing
							sessions and verified peers, or skip to set up this device as a brand-new one.
						</Trans>
					</Modal.Description>
					<input
						type="password"
						value={passphrase}
						onChange={(e) => setPassphrase(e.target.value)}
						placeholder={t`Backup passphrase`}
						autoComplete="off"
						style={{
							width: '100%',
							padding: '0.5rem 0.75rem',
							borderRadius: '6px',
							border: '1px solid var(--background-modifier-accent)',
							background: 'var(--background-secondary)',
							color: 'var(--text-primary)',
							marginTop: '0.5rem',
						}}
					/>
					{error && (
						<p style={{color: 'var(--status-danger)', fontSize: '0.875rem', marginTop: '0.5rem'}}>{error}</p>
					)}
				</Modal.ContentLayout>
			</Modal.Content>
			<Modal.Footer>
				<Button variant="secondary" submitting={busy === 'skip'} onClick={() => void handleSkip()}>
					<Trans>Skip and start fresh</Trans>
				</Button>
				<Button variant="primary" submitting={busy === 'restore'} onClick={() => void handleRestore()}>
					<Trans>Restore</Trans>
				</Button>
			</Modal.Footer>
		</Modal.Root>
	);
});
