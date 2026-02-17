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
import {MessageListPage} from '@app/components/pages/MessageListPage';
import styles from '@app/components/pages/SavedMessagesPage.module.css';
import previewStyles from '@app/components/shared/MessagePreview.module.css';
import {SavedMessageMissingCard} from '@app/components/shared/SavedMessageMissingCard';
import type {MessageRecord} from '@app/records/MessageRecord';
import SavedMessagesStore from '@app/stores/SavedMessagesStore';
import {useLingui} from '@lingui/react/macro';
import {BookmarkSimpleIcon, XIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useEffect} from 'react';

export const SavedMessagesPage = observer(() => {
	const {t, i18n} = useLingui();
	const {savedMessages, missingSavedMessages, fetched} = SavedMessagesStore;

	useEffect(() => {
		if (!fetched) {
			SavedMessageActionCreators.fetch();
		}
	}, [fetched]);

	const renderActionButtons = (message: MessageRecord) => (
		<button
			type="button"
			className={previewStyles.actionIconButton}
			onClick={() => SavedMessageActionCreators.remove(i18n, message.id)}
		>
			<XIcon weight="bold" className={previewStyles.actionIcon} />
		</button>
	);

	return (
		<div>
			{missingSavedMessages.length > 0 && (
				<div className={styles.missingList}>
					{missingSavedMessages.map((entry) => (
						<SavedMessageMissingCard
							key={entry.id}
							entryId={entry.id}
							onRemove={() => SavedMessageActionCreators.remove(i18n, entry.id)}
						/>
					))}
				</div>
			)}
			<MessageListPage
				icon={<BookmarkSimpleIcon className={styles.icon} />}
				title={t`Bookmarks`}
				messages={savedMessages.slice()}
				emptyStateTitle={t`No Bookmarks`}
				emptyStateDescription={t`Bookmark messages to save them for later.`}
				endStateDescription={t`There's nothing more to see here.`}
				renderActionButtons={renderActionButtons}
			/>
		</div>
	);
});
