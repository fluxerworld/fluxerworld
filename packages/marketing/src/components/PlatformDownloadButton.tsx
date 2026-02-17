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

import {AndroidIcon} from '@fluxer/marketing/src/components/icons/AndroidIcon';
import {AppleIcon} from '@fluxer/marketing/src/components/icons/AppleIcon';
import {CaretDownIcon} from '@fluxer/marketing/src/components/icons/CaretDownIcon';
import {DownloadIcon} from '@fluxer/marketing/src/components/icons/DownloadIcon';
import {LinuxIcon} from '@fluxer/marketing/src/components/icons/LinuxIcon';
import {WindowsIcon} from '@fluxer/marketing/src/components/icons/WindowsIcon';
import type {MarketingContext, MarketingPlatform} from '@fluxer/marketing/src/MarketingContext';
import {apiUrl, href, isCanary} from '@fluxer/marketing/src/UrlUtils';

export type ButtonStyle = 'light' | 'dark';

const lightBg = 'bg-white';
const lightText = 'text-[#4641D9]';
const lightHover = 'hover:bg-gray-50';
const darkBg = 'bg-[#4641D9]';
const darkText = 'text-white';
const darkHover = 'hover:bg-[#3a36b0]';
const btnSizing = 'px-5 py-3 md:px-6 md:py-3.5';
const btnBase = `download-link flex items-center justify-center rounded-l-2xl ${btnSizing} transition-colors shadow-lg`;
const chevronBase = 'overlay-toggle flex items-center self-stretch rounded-r-2xl px-3 transition-colors shadow-lg';
const mobileBtnBase = `inline-flex items-center justify-center rounded-2xl ${btnSizing} transition-colors shadow-lg`;
const secondaryBtnBase = `hidden items-center justify-center gap-2 rounded-2xl ${btnSizing} font-semibold text-sm text-white shadow-lg ring-1 ring-inset ring-white/30 bg-white/10 backdrop-blur-sm transition-colors hover:bg-white/20 sm:inline-flex md:text-base`;

interface PlatformDownloadInfo {
	url: string;
	label: string;
	icon: JSX.Element;
}

export function getPlatformDownloadInfo(ctx: MarketingContext): PlatformDownloadInfo {
	switch (ctx.platform) {
		case 'windows': {
			const arch = defaultArchitecture(ctx, 'windows');
			return {
				url: desktopRedirectUrl(ctx, 'win32', arch, 'setup'),
				label: ctx.i18n.getMessage('platform_support.platforms.windows.download_label', ctx.locale),
				icon: <WindowsIcon class="h-5 w-5" />,
			};
		}
		case 'macos': {
			const arch = defaultArchitecture(ctx, 'macos');
			return {
				url: desktopRedirectUrl(ctx, 'darwin', arch, 'dmg'),
				label: ctx.i18n.getMessage('platform_support.platforms.macos.download_label', ctx.locale),
				icon: <AppleIcon class="h-5 w-5" />,
			};
		}
		case 'linux': {
			const arch = defaultArchitecture(ctx, 'linux');
			return {
				url: desktopRedirectUrl(ctx, 'linux', arch, 'deb'),
				label: ctx.i18n.getMessage('platform_support.platforms.linux.choose_distribution', ctx.locale),
				icon: <LinuxIcon class="h-5 w-5" />,
			};
		}
		case 'ios':
		case 'android':
			return {
				url: href(ctx, '/download'),
				label: ctx.i18n.getMessage('platform_support.mobile.mobile_apps_underway', ctx.locale),
				icon: <DownloadIcon class="h-5 w-5" />,
			};
		default:
			return {
				url: href(ctx, '/download'),
				label: ctx.i18n.getMessage('download.download', ctx.locale),
				icon: <DownloadIcon class="h-5 w-5" />,
			};
	}
}

export function getSystemRequirements(ctx: MarketingContext, platform: MarketingPlatform): string {
	switch (platform) {
		case 'windows':
			return ctx.i18n.getMessage('platform_support.platforms.windows.min_version', ctx.locale);
		case 'macos':
			return ctx.i18n.getMessage('platform_support.platforms.macos.min_version', ctx.locale);
		case 'linux':
			return '';
		case 'ios':
			return ctx.i18n.getMessage('platform_support.platforms.ios.min_version', ctx.locale);
		case 'android':
			return ctx.i18n.getMessage('platform_support.platforms.android.min_version', ctx.locale);
		default:
			return '';
	}
}

export function renderSecondaryButton(_ctx: MarketingContext, href: string, label: string): JSX.Element {
	return (
		<a href={href} class={secondaryBtnBase}>
			{label}
		</a>
	);
}

export function renderWithOverlay(ctx: MarketingContext, idPrefix: string | null = null): JSX.Element {
	const requirements = getSystemRequirements(ctx, ctx.platform);
	let button: JSX.Element;

	switch (ctx.platform) {
		case 'windows':
			button = renderDesktopButton(ctx, 'windows', 'light', idPrefix, false, false);
			break;
		case 'macos':
			button = renderDesktopButton(ctx, 'macos', 'light', idPrefix, false, false);
			break;
		case 'linux':
			button = renderDesktopButton(ctx, 'linux', 'light', idPrefix, false, false);
			break;
		case 'ios':
		case 'android':
			button = renderMobileRedirectButton(ctx, 'light');
			break;
		default:
			button = (
				<a
					href={href(ctx, '/download')}
					class={`inline-flex items-center justify-center gap-2 rounded-2xl ${lightBg} px-5 py-3 font-semibold text-base md:px-6 md:py-3.5 md:text-lg ${lightText} shadow-lg transition-colors hover:bg-white/90`}
				>
					<DownloadIcon class="h-5 w-5 shrink-0" />
					<span>{ctx.i18n.getMessage('download.download_fluxer', ctx.locale)}</span>
				</a>
			);
			break;
	}

	if (!requirements) return button;
	return (
		<div class="relative">
			{button}
			<p class="absolute top-full left-1/2 mt-2 -translate-x-1/2 whitespace-nowrap text-center text-white/50 text-xs">
				{requirements}
			</p>
		</div>
	);
}

export function renderMobileButton(
	ctx: MarketingContext,
	platform: MarketingPlatform,
	style: ButtonStyle,
): JSX.Element {
	const config = getMobileConfig(ctx, platform);
	if (!config) return <span />;
	const [btnClass] = getMobileButtonClasses(style);
	const downloadFor = ctx.i18n.getMessage('download.download_for_prefix', ctx.locale);

	return (
		<a class={btnClass} href={config.url}>
			{config.icon}
			<span class="font-semibold text-sm md:text-base">
				{downloadFor} {config.platformName}
			</span>
		</a>
	);
}

function renderMobileRedirectButton(ctx: MarketingContext, style: ButtonStyle): JSX.Element {
	const [btnClass] = getMobileButtonClasses(style);
	return (
		<a class={btnClass} href={href(ctx, '/download')}>
			<DownloadIcon class="h-5 w-5 shrink-0" />
			<span class="font-semibold text-sm md:text-base">
				{ctx.i18n.getMessage('platform_support.mobile.mobile_apps_underway', ctx.locale)}
			</span>
		</a>
	);
}

function getMobileButtonClasses(style: ButtonStyle): [string] {
	if (style === 'light') {
		return [`${mobileBtnBase} gap-2 ${lightBg} ${lightText} hover:bg-white/90`];
	}
	return [`${mobileBtnBase} gap-2 ${darkBg} ${darkText} ${darkHover}`];
}

interface MobileButtonConfig {
	platformName: string;
	icon: JSX.Element;
	url: string;
	helperText: string;
}

function getMobileConfig(ctx: MarketingContext, platform: MarketingPlatform): MobileButtonConfig | null {
	switch (platform) {
		case 'ios':
			return {
				platformName: ctx.i18n.getMessage('platform_support.platforms.ios.name', ctx.locale),
				icon: <AppleIcon class="h-6 w-6 shrink-0" />,
				url: apiUrl(ctx, '/dl/ios/testflight'),
				helperText: ctx.i18n.getMessage('platform_support.platforms.ios.testflight', ctx.locale),
			};
		case 'android':
			return {
				platformName: ctx.i18n.getMessage('platform_support.platforms.android.name', ctx.locale),
				icon: <AndroidIcon class="h-6 w-6 shrink-0" />,
				url: apiUrl(ctx, '/dl/android/arm64/apk'),
				helperText: ctx.i18n.getMessage('platform_support.platforms.android.apk', ctx.locale),
			};
		default:
			return null;
	}
}

export function renderDesktopButton(
	ctx: MarketingContext,
	platform: MarketingPlatform,
	style: ButtonStyle,
	idPrefix: string | null,
	compact: boolean,
	fullWidth: boolean,
): JSX.Element {
	const {platformId, platformName, icon, options} = getPlatformConfig(ctx, platform);
	const finalId = idPrefix ? `${idPrefix}-${platformId}` : platformId;
	const defaultArch = defaultArchitecture(ctx, platform);
	const selected = options.find((opt) => opt.arch === defaultArch) ?? options[0];
	const [btnClass, chevronClass] = getDesktopButtonClasses(style);
	const containerClass = fullWidth ? 'flex w-full' : 'flex';
	const widthModifier = fullWidth ? ' flex-1 w-full min-w-0' : '';
	const buttonClass = `${btnClass}${widthModifier}`;
	const buttonLabel = compact
		? platformName
		: `${ctx.i18n.getMessage('download.download_for_prefix', ctx.locale)}${platformName}`;

	return (
		<div class={`${containerClass} relative`} id={`${finalId}-download-buttons`}>
			<a
				class={buttonClass}
				href={selected.url}
				data-base-url={selected.url}
				data-arch={selected.arch}
				data-format={selected.format}
				data-platform={platformId}
			>
				<div class="flex items-center gap-2">
					{icon}
					<span class="font-semibold text-sm md:text-base">{buttonLabel}</span>
				</div>
			</a>
			<button type="button" class={chevronClass} data-overlay-target={`${finalId}-download-overlay`}>
				<CaretDownIcon class="h-4 w-4" />
			</button>
			<div
				class="download-overlay absolute top-full left-0 z-50 mt-1 hidden w-full min-w-48 rounded-xl border border-gray-200 bg-white shadow-xl"
				id={`${finalId}-download-overlay`}
			>
				{options.map((opt) => (
					<a
						class="download-overlay-link block px-4 py-3 text-gray-900 text-sm transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-gray-100"
						href={opt.url}
						data-arch={opt.arch}
						data-format={opt.format}
						data-base-url={opt.url}
					>
						{formatOverlayLabel(ctx, platform, opt.arch, opt.format)}
					</a>
				))}
			</div>
		</div>
	);
}

interface PlatformOption {
	arch: string;
	format: string;
	url: string;
}

interface PlatformConfig {
	platformId: string;
	platformName: string;
	icon: JSX.Element;
	options: ReadonlyArray<PlatformOption>;
}

function getPlatformConfig(ctx: MarketingContext, platform: MarketingPlatform): PlatformConfig {
	switch (platform) {
		case 'windows':
			return {
				platformId: 'windows',
				platformName: ctx.i18n.getMessage('platform_support.platforms.windows.name', ctx.locale),
				icon: <WindowsIcon class="h-6 w-6 shrink-0" />,
				options: [
					{arch: 'x64', format: 'EXE', url: desktopRedirectUrl(ctx, 'win32', 'x64', 'setup')},
					{arch: 'arm64', format: 'EXE', url: desktopRedirectUrl(ctx, 'win32', 'arm64', 'setup')},
				],
			};
		case 'macos':
			return {
				platformId: 'macos',
				platformName: ctx.i18n.getMessage('platform_support.platforms.macos.name', ctx.locale),
				icon: <AppleIcon class="h-6 w-6 shrink-0" />,
				options: [
					{arch: 'arm64', format: 'DMG', url: desktopRedirectUrl(ctx, 'darwin', 'arm64', 'dmg')},
					{arch: 'x64', format: 'DMG', url: desktopRedirectUrl(ctx, 'darwin', 'x64', 'dmg')},
				],
			};
		case 'linux':
			return {
				platformId: 'linux',
				platformName: ctx.i18n.getMessage('platform_support.platforms.linux.name', ctx.locale),
				icon: <LinuxIcon class="h-6 w-6 shrink-0" />,
				options: linuxDownloadOptions(ctx),
			};
		default:
			return {platformId: '', platformName: '', icon: <span />, options: []};
	}
}

function linuxDownloadOptions(ctx: MarketingContext): ReadonlyArray<PlatformOption> {
	return [
		{arch: 'x64', format: 'AppImage', url: desktopRedirectUrl(ctx, 'linux', 'x64', 'appimage')},
		{arch: 'arm64', format: 'AppImage', url: desktopRedirectUrl(ctx, 'linux', 'arm64', 'appimage')},
		{arch: 'x64', format: 'DEB', url: desktopRedirectUrl(ctx, 'linux', 'x64', 'deb')},
		{arch: 'arm64', format: 'DEB', url: desktopRedirectUrl(ctx, 'linux', 'arm64', 'deb')},
		{arch: 'x64', format: 'RPM', url: desktopRedirectUrl(ctx, 'linux', 'x64', 'rpm')},
		{arch: 'arm64', format: 'RPM', url: desktopRedirectUrl(ctx, 'linux', 'arm64', 'rpm')},
		{arch: 'x64', format: 'tar.gz', url: desktopRedirectUrl(ctx, 'linux', 'x64', 'tar_gz')},
		{arch: 'arm64', format: 'tar.gz', url: desktopRedirectUrl(ctx, 'linux', 'arm64', 'tar_gz')},
	];
}

function getDesktopButtonClasses(style: ButtonStyle): [string, string] {
	if (style === 'light') {
		return [
			`${btnBase} gap-2 ${lightBg} ${lightText} ${lightHover}`,
			`${chevronBase} ${lightBg} border-l border-gray-200 ${lightText} ${lightHover}`,
		];
	}
	return [
		`${btnBase} gap-2 ${darkBg} ${darkText} ${darkHover}`,
		`${chevronBase} ${darkBg} border-l border-white/20 ${darkText} ${darkHover}`,
	];
}

function formatOverlayLabel(ctx: MarketingContext, platform: MarketingPlatform, arch: string, format: string): string {
	if (platform === 'macos') {
		return arch === 'arm64'
			? `${ctx.i18n.getMessage('platform_support.platforms.macos.apple_silicon', ctx.locale)} (${format})`
			: `${ctx.i18n.getMessage('platform_support.platforms.macos.intel', ctx.locale)} (${format})`;
	}
	return `${format} (${arch})`;
}

function defaultArchitecture(ctx: MarketingContext, platform: MarketingPlatform): string {
	if (platform === 'macos') {
		if (ctx.architecture === 'arm64') return 'arm64';
		if (ctx.architecture === 'unknown') return 'arm64';
		return 'x64';
	}
	if (ctx.architecture === 'arm64') return 'arm64';
	return 'x64';
}

function channelSegment(ctx: MarketingContext): string {
	return isCanary(ctx) ? 'canary' : 'stable';
}

function desktopRedirectUrl(ctx: MarketingContext, platform: string, arch: string, format: string): string {
	return apiUrl(ctx, `/dl/desktop/${channelSegment(ctx)}/${platform}/${arch}/latest/${format}`);
}
