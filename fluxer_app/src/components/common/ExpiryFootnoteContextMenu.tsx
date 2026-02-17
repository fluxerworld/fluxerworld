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

import * as AccessibilityActionCreators from '@app/actions/AccessibilityActionCreators';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {HelpCenterArticleSlug} from '@app/constants/HelpCenterConstants';
import * as HelpCenterUtils from '@app/utils/HelpCenterUtils';
import {openExternalUrl} from '@app/utils/NativeUtils';
import {useLingui} from '@lingui/react/macro';
import {type FC, useCallback} from 'react';

export const ExpiryFootnoteContextMenu: FC = () => {
	const {t} = useLingui();
	const helpUrl = HelpCenterUtils.getURL(HelpCenterArticleSlug.AttachmentExpiry);

	const handleHideFootnotes = useCallback(() => {
		AccessibilityActionCreators.update({showAttachmentExpiryIndicator: false});
	}, []);

	const handleOpenHelpCenter = useCallback(() => {
		void openExternalUrl(helpUrl);
	}, [helpUrl]);

	return (
		<MenuGroup>
			<MenuItem onClick={handleHideFootnotes}>{t`Hide expiry footnotes`}</MenuItem>
			<MenuItem onClick={handleOpenHelpCenter}>{t`View help article`}</MenuItem>
		</MenuGroup>
	);
};
