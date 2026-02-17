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

import * as NagbarActionCreators from '@app/actions/NagbarActionCreators';
import * as PremiumActionCreators from '@app/actions/PremiumActionCreators';
import {Nagbar} from '@app/components/layout/Nagbar';
import {NagbarButton} from '@app/components/layout/NagbarButton';
import {NagbarContent} from '@app/components/layout/NagbarContent';
import {Logger} from '@app/lib/Logger';
import UserStore from '@app/stores/UserStore';
import * as LocaleUtils from '@app/utils/LocaleUtils';
import {openExternalUrl} from '@app/utils/NativeUtils';
import {MS_PER_DAY} from '@fluxer/date_utils/src/DateConstants';
import {getFormattedLongDate} from '@fluxer/date_utils/src/DateFormatting';
import {Trans} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useState} from 'react';

const logger = new Logger('PremiumGracePeriodNagbar');

export const PremiumGracePeriodNagbar = observer(({isMobile}: {isMobile: boolean}) => {
	const user = UserStore.currentUser;
	const [loadingPortal, setLoadingPortal] = useState(false);

	const handleOpenCustomerPortal = async () => {
		setLoadingPortal(true);
		try {
			const url = await PremiumActionCreators.createCustomerPortalSession();
			void openExternalUrl(url);
		} catch (error) {
			logger.error('Failed to open customer portal', error);
		} finally {
			setLoadingPortal(false);
		}
	};

	const handleDismiss = () => {
		NagbarActionCreators.dismissNagbar('premiumGracePeriodDismissed');
	};

	if (!user?.premiumUntil || user?.premiumWillCancel) return null;

	const expiryDate = new Date(user.premiumUntil);
	const gracePeriodMs = 3 * MS_PER_DAY;
	const graceEndDate = new Date(expiryDate.getTime() + gracePeriodMs);
	const locale = LocaleUtils.getCurrentLocale();

	const formattedGraceDate = getFormattedLongDate(graceEndDate, locale);

	return (
		<Nagbar isMobile={isMobile} backgroundColor="#f97316" textColor="#ffffff" dismissible onDismiss={handleDismiss}>
			<NagbarContent
				isMobile={isMobile}
				onDismiss={handleDismiss}
				message={
					<Trans>
						Your subscription failed to renew, but you still have access to Plutonium perks until{' '}
						<strong>{formattedGraceDate}</strong>. Take action now or you'll lose all perks.
					</Trans>
				}
				actions={
					<NagbarButton isMobile={isMobile} onClick={handleOpenCustomerPortal} submitting={loadingPortal}>
						<Trans>Manage Subscription</Trans>
					</NagbarButton>
				}
			/>
		</Nagbar>
	);
});
