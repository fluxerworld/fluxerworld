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
import * as NagbarActionCreators from '@app/actions/NagbarActionCreators';
import {Nagbar} from '@app/components/layout/Nagbar';
import {NagbarButton} from '@app/components/layout/NagbarButton';
import {NagbarContent} from '@app/components/layout/NagbarContent';
import {UserSettingsModal} from '@app/components/modals/UserSettingsModal';
import {Trans} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback} from 'react';

export const VisionaryMfaNagbar = observer(({isMobile}: {isMobile: boolean}) => {
	const handleEnableMfa = useCallback(() => {
		ModalActionCreators.push(modal(() => <UserSettingsModal initialTab="account_security" initialSubtab="security" />));
	}, []);

	const handleDismiss = useCallback(() => {
		NagbarActionCreators.dismissNagbar('visionaryMfaDismissed');
	}, []);

	return (
		<Nagbar
			isMobile={isMobile}
			backgroundColor="var(--brand-primary)"
			textColor="var(--text-on-brand-primary)"
			dismissible
			onDismiss={handleDismiss}
		>
			<NagbarContent
				isMobile={isMobile}
				onDismiss={handleDismiss}
				message={
					<Trans>
						Protect your Visionary account by enabling two-factor authentication. Thanks for supporting Fluxer!
					</Trans>
				}
				actions={
					<NagbarButton isMobile={isMobile} onClick={handleEnableMfa}>
						<Trans>Enable Two-Factor Auth</Trans>
					</NagbarButton>
				}
			/>
		</Nagbar>
	);
});
