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

import {useMessageActionMenuData} from '@app/components/channel/MessageActionMenu';
import type {MediaMenuDataProps, MediaType} from '@app/components/uikit/context_menu/items/MediaMenuData';
import {useMediaMenuData} from '@app/components/uikit/context_menu/items/MediaMenuData';
import {MenuBottomSheet} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import type {MessageRecord} from '@app/records/MessageRecord';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useMemo} from 'react';

interface MediaActionBottomSheetProps {
	isOpen: boolean;
	onClose: () => void;
	message: MessageRecord;
	originalSrc: string;
	proxyURL?: string;
	type: MediaType;
	contentHash?: string | null;
	attachmentId?: string;
	embedIndex?: number;
	defaultName?: string;
	defaultAltText?: string;
	handleDelete?: (bypassConfirm?: boolean) => void;
	includeMessageActions?: boolean;
}

const MediaActionBottomSheetContent: React.FC<MediaActionBottomSheetProps> = observer(
	({
		isOpen,
		onClose,
		message,
		originalSrc,
		proxyURL,
		type,
		contentHash,
		attachmentId,
		embedIndex,
		defaultName,
		defaultAltText,
		handleDelete,
		includeMessageActions = true,
	}) => {
		const {t} = useLingui();

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

		const {groups: mediaGroups} = useMediaMenuData(mediaProps, {onClose});

		const {groups: messageGroups} = useMessageActionMenuData(message, {
			onClose,
			onDelete: handleDelete ? () => handleDelete() : undefined,
		});
		const visibleMessageGroups = useMemo(
			() => messageGroups.filter((group) => group.items.length > 0),
			[messageGroups],
		);

		const combinedGroups = useMemo(() => {
			if (includeMessageActions && visibleMessageGroups.length > 0) {
				return [...mediaGroups, ...visibleMessageGroups];
			}
			return mediaGroups;
		}, [mediaGroups, visibleMessageGroups, includeMessageActions]);

		const title = useMemo(() => {
			switch (type) {
				case 'image':
					return t`Image Options`;
				case 'gif':
				case 'gifv':
					return t`GIF Options`;
				case 'video':
					return t`Video Options`;
				case 'audio':
					return t`Audio Options`;
				case 'file':
					return t`File Options`;
				default:
					return t`Media Options`;
			}
		}, [type, t]);

		return <MenuBottomSheet isOpen={isOpen} onClose={onClose} groups={combinedGroups} title={title} />;
	},
);

export const MediaActionBottomSheet: React.FC<MediaActionBottomSheetProps> = observer((props) => {
	if (!props.isOpen) {
		return null;
	}
	return <MediaActionBottomSheetContent {...props} />;
});
