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
import * as TrustedDomainActionCreators from '@app/actions/TrustedDomainActionCreators';
import {Switch} from '@app/components/form/Switch';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import TrustedDomainStore from '@app/stores/TrustedDomainStore';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useMemo} from 'react';

export const LinksTabContent: React.FC = observer(() => {
	const {t} = useLingui();
	const trustAll = TrustedDomainStore.trustAllDomains;
	const trustedCount = TrustedDomainStore.getTrustedDomainsCount();

	const description = useMemo(() => {
		if (trustAll) {
			return t`All external links are trusted. Warnings will not be shown.`;
		}
		if (trustedCount > 0) {
			return t`You have ${trustedCount} trusted domain(s). Add more by checking the box when visiting external links.`;
		}
		return t`When enabled, no external link warnings will be shown. This is less secure.`;
	}, [trustAll, trustedCount, t]);

	const handleTrustAllChange = useCallback(
		(value: boolean) => {
			if (value) {
				ModalActionCreators.push(
					ModalActionCreators.modal(() => (
						<ConfirmModal
							title={t`Trust all external links?`}
							description={
								<Trans>
									This will trust all external links and skip the warning for every domain. Your existing trusted
									domains will be replaced. This is less secure.
								</Trans>
							}
							primaryText={t`Trust All`}
							primaryVariant="danger-primary"
							onPrimary={async () => {
								await TrustedDomainActionCreators.setTrustAllDomains(true);
							}}
						/>
					)),
				);
			} else {
				ModalActionCreators.push(
					ModalActionCreators.modal(() => (
						<ConfirmModal
							title={t`Stop trusting all links?`}
							description={
								<Trans>
									External link warnings will be shown again. You will need to add trusted domains individually.
								</Trans>
							}
							primaryText={t`Disable Trust All`}
							onPrimary={async () => {
								await TrustedDomainActionCreators.setTrustAllDomains(false);
							}}
						/>
					)),
				);
			}
		},
		[t],
	);

	return (
		<Switch
			label={t`Trust all external links`}
			description={description}
			value={trustAll}
			onChange={handleTrustAllChange}
		/>
	);
});
