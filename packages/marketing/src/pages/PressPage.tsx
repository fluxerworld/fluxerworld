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

import {type PressAssetDefinition, PressAssetIds, PressAssets} from '@fluxer/constants/src/PressAssets';
import {defaultHeroPadding, HeroBase} from '@fluxer/marketing/src/components/HeroBase';
import {DownloadArrowIcon} from '@fluxer/marketing/src/components/icons/DownloadArrowIcon';
import {NewspaperIcon} from '@fluxer/marketing/src/components/icons/NewspaperIcon';
import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';
import {renderLayout} from '@fluxer/marketing/src/pages/Layout';
import {pageMeta} from '@fluxer/marketing/src/pages/layout/Meta';
import {href} from '@fluxer/marketing/src/UrlUtils';
import {GRADIENTS} from '@fluxer/ui/src/styles/Gradients';
import {SPACING} from '@fluxer/ui/src/styles/Spacing';
import type {Context} from 'hono';

export async function renderPressPage(c: Context, ctx: MarketingContext): Promise<Response> {
	const content: ReadonlyArray<JSX.Element> = [
		renderHeroSection(ctx),
		renderLogoSection(ctx),
		renderSymbolSection(ctx),
		renderColorsSection(ctx),
		renderContactSection(ctx),
	];

	const meta = pageMeta(
		ctx.i18n.getMessage('navigation.press.press_and_brand_assets', ctx.locale),
		ctx.i18n.getMessage('navigation.press.download_fluxer_assets', ctx.locale),
		'website',
	);
	const html = renderLayout(c, ctx, meta, content);
	return c.html(html);
}

function renderHeroSection(ctx: MarketingContext): JSX.Element {
	return (
		<HeroBase
			icon={<NewspaperIcon class="h-14 w-14 text-white md:h-18 md:w-18" />}
			title={ctx.i18n.getMessage('navigation.press.press_and_brand_assets', ctx.locale)}
			description={ctx.i18n.getMessage('navigation.press.download_assets_intro', ctx.locale)}
			extraContent={<div />}
			customPadding={defaultHeroPadding()}
		/>
	);
}

function renderLogoSection(ctx: MarketingContext): JSX.Element {
	return (
		<section class={`${GRADIENTS.light} ${SPACING.medium}`}>
			<div class="mx-auto max-w-6xl">
				<div class="mb-16 text-center md:mb-20">
					<h2 class="display mb-6 text-4xl text-black md:mb-8 md:text-5xl lg:text-6xl">
						{ctx.i18n.getMessage('press_branding.assets.label', ctx.locale)}
					</h2>
					<p class="body-lg mx-auto max-w-3xl text-gray-600">
						{ctx.i18n.getMessage('press_branding.assets.usage_guidance.full_logo_description', ctx.locale)}
					</p>
				</div>
				<div class="grid gap-6 md:grid-cols-3 md:gap-8">
					{renderAssetCard(
						ctx,
						ctx.i18n.getMessage('press_branding.assets.logo_variants.white_logo', ctx.locale),
						ctx.i18n.getMessage('press_branding.assets.usage_guidance.for_dark_backgrounds', ctx.locale),
						PressAssets[PressAssetIds.LOGO_WHITE],
						'bg-[#1a1a1a]',
					)}
					{renderAssetCard(
						ctx,
						ctx.i18n.getMessage('press_branding.assets.logo_variants.black_logo', ctx.locale),
						ctx.i18n.getMessage('press_branding.assets.usage_guidance.for_light_backgrounds', ctx.locale),
						PressAssets[PressAssetIds.LOGO_BLACK],
						'bg-gray-50',
					)}
					{renderAssetCard(
						ctx,
						ctx.i18n.getMessage('press_branding.assets.logo_variants.color_logo', ctx.locale),
						ctx.i18n.getMessage('press_branding.assets.full_color', ctx.locale),
						PressAssets[PressAssetIds.LOGO_COLOR],
						'bg-gray-50',
					)}
				</div>
			</div>
		</section>
	);
}

function renderSymbolSection(ctx: MarketingContext): JSX.Element {
	return (
		<section class={`bg-white ${SPACING.medium}`}>
			<div class="mx-auto max-w-6xl">
				<div class="mb-16 text-center md:mb-20">
					<h2 class="display mb-6 text-4xl text-black md:mb-8 md:text-5xl lg:text-6xl">
						{ctx.i18n.getMessage('press_branding.assets.symbol_variants.label', ctx.locale)}
					</h2>
					<p class="body-lg mx-auto max-w-3xl text-gray-600">
						{ctx.i18n.getMessage('press_branding.assets.usage_guidance.symbol_description', ctx.locale)}
					</p>
				</div>
				<div class="grid gap-6 md:grid-cols-3 md:gap-8">
					{renderAssetCard(
						ctx,
						ctx.i18n.getMessage('press_branding.assets.symbol_variants.white_symbol', ctx.locale),
						ctx.i18n.getMessage('press_branding.assets.usage_guidance.for_dark_backgrounds', ctx.locale),
						PressAssets[PressAssetIds.SYMBOL_WHITE],
						'bg-[#1a1a1a]',
					)}
					{renderAssetCard(
						ctx,
						ctx.i18n.getMessage('press_branding.assets.symbol_variants.black_symbol', ctx.locale),
						ctx.i18n.getMessage('press_branding.assets.usage_guidance.for_light_backgrounds', ctx.locale),
						PressAssets[PressAssetIds.SYMBOL_BLACK],
						'bg-gray-50',
					)}
					{renderAssetCard(
						ctx,
						ctx.i18n.getMessage('press_branding.assets.symbol_variants.color_symbol', ctx.locale),
						ctx.i18n.getMessage('press_branding.assets.full_color', ctx.locale),
						PressAssets[PressAssetIds.SYMBOL_COLOR],
						'bg-gray-50',
					)}
				</div>
			</div>
		</section>
	);
}

function renderColorsSection(ctx: MarketingContext): JSX.Element {
	return (
		<section class={`bg-gray-50 ${SPACING.medium}`}>
			<div class="mx-auto max-w-6xl">
				<div class="mb-16 text-center md:mb-20">
					<h2 class="display mb-6 text-4xl text-black md:mb-8 md:text-5xl lg:text-6xl">
						{ctx.i18n.getMessage('press_branding.assets.brand_colors_heading', ctx.locale)}
					</h2>
					<p class="body-lg mx-auto max-w-3xl text-gray-600">
						{ctx.i18n.getMessage('press_branding.assets.palette_description', ctx.locale)}
					</p>
				</div>
				<div class="grid gap-6 md:grid-cols-3 md:gap-8">
					{renderColorCard(
						ctx.i18n.getMessage('press_branding.colors.blue_da_ba_dee', ctx.locale),
						'#4641D9',
						ctx.i18n.getMessage('press_branding.assets.primary_brand_color_description', ctx.locale),
					)}
					{renderColorCard(
						ctx.i18n.getMessage('press_branding.colors.white', ctx.locale),
						'#FFFFFF',
						ctx.i18n.getMessage('press_branding.assets.usage_guidance.dark_surface_guidance', ctx.locale),
					)}
					{renderColorCard(
						ctx.i18n.getMessage('press_branding.colors.black', ctx.locale),
						'#000000',
						ctx.i18n.getMessage('press_branding.assets.usage_guidance.light_surface_guidance', ctx.locale),
					)}
				</div>
			</div>
		</section>
	);
}

function renderContactSection(ctx: MarketingContext): JSX.Element {
	return (
		<section class={GRADIENTS.light}>
			<div class={`${GRADIENTS.cta} rounded-t-3xl`}>
				<div class={`mx-auto max-w-3xl ${SPACING.cta} text-center`}>
					<h2 class="display mb-6 text-4xl md:mb-8 md:text-5xl lg:text-6xl">
						{ctx.i18n.getMessage('company_and_resources.press.press_contact', ctx.locale)}
					</h2>
					<p class="body-lg mx-auto mb-8 max-w-3xl text-white/90 md:mb-10">
						{ctx.i18n.getMessage('press_branding.contact.story_prompt', ctx.locale)}
					</p>
					<a
						href="mailto:press@fluxer.app"
						class="label inline-block rounded-xl bg-white px-8 py-4 text-[#4641D9] shadow-lg transition hover:bg-gray-100"
					>
						press@fluxer.app
					</a>
					<p class="body-sm mt-6 text-white/80">
						{ctx.i18n.getMessage('press_branding.contact.response_time', ctx.locale)}
					</p>
				</div>
			</div>
		</section>
	);
}

function renderAssetCard(
	ctx: MarketingContext,
	title: string,
	description: string,
	asset: PressAssetDefinition,
	backgroundClass: string,
): JSX.Element {
	const assetUrl = `${ctx.staticCdnEndpoint}${asset.path}`;
	const downloadUrl = href(ctx, `/press/download/${asset.id}`);

	return (
		<div class="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-lg">
			<div class={`flex aspect-video items-center justify-center p-12 ${backgroundClass}`}>
				<img src={assetUrl} alt={title} class="max-h-32 w-auto" />
			</div>
			<div class="h-px bg-gray-200" />
			<div class="flex items-start justify-between bg-white p-6">
				<div class="flex-1">
					<h3 class="subtitle mb-2 text-black">{title}</h3>
					<p class="body-sm text-gray-600">{description}</p>
				</div>
				<a
					href={downloadUrl}
					download={asset.filename}
					aria-label={ctx.i18n.getMessage('download.download', ctx.locale)}
					class="flex items-center justify-center rounded-lg bg-[#4641D9] p-3 text-white hover:bg-[#3d38c7]"
				>
					<DownloadArrowIcon class="h-5 w-5" />
				</a>
			</div>
		</div>
	);
}

function renderColorCard(name: string, hex: string, description: string): JSX.Element {
	return (
		<div class="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-lg">
			<div class="h-32" style={`background-color: ${hex}`} />
			<div class="h-px bg-gray-200" />
			<div class="bg-white p-6">
				<h3 class="title-sm mb-1 text-black">{name}</h3>
				<p class="caption mb-3 font-mono text-gray-500">{hex}</p>
				<p class="body-sm text-gray-600">{description}</p>
			</div>
		</div>
	);
}
