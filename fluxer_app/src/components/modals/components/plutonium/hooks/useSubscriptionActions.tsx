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

import * as PremiumActionCreators from '@app/actions/PremiumActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {Logger} from '@app/lib/Logger';
import {openExternalUrl} from '@app/utils/NativeUtils';
import {useLingui} from '@lingui/react/macro';
import {useCallback, useState} from 'react';

const logger = new Logger('useSubscriptionActions');

export const useSubscriptionActions = () => {
	const {t} = useLingui();
	const [loadingPortal, setLoadingPortal] = useState(false);
	const [loadingCancel, setLoadingCancel] = useState(false);
	const [loadingReactivate, setLoadingReactivate] = useState(false);

	const handleOpenCustomerPortal = useCallback(async () => {
		setLoadingPortal(true);
		try {
			const url = await PremiumActionCreators.createCustomerPortalSession();
			void openExternalUrl(url);
		} catch (error) {
			logger.error('Failed to open customer portal', error);
			ToastActionCreators.error(t`Failed to open customer portal. Please try again.`);
		} finally {
			setLoadingPortal(false);
		}
	}, [t]);

	const handleCancelSubscription = useCallback(async () => {
		setLoadingCancel(true);
		try {
			await PremiumActionCreators.cancelSubscriptionAtPeriodEnd();
			ToastActionCreators.success(t`Your subscription has been set to cancel at the end of your billing period.`);
		} catch (error) {
			logger.error('Failed to cancel subscription', error);
			ToastActionCreators.error(t`Failed to cancel subscription. Please try again.`);
		} finally {
			setLoadingCancel(false);
		}
	}, [t]);

	const handleReactivateSubscription = useCallback(async () => {
		setLoadingReactivate(true);
		try {
			await PremiumActionCreators.reactivateSubscription();
			ToastActionCreators.success(t`Your subscription has been reactivated!`);
		} catch (error) {
			logger.error('Failed to reactivate subscription', error);
			ToastActionCreators.error(t`Failed to reactivate subscription. Please try again.`);
		} finally {
			setLoadingReactivate(false);
		}
	}, [t]);

	return {
		loadingPortal,
		loadingCancel,
		loadingReactivate,
		handleOpenCustomerPortal,
		handleCancelSubscription,
		handleReactivateSubscription,
	};
};
