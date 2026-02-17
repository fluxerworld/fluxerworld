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

import type {PriceIds} from '@app/actions/PremiumActionCreators';
import * as PremiumActionCreators from '@app/actions/PremiumActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {Logger} from '@app/lib/Logger';
import {useLingui} from '@lingui/react/macro';
import {useEffect, useState} from 'react';

const logger = new Logger('usePremiumData');

export interface PremiumData {
	priceIds: PriceIds | null;
}

export const usePremiumData = (countryCode: string | null): PremiumData => {
	const {t} = useLingui();
	const [priceIds, setPriceIds] = useState<PriceIds | null>(null);

	useEffect(() => {
		let mounted = true;
		const fetchData = async () => {
			try {
				const prices = await PremiumActionCreators.fetchPriceIds(countryCode ?? undefined);
				if (!mounted) return;
				setPriceIds(prices);
			} catch (error) {
				logger.error('Failed to fetch premium data', error);
				if (!mounted) return;
				ToastActionCreators.error(t`Failed to load premium information. Please try again later.`);
			}
		};
		fetchData();
		return () => {
			mounted = false;
		};
	}, [countryCode]);

	return {
		priceIds,
	};
};
