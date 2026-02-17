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

import * as AuthenticationActionCreators from '@app/actions/AuthenticationActionCreators';
import {KeyboardModeListener} from '@app/components/layout/KeyboardModeListener';
import {MobileBottomNav} from '@app/components/layout/MobileBottomNav';
import {SplashScreen} from '@app/components/layout/SplashScreen';
import {Logger} from '@app/lib/Logger';
import {useLocation} from '@app/lib/router/React';
import SessionManager from '@app/lib/SessionManager';
import {Routes} from '@app/Routes';
import {isAutoRedirectExemptPath} from '@app/router/RouterConstants';
import * as PushSubscriptionService from '@app/services/push/PushSubscriptionService';
import AccountManager from '@app/stores/AccountManager';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import GatewayConnectionStore from '@app/stores/gateway/GatewayConnectionStore';
import InitializationStore from '@app/stores/InitializationStore';
import LocationStore from '@app/stores/LocationStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import UserStore from '@app/stores/UserStore';
import {navigateToWithMobileHistory} from '@app/utils/MobileNavigation';
import {isInstalledPwa} from '@app/utils/PwaUtils';
import * as RouterUtils from '@app/utils/RouterUtils';
import {setPathQueryParams} from '@app/utils/UrlUtils';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

const logger = new Logger('RootComponent');

export const RootComponent: React.FC<{children?: React.ReactNode}> = observer(({children}) => {
	const location = useLocation();
	const isAuthenticated = AuthenticationStore.isAuthenticated;
	const mobileLayoutState = MobileLayoutStore;
	const [hasRestoredLocation, setHasRestoredLocation] = useState(false);
	const currentUser = UserStore.currentUser;
	const [hasHandledNotificationNav, setHasHandledNotificationNav] = useState(false);
	const [previousMobileLayoutState, setPreviousMobileLayoutState] = useState(mobileLayoutState.enabled);
	const lastMobileHistoryBuildRef = useRef<{ts: number; path: string} | null>(null);
	const lastNotificationNavRef = useRef<{ts: number; key: string} | null>(null);
	const isLocationStoreHydrated = LocationStore.isHydrated;
	const canNavigateToProtectedRoutes = InitializationStore.canNavigateToProtectedRoutes;
	const pendingRedirectRef = useRef<string | null>(null);

	const hasStartedRestoreRef = useRef(false);
	const pathname = location.pathname;
	const isDesktopHandoff = location.searchParams.get('desktop_handoff') === '1';
	const isAutoRedirectExemptRoute = isAutoRedirectExemptPath(pathname);
	const shouldSkipAutoRedirect = isAutoRedirectExemptRoute || (pathname === Routes.LOGIN && isDesktopHandoff);

	const isStandaloneRoute = useMemo(() => {
		return (
			pathname.startsWith(Routes.LOGIN) ||
			pathname.startsWith(Routes.REGISTER) ||
			pathname.startsWith(Routes.FORGOT_PASSWORD) ||
			pathname.startsWith(Routes.RESET_PASSWORD) ||
			pathname.startsWith(Routes.VERIFY_EMAIL) ||
			pathname.startsWith(Routes.AUTHORIZE_IP) ||
			pathname.startsWith(Routes.EMAIL_REVERT) ||
			pathname.startsWith(Routes.OAUTH_AUTHORIZE) ||
			pathname.startsWith(Routes.REPORT) ||
			pathname.startsWith(Routes.PREMIUM_CALLBACK) ||
			pathname.startsWith(Routes.CONNECTION_CALLBACK) ||
			pathname === '/__notfound' ||
			pathname.startsWith('/invite/') ||
			pathname.startsWith('/gift/') ||
			pathname.startsWith('/theme/')
		);
	}, [pathname]);

	const shouldBypassGateway = isStandaloneRoute;
	const authToken = AuthenticationStore.authToken;

	const normalizeInternalUrl = useCallback((rawUrl: string): string => {
		try {
			const u = new URL(rawUrl, window.location.origin);
			if (u.origin === window.location.origin) {
				return u.pathname + u.search + u.hash;
			}
			return rawUrl;
		} catch {
			return rawUrl;
		}
	}, []);

	useEffect(() => {
		if (!SessionManager.isInitialized) return;
		if (AccountManager.isSwitching) return;

		const isAuth = AuthenticationStore.isAuthenticated;

		if (isAuth && isStandaloneRoute) return;

		if (shouldBypassGateway) {
			if (isAuth) {
				if (!shouldSkipAutoRedirect) {
					RouterUtils.replaceWith(Routes.ME);
				}
				return;
			}
			if (GatewayConnectionStore.isConnected || GatewayConnectionStore.isConnecting || GatewayConnectionStore.socket) {
				GatewayConnectionStore.logout();
			}
			return;
		}

		if (!isAuth) {
			const current = pathname + window.location.search;
			if (!pendingRedirectRef.current) {
				pendingRedirectRef.current = current;
			}
			RouterUtils.replaceWith(setPathQueryParams(Routes.LOGIN, {redirect_to: pendingRedirectRef.current}));
			return;
		}

		if (isAuth && InitializationStore.isLoading) {
			void AuthenticationActionCreators.ensureSessionStarted();
		}
	}, [
		SessionManager.isInitialized,
		authToken,
		AccountManager.isSwitching,
		AuthenticationStore.isAuthenticated,
		GatewayConnectionStore.isConnected,
		GatewayConnectionStore.isConnecting,
		InitializationStore.isLoading,
		shouldBypassGateway,
		shouldSkipAutoRedirect,
		pendingRedirectRef,
	]);

	useEffect(() => {
		if (!AuthenticationStore.isAuthenticated) return;
		const target = pendingRedirectRef.current;
		if (!target) return;

		const current = location.pathname + window.location.search;
		if (current !== target) {
			RouterUtils.replaceWith(target);
		}

		pendingRedirectRef.current = null;
	}, [AuthenticationStore.isAuthenticated, location.pathname]);

	useEffect(() => {
		if (
			!isAuthenticated ||
			hasRestoredLocation ||
			hasStartedRestoreRef.current ||
			!canNavigateToProtectedRoutes ||
			!isLocationStoreHydrated
		) {
			return;
		}

		if (location.pathname === Routes.HOME) {
			return;
		}

		hasStartedRestoreRef.current = true;
		setHasRestoredLocation(true);

		const lastLocation = LocationStore.getLastLocation();
		if (lastLocation && lastLocation !== location.pathname && location.pathname === Routes.ME) {
			navigateToWithMobileHistory(lastLocation, mobileLayoutState.enabled);
		} else if (mobileLayoutState.enabled) {
			const p = location.pathname;
			if ((Routes.isDMRoute(p) && p !== Routes.ME) || (Routes.isGuildChannelRoute(p) && p.split('/').length === 4)) {
				navigateToWithMobileHistory(p, true);
				setHasHandledNotificationNav(true);
			}
		}
	}, [
		isAuthenticated,
		hasRestoredLocation,
		mobileLayoutState.enabled,
		isLocationStoreHydrated,
		canNavigateToProtectedRoutes,
		location.pathname,
	]);

	useEffect(() => {
		if (!isAuthenticated || !hasRestoredLocation) return;

		if (previousMobileLayoutState !== mobileLayoutState.enabled) {
			setPreviousMobileLayoutState(mobileLayoutState.enabled);

			if (mobileLayoutState.enabled) {
				const currentPath = location.pathname;
				if (
					(Routes.isDMRoute(currentPath) && currentPath !== Routes.ME) ||
					(Routes.isGuildChannelRoute(currentPath) && currentPath.split('/').length === 4)
				) {
					navigateToWithMobileHistory(currentPath, true);
				}
			}
		}
	}, [isAuthenticated, hasRestoredLocation, mobileLayoutState.enabled, previousMobileLayoutState, location.pathname]);

	useEffect(() => {
		const shouldSaveLocation = Routes.isChannelRoute(location.pathname) || Routes.isSpecialPage(location.pathname);

		if (isAuthenticated && shouldSaveLocation) {
			LocationStore.saveLocation(location.pathname);
		}
	}, [isAuthenticated, location.pathname]);

	useEffect(() => {
		if (!isAuthenticated || !hasRestoredLocation) return;

		if (previousMobileLayoutState !== mobileLayoutState.enabled) {
			setPreviousMobileLayoutState(mobileLayoutState.enabled);

			if (mobileLayoutState.enabled) {
				const currentPath = location.pathname;

				const now = Date.now();
				const last = lastMobileHistoryBuildRef.current;
				if (last && last.path === currentPath && now - last.ts < 1500) {
					return;
				}
				lastMobileHistoryBuildRef.current = {ts: now, path: currentPath};
				if (
					(Routes.isDMRoute(currentPath) && currentPath !== Routes.ME) ||
					(Routes.isGuildChannelRoute(currentPath) && currentPath.split('/').length === 4)
				) {
					if (Routes.isDMRoute(currentPath) && currentPath !== Routes.ME) {
						RouterUtils.replaceWith(Routes.ME);
						setTimeout(() => RouterUtils.transitionTo(currentPath), 0);
					} else if (Routes.isGuildChannelRoute(currentPath) && currentPath.split('/').length === 4) {
						const parts = currentPath.split('/');
						const guildId = parts[2];
						const guildPath = Routes.guildChannel(guildId);
						RouterUtils.replaceWith(guildPath);
						setTimeout(() => RouterUtils.transitionTo(currentPath), 0);
					}
				}
			}
		}
	}, [isAuthenticated, hasRestoredLocation, mobileLayoutState.enabled, previousMobileLayoutState, location.pathname]);

	const navigateWithHistoryStack = useCallback(
		(url: string) => {
			navigateToWithMobileHistory(url, mobileLayoutState.enabled);
		},
		[mobileLayoutState.enabled],
	);

	useEffect(() => {
		if (!isAuthenticated) return;

		const handleNotificationNavigate = (event: MessageEvent) => {
			if (event.data?.type === 'NOTIFICATION_CLICK_NAVIGATE') {
				const rawUrl = typeof event.data.url === 'string' ? event.data.url : null;
				if (!rawUrl) return;

				const targetUserId =
					typeof event.data.targetUserId === 'string' ? (event.data.targetUserId as string) : undefined;

				const normalizedUrl = normalizeInternalUrl(rawUrl);
				const key = `${targetUserId ?? ''}:${normalizedUrl}`;
				const now = Date.now();
				const last = lastNotificationNavRef.current;
				if (last && last.key === key && now - last.ts < 1500) {
					return;
				}
				lastNotificationNavRef.current = {ts: now, key};

				void (async () => {
					if (targetUserId && targetUserId !== AccountManager.currentUserId && AccountManager.canSwitchAccounts) {
						try {
							await AccountManager.switchToAccount(targetUserId);
						} catch (error) {
							logger.error('Failed to switch account for notification', error);
						}
					}

					if (mobileLayoutState.enabled) {
						navigateWithHistoryStack(normalizedUrl);
					} else {
						RouterUtils.transitionTo(normalizedUrl);
					}

					setHasHandledNotificationNav(true);
				})();

				return;
			}

			if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGE') {
				if (isInstalledPwa()) {
					void PushSubscriptionService.registerPushSubscription();
				}
			}
		};

		if (!hasHandledNotificationNav) {
			const urlParams = location.searchParams;
			if (urlParams.get('fromNotification') === '1') {
				const newParams = new URLSearchParams(urlParams);
				newParams.delete('fromNotification');
				const cleanUrl = new URL(location.pathname, window.location.origin);
				cleanUrl.search = newParams.toString();
				const cleanPath = `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`;

				if (mobileLayoutState.enabled) {
					navigateWithHistoryStack(cleanPath);
				} else {
					RouterUtils.transitionTo(cleanPath);
				}

				setHasHandledNotificationNav(true);
			}
		}

		navigator.serviceWorker?.addEventListener('message', handleNotificationNavigate);

		return () => {
			navigator.serviceWorker?.removeEventListener('message', handleNotificationNavigate);
		};
	}, [
		isAuthenticated,
		mobileLayoutState.enabled,
		hasHandledNotificationNav,
		location,
		navigateWithHistoryStack,
		normalizeInternalUrl,
	]);

	const showBottomNav =
		mobileLayoutState.enabled &&
		(location.pathname === Routes.ME ||
			Routes.isFavoritesRoute(location.pathname) ||
			location.pathname === Routes.NOTIFICATIONS ||
			location.pathname === Routes.YOU ||
			(Routes.isGuildChannelRoute(location.pathname) && location.pathname.split('/').length === 3));

	if (isAuthenticated && !canNavigateToProtectedRoutes && !shouldBypassGateway) {
		return <SplashScreen />;
	}

	return (
		<>
			<KeyboardModeListener />
			{children}
			{showBottomNav && currentUser && <MobileBottomNav currentUser={currentUser} />}
		</>
	);
});
