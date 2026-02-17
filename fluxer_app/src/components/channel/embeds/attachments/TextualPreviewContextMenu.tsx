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

import type {TextualPreviewContextMenuProps} from '@app/components/channel/embeds/attachments/TextualAttachmentPreviewUtils';
import {CheckboxItem} from '@app/components/uikit/context_menu/ContextMenu';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {DownloadSimpleIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';

export const TextualPreviewContextMenu = observer(function TextualPreviewContextMenu({
	onDownload,
	onToggleWrapText,
	wrapText,
}: TextualPreviewContextMenuProps) {
	const {i18n} = useLingui();

	return (
		<MenuGroup>
			<MenuItem icon={<DownloadSimpleIcon size={16} weight="regular" />} onClick={onDownload}>
				{i18n._(msg`Download`)}
			</MenuItem>
			<CheckboxItem checked={wrapText} onCheckedChange={onToggleWrapText}>
				{i18n._(msg`Wrap text`)}
			</CheckboxItem>
		</MenuGroup>
	);
});
