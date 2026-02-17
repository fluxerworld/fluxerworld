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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import {canReportMessage} from '@app/components/channel/MessageActionUtils';
import type {IARContext} from '@app/components/modals/IARModal';
import {IARModal} from '@app/components/modals/IARModal';
import {ReportMessageIcon} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import type {MessageRecord} from '@app/records/MessageRecord';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback} from 'react';

interface ReportMessageMenuItemProps {
	message: MessageRecord;
	onClose: () => void;
}

export const ReportMessageMenuItem: React.FC<ReportMessageMenuItemProps> = observer(({message, onClose}) => {
	const {t} = useLingui();
	const handleReportMessage = useCallback(() => {
		if (!canReportMessage(message)) {
			return;
		}
		onClose();
		const context: IARContext = {
			type: 'message',
			message,
		};
		ModalActionCreators.push(modal(() => <IARModal context={context} />));
	}, [message, onClose]);

	if (!canReportMessage(message)) {
		return null;
	}

	return (
		<MenuItem icon={<ReportMessageIcon size={16} />} onClick={handleReportMessage} danger>
			{t`Report Message`}
		</MenuItem>
	);
});
