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

import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';
import {
	getDonationManageI18n,
	renderDonationManageForm,
} from '@fluxer/marketing/src/pages/donations/DonationManageForm';
import {renderContentLayout} from '@fluxer/marketing/src/pages/Layout';
import {pageMeta} from '@fluxer/marketing/src/pages/layout/Meta';
import type {Context} from 'hono';

export async function renderDonateManagePage(c: Context, ctx: MarketingContext): Promise<Response> {
	const email = c.req.query('email') || '';
	const alert = c.req.query('alert') || '';
	const content = [renderManageContent(ctx, email, alert)];
	const meta = pageMeta(
		ctx.i18n.getMessage('donations.manage.title', ctx.locale),
		ctx.i18n.getMessage('donations.manage.description', ctx.locale),
		'website',
	);
	const html = renderContentLayout(c, ctx, meta, content, {footerClassName: 'rounded-t-3xl'});
	return c.html(html);
}

function renderManageContent(ctx: MarketingContext, emailParam: string, alertParam: string): JSX.Element {
	const i18n = getDonationManageI18n(ctx);

	const showActiveSubscriptionAlert = alertParam === 'active_subscription';
	const activeSubscriptionMessage = ctx.i18n.getMessage('donations.errors.active_subscription_exists', ctx.locale);

	return (
		<section class="mx-auto max-w-2xl">
			<header class="mb-10 text-center">
				<h1 class="mb-4 font-bold text-4xl text-foreground">{i18n.title}</h1>
				<p class="text-lg text-muted-foreground">{i18n.description}</p>
			</header>

			{showActiveSubscriptionAlert ? (
				<div class="mb-6 rounded-lg border border-orange-200 bg-orange-50 p-4 text-center">
					<p class="font-medium text-orange-900">{activeSubscriptionMessage}</p>
				</div>
			) : null}

			{renderDonationManageForm(ctx, emailParam)}
		</section>
	);
}
