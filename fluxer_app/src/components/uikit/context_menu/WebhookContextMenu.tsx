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

import * as TextCopyActionCreators from '@app/actions/TextCopyActionCreators';
import {CopyIdIcon} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback} from 'react';

interface WebhookContextMenuProps {
	webhookId: string;
	onClose: () => void;
}

export const WebhookContextMenu: React.FC<WebhookContextMenuProps> = observer(({webhookId, onClose}) => {
	const {i18n, t} = useLingui();
	const handleCopyWebhookId = useCallback(() => {
		TextCopyActionCreators.copy(i18n, webhookId, true);
		onClose();
	}, [i18n, webhookId, onClose]);

	return (
		<MenuGroup>
			<MenuItem icon={<CopyIdIcon />} onClick={handleCopyWebhookId}>
				{t`Copy webhook ID`}
			</MenuItem>
		</MenuGroup>
	);
});
