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

import {ArrowRightIcon} from '@fluxer/marketing/src/components/icons/ArrowRightIcon';
import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';

interface HackernewsBannerProps {
	ctx: MarketingContext;
}

export function HackernewsBanner(props: HackernewsBannerProps): JSX.Element {
	const {ctx} = props;

	return (
		<a
			href="https://fluxer.gg/fluxer-hq"
			class="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 font-medium text-[#4641D9] text-sm transition-opacity hover:opacity-90"
		>
			<span>{ctx.i18n.getMessage('beta_and_access.try_without_email', ctx.locale)}</span>
			<ArrowRightIcon class="h-4 w-4" />
		</a>
	);
}
