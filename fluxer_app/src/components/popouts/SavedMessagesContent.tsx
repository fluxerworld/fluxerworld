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

import * as SavedMessageActionCreators from '@app/actions/SavedMessageActionCreators';
import {Message} from '@app/components/channel/Message';
import {InboxMessageHeader} from '@app/components/popouts/InboxMessageHeader';
import headerStyles from '@app/components/popouts/InboxMessageHeader.module.css';
import styles from '@app/components/popouts/SavedMessagesContent.module.css';
import previewStyles from '@app/components/shared/MessagePreview.module.css';
import {SavedMessageMissingCard} from '@app/components/shared/SavedMessageMissingCard';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Scroller, type ScrollerHandle} from '@app/components/uikit/Scroller';
import {Spinner} from '@app/components/uikit/Spinner';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {useMessageListKeyboardNavigation} from '@app/hooks/useMessageListKeyboardNavigation';
import ChannelStore from '@app/stores/ChannelStore';
import SavedMessagesStore from '@app/stores/SavedMessagesStore';
import {goToMessage} from '@app/utils/MessageNavigator';
import {MessagePreviewContext} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {FlagCheckeredIcon, SparkleIcon, XIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useRef} from 'react';

const readonlyBehaviorOverrides = {
	disableContextMenu: true,
	prefersReducedMotion: true,
};

export const SavedMessagesContent = observer(() => {
	const {t, i18n} = useLingui();
	const {savedMessages, missingSavedMessages, fetched} = SavedMessagesStore;
	const scrollerRef = useRef<ScrollerHandle | null>(null);

	const renderMissingSavedMessage = useCallback(
		(entryId: string) => (
			<SavedMessageMissingCard
				key={`lost-${entryId}`}
				entryId={entryId}
				onRemove={() => SavedMessageActionCreators.remove(i18n, entryId)}
			/>
		),
		[i18n],
	);

	useEffect(() => {
		if (!fetched) {
			SavedMessageActionCreators.fetch();
		}
	}, [fetched]);

	useMessageListKeyboardNavigation({
		containerRef: scrollerRef,
	});

	if (!fetched) {
		return (
			<div className={previewStyles.emptyState}>
				<Spinner />
			</div>
		);
	}

	if (!savedMessages.length && !missingSavedMessages.length) {
		return (
			<div className={previewStyles.emptyState}>
				<div className={previewStyles.emptyStateContent}>
					<SparkleIcon className={previewStyles.emptyStateIcon} />
					<div className={previewStyles.emptyStateTextContainer}>
						<h3 className={previewStyles.emptyStateTitle}>{t`No Bookmarks`}</h3>
						<p className={previewStyles.emptyStateDescription}>{t`Bookmark messages to save them for later.`}</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<Scroller className={styles.scroller} key="saved-messages-scroller" ref={scrollerRef}>
			{missingSavedMessages.map((entry) => renderMissingSavedMessage(entry.id))}
			{savedMessages.map((message) => {
				const channel = ChannelStore.getChannel(message.channelId);

				if (!channel) {
					return renderMissingSavedMessage(message.id);
				}

				return (
					<div key={message.id} className={styles.messageCard}>
						<InboxMessageHeader
							channel={channel}
							onClick={() => goToMessage(message.channelId, message.id)}
							rightActions={
								<Tooltip text={t`Remove bookmark`} position="top">
									<FocusRing offset={-2}>
										<button
											type="button"
											className={headerStyles.headerIconButton}
											onClick={() => SavedMessageActionCreators.remove(i18n, message.id)}
											aria-label={t`Remove bookmark`}
										>
											<XIcon weight="bold" className={headerStyles.headerIcon} />
										</button>
									</FocusRing>
								</Tooltip>
							}
						/>

						<div className={previewStyles.previewCard}>
							<Message
								message={message}
								channel={channel}
								previewContext={MessagePreviewContext.LIST_POPOUT}
								behaviorOverrides={readonlyBehaviorOverrides}
								readonlyPreview
							/>

							<div className={previewStyles.actionButtons}>
								<FocusRing offset={-2}>
									<button
										type="button"
										className={previewStyles.actionButton}
										onClick={() => {
											goToMessage(message.channelId, message.id);
										}}
									>
										{t`Jump`}
									</button>
								</FocusRing>
							</div>
						</div>
					</div>
				);
			})}

			<div className={previewStyles.endState}>
				<div className={previewStyles.endStateContent}>
					<FlagCheckeredIcon className={previewStyles.endStateIcon} />
					<div className={previewStyles.endStateTextContainer}>
						<h3 className={previewStyles.endStateTitle}>{t`You've reached the end`}</h3>
						<p className={previewStyles.endStateDescription}>{t`There's nothing more to see here.`}</p>
					</div>
				</div>
			</div>
		</Scroller>
	);
});
