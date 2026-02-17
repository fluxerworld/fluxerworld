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

import {CurrentFeaturesSection} from '@fluxer/marketing/src/components/CurrentFeaturesSection';
import {FinalCtaSection} from '@fluxer/marketing/src/components/FinalCtaSection';
import {GetInvolvedSection} from '@fluxer/marketing/src/components/GetInvolvedSection';
import {Hero} from '@fluxer/marketing/src/components/Hero';
import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';
import {renderLayout} from '@fluxer/marketing/src/pages/Layout';
import {defaultPageMeta} from '@fluxer/marketing/src/pages/layout/Meta';
import type {Context} from 'hono';

export async function renderHomePage(c: Context, ctx: MarketingContext): Promise<Response> {
	const getInvolved = await GetInvolvedSection({ctx});
	const content: ReadonlyArray<JSX.Element> = [
		<Hero ctx={ctx} />,
		<CurrentFeaturesSection ctx={ctx} />,
		getInvolved,
		<FinalCtaSection ctx={ctx} />,
	];

	const html = renderLayout(c, ctx, defaultPageMeta(), content);
	return c.html(html);
}
