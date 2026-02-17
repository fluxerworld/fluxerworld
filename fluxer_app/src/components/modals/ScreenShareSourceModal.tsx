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
import styles from '@app/components/modals/ScreenShareSourceModal.module.css';
import {Button} from '@app/components/uikit/button/Button';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import type {DesktopSource} from '@app/types/electron.d';
import {Trans, useLingui} from '@lingui/react/macro';

interface ScreenShareSourceModalProps {
	sources: Array<DesktopSource>;
	audioRequested: boolean;
	supportsLoopbackAudio?: boolean;
	supportsSystemAudioCapture?: boolean;
	onSelect: (sourceId: string | null) => void;
}

export const ScreenShareSourceModal = ({
	sources,
	audioRequested,
	supportsLoopbackAudio,
	supportsSystemAudioCapture,
	onSelect,
}: ScreenShareSourceModalProps) => {
	const {t} = useLingui();
	const hasAudioCapability = Boolean(supportsLoopbackAudio || supportsSystemAudioCapture);
	const audioHint = !audioRequested
		? t`Audio is disabled for this share.`
		: hasAudioCapability
			? t`Audio will be included with this screen share.`
			: t`System audio capture is not supported on this platform.`;
	return (
		<Modal.Root size="xlarge" onClose={() => onSelect(null)}>
			<Modal.Header title={t`Select Screen or Window`} />
			<Modal.Content>
				<p className={styles.description}>
					<Trans>Pick the screen or window you want to share with the call.</Trans>
				</p>
				<div className={styles.grid}>
					{sources.map((source) => (
						<FocusRing key={source.id} offset={-2}>
							<button type="button" className={styles.card} onClick={() => onSelect(source.id)}>
								<img src={source.thumbnailDataUrl} alt={source.name} className={styles.thumbnail} draggable={false} />
								<div className={styles.caption}>
									<span className={styles.name}>{source.name || <Trans>Desktop</Trans>}</span>
									{source.display_id && (
										<span className={styles.meta}>
											<Trans>Display {source.display_id}</Trans>
										</span>
									)}
								</div>
							</button>
						</FocusRing>
					))}
				</div>
				<p className={styles.audioHint}>{audioHint}</p>
			</Modal.Content>
			<Modal.Footer>
				<Button variant="secondary" onClick={() => onSelect(null)}>
					<Trans>Cancel</Trans>
				</Button>
			</Modal.Footer>
		</Modal.Root>
	);
};
