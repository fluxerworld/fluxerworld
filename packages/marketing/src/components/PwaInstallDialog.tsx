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

import {DevicesIcon} from '@fluxer/marketing/src/components/icons/DevicesIcon';
import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';

export function renderPwaInstallTrigger(ctx: MarketingContext): JSX.Element {
	return (
		<button
			type="button"
			id="pwa-install-button"
			class="inline-flex items-center gap-2 rounded-xl bg-[#4641D9] px-5 py-3 font-medium text-sm text-white shadow-md transition-colors hover:bg-[#3832B8]"
		>
			<DevicesIcon class="h-5 w-5" />
			{ctx.i18n.getMessage('platform_support.mobile.install_as_app.title', ctx.locale)}
		</button>
	);
}

export function renderPwaInstallModal(ctx: MarketingContext): JSX.Element {
	return (
		<div id="pwa-modal-backdrop" class="pwa-modal-backdrop">
			<div class="pwa-modal">
				<div class="flex h-full flex-col">
					<div class="flex items-center justify-between p-6 pb-4">
						<h2 class="font-bold text-gray-900 text-xl">
							{ctx.i18n.getMessage('platform_support.mobile.install_as_app.install_fluxer_as_app', ctx.locale)}
						</h2>
						<button
							type="button"
							class="rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
							id="pwa-close"
							aria-label={ctx.i18n.getMessage('navigation.close', ctx.locale)}
						>
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
					<div class="px-6">
						<div class="flex gap-1 rounded-xl bg-gray-100 p-1" id="pwa-tabs">
							{renderTabButton(
								'android',
								ctx.i18n.getMessage('platform_support.platforms.android.name', ctx.locale),
								true,
							)}
							{renderTabButton(
								'ios',
								ctx.i18n.getMessage('platform_support.platforms.ios.ios_ipados', ctx.locale),
								false,
							)}
							{renderTabButton('desktop', ctx.i18n.getMessage('platform_support.desktop.label', ctx.locale), false)}
						</div>
					</div>
					<div class="pwa-panels-container flex-1 overflow-y-auto p-6 pt-4">
						<div id="pwa-panel-android" class="pwa-panel">
							{renderAndroidSteps(ctx)}
						</div>
						<div id="pwa-panel-ios" class="pwa-panel hidden">
							{renderIosSteps(ctx)}
						</div>
						<div id="pwa-panel-desktop" class="pwa-panel hidden">
							{renderDesktopSteps(ctx)}
						</div>
					</div>
					<div class="border-gray-100 border-t px-6 py-4 text-center">
						<p class="text-gray-400 text-xs">
							{ctx.i18n.getMessage('download.screenshots_courtesy_of', ctx.locale)}
							<a
								href="https://installpwa.com/"
								target="_blank"
								rel="noopener noreferrer"
								class="text-blue-500 underline hover:text-blue-600"
							>
								installpwa.com
							</a>
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}

function renderTabButton(id: string, label: string, active: boolean): JSX.Element {
	const className = active
		? 'pwa-tab flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-white text-gray-900 shadow-sm'
		: 'pwa-tab flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors text-gray-600 hover:text-gray-900';

	return (
		<button type="button" data-tab={id} class={className}>
			{label}
		</button>
	);
}

function renderAndroidSteps(ctx: MarketingContext): JSX.Element {
	return (
		<div class="flex flex-col gap-6 md:flex-row">
			<div class="flex justify-center md:w-1/3">{renderImage(ctx, 'android', '240', '320', '480')}</div>
			<div class="md:w-2/3">
				<ol class="space-y-4">
					{renderStep(
						'1',
						<span>
							<a
								href="https://web.fluxer.app"
								target="_blank"
								rel="noopener noreferrer"
								class="text-gray-900 underline hover:text-gray-700"
							>
								{ctx.i18n.getMessage('app.open.open_web_app', ctx.locale)}
							</a>
							{ctx.i18n.getMessage('platform_support.mobile.install_as_app.guides.in_chrome', ctx.locale)}
						</span>,
					)}
					{renderStep(
						'2',
						ctx.i18n.getMessage('platform_support.mobile.install_as_app.guides.steps.press_more_menu', ctx.locale),
					)}
					{renderStep(
						'3',
						ctx.i18n.getMessage('platform_support.mobile.install_as_app.guides.steps.press_install_app', ctx.locale),
					)}
					{renderStep('4', ctx.i18n.getMessage('platform_support.mobile.install_as_app.done_mobile', ctx.locale))}
				</ol>
			</div>
		</div>
	);
}

function renderIosSteps(ctx: MarketingContext): JSX.Element {
	return (
		<div class="flex flex-col gap-6 md:flex-row">
			<div class="flex justify-center md:w-1/2">{renderImage(ctx, 'ios', '320', '480', '640')}</div>
			<div class="md:w-1/2">
				<ol class="space-y-4">
					{renderStep(
						'1',
						<span>
							<a
								href="https://web.fluxer.app"
								target="_blank"
								rel="noopener noreferrer"
								class="text-gray-900 underline hover:text-gray-700"
							>
								{ctx.i18n.getMessage('app.open.open_web_app', ctx.locale)}
							</a>
							{ctx.i18n.getMessage('platform_support.mobile.install_as_app.guides.in_safari', ctx.locale)}
						</span>,
					)}
					{renderStep(
						'2',
						ctx.i18n.getMessage('platform_support.mobile.install_as_app.guides.steps.press_share_button', ctx.locale),
					)}
					{renderStep(
						'3',
						ctx.i18n.getMessage(
							'platform_support.mobile.install_as_app.guides.steps.press_add_to_home_screen',
							ctx.locale,
						),
					)}
					{renderStep(
						'4',
						ctx.i18n.getMessage(
							'platform_support.mobile.install_as_app.guides.steps.press_add_upper_right',
							ctx.locale,
						),
					)}
					{renderStep('5', ctx.i18n.getMessage('platform_support.mobile.install_as_app.done_mobile', ctx.locale))}
				</ol>
			</div>
		</div>
	);
}

function renderDesktopSteps(ctx: MarketingContext): JSX.Element {
	return (
		<div class="flex flex-col gap-6 md:flex-row">
			<div class="flex justify-center md:w-1/2">{renderImage(ctx, 'desktop', '320', '480', '640')}</div>
			<div class="md:w-1/2">
				<ol class="space-y-4">
					{renderStep(
						'1',
						<span>
							<a
								href="https://web.fluxer.app"
								target="_blank"
								rel="noopener noreferrer"
								class="text-gray-900 underline hover:text-gray-700"
							>
								{ctx.i18n.getMessage('app.open.open_web_app', ctx.locale)}
							</a>
							{ctx.i18n.getMessage(
								'platform_support.mobile.install_as_app.guides.in_chrome_or_another_browser',
								ctx.locale,
							)}
						</span>,
					)}
					{renderStep(
						'2',
						ctx.i18n.getMessage(
							'platform_support.mobile.install_as_app.guides.steps.press_install_button_address_bar',
							ctx.locale,
						),
					)}
					{renderStep(
						'3',
						ctx.i18n.getMessage(
							'platform_support.mobile.install_as_app.guides.steps.press_install_in_popup',
							ctx.locale,
						),
					)}
					{renderStep('4', ctx.i18n.getMessage('platform_support.mobile.install_as_app.done_desktop', ctx.locale))}
				</ol>
			</div>
		</div>
	);
}

function renderStep(number: string, content: JSX.Element | string): JSX.Element {
	return (
		<li class="flex items-start gap-4">
			<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 font-semibold text-gray-600 text-sm">
				{number}
			</div>
			<div class="pt-1.5 text-left text-gray-700">{content}</div>
		</li>
	);
}

function renderImage(ctx: MarketingContext, name: string, small: string, medium: string, large: string): JSX.Element {
	const basePath = `${ctx.staticCdnEndpoint}/marketing/pwa-install/${name}`;
	const srcsetAvif = `${basePath}-${small}w.avif 1x, ${basePath}-${medium}w.avif 1.5x, ${basePath}-${large}w.avif 2x`;
	const srcsetWebp = `${basePath}-${small}w.webp 1x, ${basePath}-${medium}w.webp 1.5x, ${basePath}-${large}w.webp 2x`;
	const srcsetPng = `${basePath}-${small}w.png 1x, ${basePath}-${medium}w.png 1.5x, ${basePath}-${large}w.png 2x`;

	return (
		<picture>
			<source type="image/avif" srcset={srcsetAvif} />
			<source type="image/webp" srcset={srcsetWebp} />
			<img
				src={`${basePath}-${medium}w.png`}
				srcset={srcsetPng}
				alt={ctx.i18n.getMessage('platform_support.mobile.install_as_app.guides.pwa_installation_guide', ctx.locale, {
					name,
				})}
				class="h-auto max-w-full rounded-lg border border-gray-200 shadow-lg"
			/>
		</picture>
	);
}
