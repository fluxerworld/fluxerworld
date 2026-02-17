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

import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';

export const ScreenShareUnsupportedModal = observer(() => {
	const {t} = useLingui();

	return (
		<ConfirmModal
			title={t`Screen sharing not supported`}
			description={t`Screen sharing is not supported on this device or browser. This feature requires a desktop browser that supports screen sharing, such as Chrome, Firefox, or Edge on Windows, macOS, or Linux.`}
			primaryText={t`Understood`}
			onPrimary={() => {}}
		/>
	);
});
