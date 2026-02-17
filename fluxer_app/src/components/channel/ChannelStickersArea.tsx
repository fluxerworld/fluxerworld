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

import * as ChannelStickerActionCreators from '@app/actions/ChannelStickerActionCreators';
import styles from '@app/components/channel/ChannelStickersArea.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {useStickerAnimation} from '@app/hooks/useStickerAnimation';
import {ComponentDispatch} from '@app/lib/ComponentDispatch';
import ChannelStickerStore from '@app/stores/ChannelStickerStore';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import {useLingui} from '@lingui/react/macro';
import {TrashIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useLayoutEffect, useState} from 'react';

interface ChannelStickersAreaProps {
	channelId: string;
	hasAttachments: boolean;
}

export const ChannelStickersArea: React.FC<ChannelStickersAreaProps> = observer(({channelId, hasAttachments}) => {
	const {t} = useLingui();
	const {shouldAnimate, interactionHandlers} = useStickerAnimation();
	const sticker = ChannelStickerStore.getPendingSticker(channelId);
	const [previousSticker, setPreviousSticker] = useState(sticker);

	useLayoutEffect(() => {
		if (previousSticker && !sticker) {
			ComponentDispatch.dispatch('FORCE_JUMP_TO_PRESENT');
		} else if (!previousSticker && sticker) {
			ComponentDispatch.dispatch('FORCE_JUMP_TO_PRESENT');
		}

		setPreviousSticker(sticker);
	}, [sticker, previousSticker]);

	if (!sticker) {
		return null;
	}

	const handleRemove = () => {
		ChannelStickerActionCreators.removePendingSticker(channelId);
	};

	const stickerUrl = AvatarUtils.getStickerURL({
		id: sticker.id,
		animated: shouldAnimate,
		size: 320,
	});

	return (
		<div className={clsx(styles.container, hasAttachments ? styles.withAttachments : styles.standalone)}>
			<div className={styles.content}>
				<div className={styles.stickerPreview}>
					<img src={stickerUrl} alt={sticker.name} className={styles.stickerImage} {...interactionHandlers} />
				</div>
				<div className={styles.stickerInfo}>
					<div className={styles.stickerName}>:{sticker.name}:</div>
					{sticker.description && <div className={styles.stickerDescription}>{sticker.description}</div>}
				</div>
				<Tooltip text={t`Remove sticker`} position="top">
					<FocusRing offset={-2}>
						<button type="button" onClick={handleRemove} className={styles.removeButton} aria-label={t`Remove sticker`}>
							<TrashIcon weight="regular" className={styles.icon} />
						</button>
					</FocusRing>
				</Tooltip>
			</div>
		</div>
	);
});
