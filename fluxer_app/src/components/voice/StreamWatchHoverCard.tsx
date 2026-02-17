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

import {Button} from '@app/components/uikit/button/Button';
import {Spinner} from '@app/components/uikit/Spinner';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import styles from '@app/components/voice/StreamWatchHoverCard.module.css';
import {useLingui} from '@lingui/react/macro';
import {MonitorPlayIcon, PlusIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import type React from 'react';
import {useCallback} from 'react';

interface StreamWatchHoverCardProps {
	previewUrl: string | null;
	isPreviewLoading: boolean;
	watchLabel: string;
	addLabel?: string;
	onWatch: (event: React.SyntheticEvent) => void;
	onAddStream?: (event: React.SyntheticEvent) => void;
	onPreviewClick?: (event: React.MouseEvent) => void;
	watchDisabled?: boolean;
	isWatching?: boolean;
	isSubmitting?: boolean;
	variant?: 'compact' | 'list';
	showProtip?: boolean;
	showAddButton?: boolean;
	addTooltip?: string;
}

export const StreamWatchHoverCard: React.FC<StreamWatchHoverCardProps> = ({
	previewUrl,
	isPreviewLoading,
	watchLabel,
	addLabel,
	onWatch,
	onAddStream,
	onPreviewClick,
	watchDisabled = false,
	isWatching = false,
	isSubmitting = false,
	variant = 'list',
	showProtip = false,
	showAddButton = false,
	addTooltip,
}) => {
	const {t} = useLingui();
	const isCompact = variant === 'compact';

	const handlePreviewClick = useCallback(
		(event: React.MouseEvent) => {
			event.stopPropagation();
			if (onPreviewClick) {
				onPreviewClick(event);
			} else if (!watchDisabled || isWatching) {
				onWatch(event);
			}
		},
		[onPreviewClick, onWatch, watchDisabled, isWatching],
	);

	const handlePreviewKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				event.stopPropagation();
				if (!watchDisabled || isWatching) {
					onWatch(event);
				}
			}
		},
		[onWatch, watchDisabled, isWatching],
	);

	const previewHoverLabel = isWatching ? t`Watching Stream` : t`Watch Stream`;

	return (
		<div className={clsx(styles.card, isCompact ? styles.variantCompact : styles.variantList)}>
			<div
				className={clsx(
					styles.preview,
					isCompact ? styles.previewCompact : styles.previewList,
					!isCompact && styles.previewClickable,
				)}
				role="button"
				tabIndex={isCompact ? undefined : 0}
				onClick={isCompact ? undefined : handlePreviewClick}
				onKeyDown={isCompact ? undefined : handlePreviewKeyDown}
			>
				{previewUrl ? (
					<img src={previewUrl} alt={t`Stream preview`} className={styles.previewImage} />
				) : (
					<div className={styles.previewFallback}>
						{isPreviewLoading ? <Spinner size="small" /> : t`No preview yet`}
					</div>
				)}

				{!isCompact && (
					<div className={styles.previewHoverOverlay}>
						<span className={styles.previewHoverText}>{previewHoverLabel}</span>
					</div>
				)}

				{isCompact && (
					<div className={styles.compactButtonWrap}>
						<Button
							fitContent
							leftIcon={<MonitorPlayIcon size={18} weight="fill" />}
							onClick={onWatch}
							disabled={watchDisabled}
							submitting={isSubmitting}
							className={styles.compactButton}
						>
							{watchLabel}
						</Button>
					</div>
				)}
			</div>

			{!isCompact && (
				<div className={styles.actionRow}>
					<div className={styles.actionButtons}>
						<Button
							fitContent
							leftIcon={<MonitorPlayIcon size={18} weight="fill" />}
							onClick={onWatch}
							disabled={watchDisabled}
							submitting={isSubmitting}
							className={styles.listButton}
						>
							{watchLabel}
						</Button>
						{showAddButton && onAddStream && (
							<Tooltip text={addTooltip ?? ''}>
								<Button
									fitContent
									leftIcon={<PlusIcon size={18} />}
									onClick={onAddStream}
									disabled={watchDisabled}
									className={styles.listButton}
								>
									{addLabel ?? t`Add Stream`}
								</Button>
							</Tooltip>
						)}
					</div>
					{showProtip && (
						<div className={styles.protipRow}>
							<span className={styles.protipText}>
								{t`Double-click a streaming user in the participant list to watch their stream.`}
							</span>
						</div>
					)}
				</div>
			)}
		</div>
	);
};
