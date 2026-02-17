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

import {clearAllAttachmentMocks, setAttachmentMock} from '@app/actions/DeveloperOptionsActionCreators';
import {WrenchToolIcon} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {type MediaMenuDataProps, useMediaMenuData} from '@app/components/uikit/context_menu/items/MediaMenuData';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {MenuItemSubmenu} from '@app/components/uikit/context_menu/MenuItemSubmenu';
import {MessageContextMenu} from '@app/components/uikit/context_menu/MessageContextMenu';
import type {MessageRecord} from '@app/records/MessageRecord';
import DeveloperModeStore from '@app/stores/DeveloperModeStore';
import DeveloperOptionsStore from '@app/stores/DeveloperOptionsStore';
import {MS_PER_DAY, MS_PER_HOUR} from '@fluxer/date_utils/src/DateConstants';
import {t} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useMemo} from 'react';

type MediaType = 'image' | 'gif' | 'gifv' | 'video' | 'audio' | 'file';

interface MediaContextMenuProps {
	message: MessageRecord;
	originalSrc: string;
	proxyURL?: string;
	type: MediaType;
	contentHash?: string | null;
	attachmentId?: string;
	embedIndex?: number;
	defaultName?: string;
	defaultAltText?: string;
	onClose: () => void;
	onDelete: (bypassConfirm?: boolean) => void;
}

export const MediaContextMenu: React.FC<MediaContextMenuProps> = observer(
	({
		message,
		originalSrc,
		proxyURL,
		type,
		contentHash,
		attachmentId,
		embedIndex,
		defaultName,
		defaultAltText,
		onClose,
		onDelete,
	}) => {
		const {i18n} = useLingui();

		const mediaProps: MediaMenuDataProps = useMemo(
			() => ({
				message,
				originalSrc,
				proxyURL,
				type,
				contentHash,
				attachmentId,
				embedIndex,
				defaultName,
				defaultAltText,
			}),
			[message, originalSrc, proxyURL, type, contentHash, attachmentId, embedIndex, defaultName, defaultAltText],
		);

		const {groups: mediaGroups, handlers} = useMediaMenuData(mediaProps, {onClose});

		const isDev = DeveloperModeStore.isDeveloper;
		const currentMock = attachmentId ? DeveloperOptionsStore.mockAttachmentStates[attachmentId] : undefined;

		const mockExpiresSoon = () =>
			setAttachmentMock(attachmentId!, {
				expired: false,
				expiresAt: new Date(Date.now() + MS_PER_DAY).toISOString(),
			});
		const mockExpiresWeek = () =>
			setAttachmentMock(attachmentId!, {
				expired: false,
				expiresAt: new Date(Date.now() + 7 * MS_PER_DAY).toISOString(),
			});
		const mockExpired = () =>
			setAttachmentMock(attachmentId!, {
				expired: true,
				expiresAt: new Date(Date.now() - MS_PER_HOUR).toISOString(),
			});
		const clearMock = () => setAttachmentMock(attachmentId!, null);

		return (
			<>
				<MessageContextMenu
					message={message}
					onClose={onClose}
					onDelete={onDelete}
					excludeMediaActions
					mediaHandlers={handlers}
					mediaGroups={mediaGroups}
					attachmentId={attachmentId}
				/>

				{isDev && attachmentId && (
					<MenuGroup>
						<MenuItemSubmenu
							label={t(i18n)`Attachment Mock`}
							icon={<WrenchToolIcon />}
							render={() => (
								<>
									<MenuItem onClick={mockExpiresSoon}>{t(i18n)`Mock expires in 1 day`}</MenuItem>
									<MenuItem onClick={mockExpiresWeek}>{t(i18n)`Mock expires in 7 days`}</MenuItem>
									<MenuItem onClick={mockExpired}>{t(i18n)`Mock expired`}</MenuItem>
									{currentMock && <MenuItem onClick={clearMock}>{t(i18n)`Clear mock for this attachment`}</MenuItem>}
									<MenuItem onClick={clearAllAttachmentMocks}>{t(i18n)`Clear all attachment mocks`}</MenuItem>
								</>
							)}
						/>
					</MenuGroup>
				)}
			</>
		);
	},
);
