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

import {getAccessibleSections} from '@fluxer/admin/src/Navigation';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import type {Flash} from '@fluxer/hono/src/Flash';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import {FlashMessage} from '@fluxer/ui/src/components/Flash';
import {formatDiscriminator, getUserAvatarUrl} from '@fluxer/ui/src/utils/FormatUser';
import type {FC, PropsWithChildren} from 'hono/jsx';

interface LayoutProps {
	title: string;
	activePage: string;
	config: Config;
	session: Session;
	currentAdmin: UserAdminResponse | undefined;
	flash: Flash | undefined;
	autoRefresh?: boolean;
	assetVersion: string;
	csrfToken: string;
	extraScripts?: string;
	inspectedVoiceRegionId?: string;
}

function cacheBustedAsset(basePath: string, assetVersion: string, path: string): string {
	return `${basePath}${path}?t=${assetVersion}`;
}

const Head: FC<{
	title: string;
	basePath: string;
	staticCdnEndpoint: string;
	assetVersion: string;
	autoRefresh: boolean | undefined;
}> = ({title, basePath, staticCdnEndpoint, assetVersion, autoRefresh}) => (
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		{autoRefresh && <meta http-equiv="refresh" content="3" />}
		<title>{title} ~ Fluxer Admin</title>
		<link rel="stylesheet" href={`${staticCdnEndpoint}/fonts/ibm-plex.css`} />
		<link rel="stylesheet" href={`${staticCdnEndpoint}/fonts/bricolage.css`} />
		<link rel="stylesheet" href={cacheBustedAsset(basePath, assetVersion, '/static/app.css')} />
		<link rel="icon" type="image/x-icon" href={`${staticCdnEndpoint}/web/favicon.ico`} />
		<link rel="apple-touch-icon" href={`${staticCdnEndpoint}/web/apple-touch-icon.png`} />
		<link rel="icon" type="image/png" sizes="32x32" href={`${staticCdnEndpoint}/web/favicon-32x32.png`} />
		<link rel="icon" type="image/png" sizes="16x16" href={`${staticCdnEndpoint}/web/favicon-16x16.png`} />
	</head>
);

const SidebarSection: FC<PropsWithChildren<{title: string}>> = ({title, children}) => (
	<div>
		<div class="mb-2 text-neutral-400 text-xs uppercase">{title}</div>
		<div class="space-y-1">{children}</div>
	</div>
);

const SidebarItem: FC<{title: string; path: string; active: boolean; basePath: string}> = ({
	title,
	path,
	active,
	basePath,
}) => {
	const classes = active
		? 'block px-3 py-2 rounded bg-neutral-800 text-white text-sm transition-colors'
		: 'block px-3 py-2 rounded text-neutral-300 hover:bg-neutral-800 hover:text-white text-sm transition-colors';

	return (
		<a href={`${basePath}${path}`} class={classes} {...(active ? {'data-active': ''} : {})}>
			{title}
		</a>
	);
};

const Sidebar: FC<{
	activePage: string;
	adminAcls: Array<string>;
	basePath: string;
	selfHosted: boolean;
	inspectedVoiceRegionId?: string;
}> = ({activePage, adminAcls, basePath, selfHosted, inspectedVoiceRegionId}) => {
	const sections = getAccessibleSections(adminAcls, {selfHosted, inspectedVoiceRegionId});

	return (
		<div
			data-sidebar=""
			class="fixed inset-y-0 left-0 z-40 flex h-screen w-64 -translate-x-full transform flex-col bg-neutral-900 text-white shadow-xl transition-transform duration-200 ease-in-out lg:static lg:inset-auto lg:translate-x-0 lg:shadow-none"
		>
			<div class="flex items-center justify-between gap-3 border-neutral-800 border-b p-6">
				<a href={`${basePath}/users`}>
					<h1 class="font-semibold text-base">Fluxer Admin</h1>
				</a>
				<button
					type="button"
					data-sidebar-close=""
					class="inline-flex items-center justify-center rounded-md p-2 text-neutral-200 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-white/40 lg:hidden"
					aria-label="Close sidebar"
				>
					Close
				</button>
			</div>
			<nav class="sidebar-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
				{sections.map((section) => (
					<SidebarSection title={section.title}>
						{section.items.map((item) => (
							<SidebarItem
								title={item.title}
								path={item.path}
								active={activePage === item.activeKey}
								basePath={basePath}
							/>
						))}
					</SidebarSection>
				))}
			</nav>
			<script
				defer
				dangerouslySetInnerHTML={{
					__html: SIDEBAR_ACTIVE_SCROLL_SCRIPT,
				}}
			/>
		</div>
	);
};

const Header: FC<{
	config: Config;
	session: Session;
	currentAdmin: UserAdminResponse | undefined;
	assetVersion: string;
	csrfToken: string;
}> = ({config, session, currentAdmin, assetVersion, csrfToken}) => (
	<header class="sticky top-0 z-10 flex items-center justify-between gap-4 border-neutral-200 border-b bg-white px-4 py-4 sm:px-6 lg:px-8">
		<div class="flex min-w-0 items-center gap-3">
			<button
				type="button"
				data-sidebar-toggle=""
				class="inline-flex items-center justify-center rounded-md border border-neutral-300 p-2 text-neutral-700 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-400 lg:hidden"
				aria-label="Toggle sidebar"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					class="h-5 w-5"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<line x1="3" y1="6" x2="21" y2="6" />
					<line x1="3" y1="12" x2="21" y2="12" />
					<line x1="3" y1="18" x2="21" y2="18" />
				</svg>
			</button>
			{currentAdmin ? (
				<a
					href={`${config.basePath}/users/${session.userId}`}
					class="flex items-center gap-3 transition-opacity hover:opacity-80"
				>
					<img
						src={getUserAvatarUrl(
							config.mediaEndpoint,
							config.staticCdnEndpoint,
							currentAdmin.id,
							currentAdmin.avatar,
							true,
							assetVersion,
						)}
						alt={`${currentAdmin.username}'s avatar`}
						class="h-10 w-10 rounded-full"
					/>
					<div class="flex flex-col">
						<div class="text-neutral-900 text-sm">
							{currentAdmin.username}#{formatDiscriminator(currentAdmin.discriminator)}
						</div>
						<div class="text-neutral-500 text-xs">Admin</div>
					</div>
				</a>
			) : (
				<div class="text-neutral-600 text-sm">
					Logged in as:{' '}
					<a
						href={`${config.basePath}/users/${session.userId}`}
						class="text-blue-600 hover:text-blue-800 hover:underline"
					>
						{session.userId}
					</a>
				</div>
			)}
		</div>
		<form method="post" action={`${config.basePath}/logout`}>
			<CsrfInput token={csrfToken} />
			<button
				type="submit"
				class="rounded border border-neutral-300 px-4 py-2 font-medium text-neutral-700 text-sm transition-colors hover:border-neutral-400 hover:text-neutral-900"
			>
				Logout
			</button>
		</form>
	</header>
);

const SIDEBAR_ACTIVE_SCROLL_SCRIPT = `
(function () {
	var el = document.querySelector('[data-active]');
	if (el) el.scrollIntoView({block: 'nearest'});
})();
`;

const SIDEBAR_SCRIPT = `
(function () {
	var sidebar = document.querySelector('[data-sidebar]');
	var overlay = document.querySelector('[data-sidebar-overlay]');
	var toggles = document.querySelectorAll('[data-sidebar-toggle]');
	var closes = document.querySelectorAll('[data-sidebar-close]');
	if (!sidebar || !overlay) return;

	function open() {
		sidebar.classList.remove('-translate-x-full');
		overlay.classList.remove('hidden');
		document.body.classList.add('overflow-hidden');
	}

	function close() {
		sidebar.classList.add('-translate-x-full');
		overlay.classList.add('hidden');
		document.body.classList.remove('overflow-hidden');
	}

	toggles.forEach(function (btn) {
		btn.addEventListener('click', function () {
			if (sidebar.classList.contains('-translate-x-full')) {
				open();
			} else {
				close();
			}
		});
	});

	closes.forEach(function (btn) {
		btn.addEventListener('click', close);
	});
	overlay.addEventListener('click', close);

	window.addEventListener('keydown', function (event) {
		if (event.key === 'Escape') close();
	});

	function syncForDesktop() {
		if (window.innerWidth >= 1024) {
			overlay.classList.add('hidden');
			document.body.classList.remove('overflow-hidden');
			sidebar.classList.remove('-translate-x-full');
		} else {
			sidebar.classList.add('-translate-x-full');
		}
	}

	window.addEventListener('resize', syncForDesktop);
	syncForDesktop();
})();
`;

const SH_LINK_REWRITE_SCRIPT = `
(function () {
	if (window.location.search.indexOf('sh=1') === -1) return;

	function rewriteHref(el) {
		var href = el.getAttribute('href');
		if (!href || href.indexOf('sh=1') >= 0) return;
		if (href.charAt(0) === '#' || href.indexOf('javascript:') === 0 || href.indexOf('data:') === 0 || href.indexOf('mailto:') === 0) return;
		if (href.indexOf('://') >= 0) {
			try {
				var url = new URL(href);
				if (url.origin !== window.location.origin) return;
			} catch (e) {
				return;
			}
		}
		var sep = href.indexOf('?') >= 0 ? '&' : '?';
		el.setAttribute('href', href + sep + 'sh=1');
	}

	function rewriteAction(form) {
		var action = form.getAttribute('action');
		if (!action || action.indexOf('sh=1') >= 0) return;
		var sep = action.indexOf('?') >= 0 ? '&' : '?';
		form.setAttribute('action', action + sep + 'sh=1');
	}

	document.querySelectorAll('a[href]').forEach(rewriteHref);
	document.querySelectorAll('form[action]').forEach(rewriteAction);

	document.addEventListener('click', function (e) {
		var a = e.target.closest('a[href]');
		if (a) rewriteHref(a);
	}, true);

	document.addEventListener('submit', function (e) {
		var form = e.target.closest('form[action]');
		if (form) rewriteAction(form);
	}, true);
})();
`;

export function Layout({
	title,
	activePage,
	config,
	session,
	currentAdmin,
	flash,
	autoRefresh,
	assetVersion,
	csrfToken,
	extraScripts,
	inspectedVoiceRegionId,
	children,
}: PropsWithChildren<LayoutProps>) {
	const adminAcls = currentAdmin?.acls ?? [];

	return (
		<html lang="en" data-base-path={config.basePath}>
			<Head
				title={title}
				basePath={config.basePath}
				staticCdnEndpoint={config.staticCdnEndpoint}
				assetVersion={assetVersion}
				autoRefresh={autoRefresh}
			/>
			<body class="min-h-screen overflow-hidden bg-neutral-50">
				<div class="flex h-screen">
					<Sidebar
						activePage={activePage}
						adminAcls={adminAcls}
						basePath={config.basePath}
						selfHosted={config.selfHosted}
						inspectedVoiceRegionId={inspectedVoiceRegionId}
					/>
					<div data-sidebar-overlay="" class="fixed inset-0 z-30 hidden bg-black/50 lg:hidden" />
					<div class="flex h-screen w-full flex-1 flex-col overflow-y-auto">
						<Header
							config={config}
							session={session}
							currentAdmin={currentAdmin}
							assetVersion={assetVersion}
							csrfToken={csrfToken}
						/>
						<main class="flex-1 p-4 sm:p-6 lg:p-8">
							<div class="mx-auto w-full max-w-7xl">
								{flash && (
									<div class="mb-6">
										<FlashMessage flash={flash} />
									</div>
								)}
								{children}
							</div>
						</main>
					</div>
				</div>
				<script defer dangerouslySetInnerHTML={{__html: SIDEBAR_SCRIPT}} />
				<script defer dangerouslySetInnerHTML={{__html: SH_LINK_REWRITE_SCRIPT}} />
				{extraScripts && <script defer dangerouslySetInnerHTML={{__html: extraScripts}} />}
			</body>
		</html>
	);
}
