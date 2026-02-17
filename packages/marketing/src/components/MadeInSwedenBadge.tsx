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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import {Locales} from '@fluxer/constants/src/Locales';
import {FlagSvg} from '@fluxer/marketing/src/components/Flags';
import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';

interface MadeInSwedenBadgeProps {
	ctx: MarketingContext;
}

export function MadeInSwedenBadge(props: MadeInSwedenBadgeProps): JSX.Element {
	const {ctx} = props;

	return (
		<span class="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 font-medium text-[#4641D9] text-sm">
			<FlagSvg locale={Locales.SV_SE} ctx={ctx} class="h-4 w-4 rounded-sm" />
			<span>{ctx.i18n.getMessage('general.made_in_sweden', ctx.locale)}</span>
		</span>
	);
}
