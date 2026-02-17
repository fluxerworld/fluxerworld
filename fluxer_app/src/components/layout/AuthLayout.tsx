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

import {AuthBackground} from '@app/components/auth/AuthBackground';
import {AuthCardContainer} from '@app/components/auth/AuthCardContainer';
import styles from '@app/components/layout/AuthLayout.module.css';
import {NativeDragRegion} from '@app/components/layout/NativeDragRegion';
import {NativeTitlebar} from '@app/components/layout/NativeTitlebar';
import {Scroller, type ScrollerHandle} from '@app/components/uikit/Scroller';
import {AuthLayoutContext} from '@app/contexts/AuthLayoutContext';
import {AuthRegisterDraftContext, type AuthRegisterFormDraft} from '@app/contexts/AuthRegisterDraftContext';
import {useSetLayoutVariant} from '@app/contexts/LayoutVariantContext';
import {useAuthBackground} from '@app/hooks/useAuthBackground';
import {useNativePlatform} from '@app/hooks/useNativePlatform';
import i18n, {initI18n} from '@app/I18n';
import FluxerWordmarkMonochrome from '@app/images/fluxer-logo-wordmark-monochrome.svg?react';
import foodPatternUrl from '@app/images/i-like-food.svg';
import {useLocation} from '@app/lib/router/React';
import {isMobileExperienceEnabled} from '@app/utils/MobileExperience';
import type {GuildSplashCardAlignmentValue} from '@fluxer/constants/src/GuildConstants';
import {GuildSplashCardAlignment} from '@fluxer/constants/src/GuildConstants';
import {I18nProvider} from '@lingui/react';
import clsx from 'clsx';
import {observer} from 'mobx-react-lite';
import {type ReactNode, useCallback, useEffect, useMemo, useRef, useState} from 'react';

const AuthLayoutContent = observer(function AuthLayoutContent({children}: {children?: ReactNode}) {
	const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
	const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
	const [splashUrl, setSplashUrl] = useState<string | null>(null);
	const [showLogoSide, setShowLogoSide] = useState(true);
	const [splashAlignment, setSplashAlignment] = useState<GuildSplashCardAlignmentValue>(
		GuildSplashCardAlignment.CENTER,
	);
	const {isNative, isMacOS, platform} = useNativePlatform();
	const splashUrlRef = useRef<string | null>(null);
	const registerFormDraftsRef = useRef<Map<string, AuthRegisterFormDraft>>(new Map());
	const scrollerRef = useRef<ScrollerHandle>(null);
	const location = useLocation();

	const {patternReady, splashLoaded, splashDimensions} = useAuthBackground(splashUrl, foodPatternUrl);

	const handleSetSplashUrl = useCallback(
		(url: string | null) => {
			if (splashUrlRef.current === url) return;
			splashUrlRef.current = url;
			setSplashUrl(url);
			if (!url) {
				setSplashAlignment(GuildSplashCardAlignment.CENTER);
			}
		},
		[setSplashAlignment],
	);

	useEffect(() => {
		const handleResize = () => {
			setViewportWidth(window.innerWidth);
			setViewportHeight(window.innerHeight);
		};
		handleResize();
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	useEffect(() => {
		document.documentElement.classList.add('auth-page');
		return () => {
			document.documentElement.classList.remove('auth-page');
		};
	}, []);

	useEffect(() => {
		scrollerRef.current?.scrollToTop();
	}, [location.pathname]);

	const splashScale = useMemo(() => {
		if (!splashDimensions) return null;
		const {width, height} = splashDimensions;
		if (width <= 0 || height <= 0) return null;
		const heightScale = viewportHeight / height;
		const widthScale = viewportWidth / width;
		return Math.max(heightScale, widthScale);
	}, [splashDimensions, viewportHeight, viewportWidth]);

	const getRegisterFormDraft = useCallback((draftKey: string): AuthRegisterFormDraft | undefined => {
		const draft = registerFormDraftsRef.current.get(draftKey);
		if (!draft) {
			return undefined;
		}
		return {
			...draft,
			formValues: {...draft.formValues},
		};
	}, []);

	const setRegisterFormDraft = useCallback((draftKey: string, draft: AuthRegisterFormDraft) => {
		registerFormDraftsRef.current.set(draftKey, {
			...draft,
			formValues: {...draft.formValues},
		});
	}, []);

	const clearRegisterFormDraft = useCallback((draftKey: string) => {
		registerFormDraftsRef.current.delete(draftKey);
	}, []);

	const authLayoutContextValue = useMemo(
		() => ({
			setSplashUrl: handleSetSplashUrl,
			setShowLogoSide,
			setSplashCardAlignment: setSplashAlignment,
		}),
		[handleSetSplashUrl],
	);

	const authRegisterDraftContextValue = useMemo(
		() => ({
			getRegisterFormDraft,
			setRegisterFormDraft,
			clearRegisterFormDraft,
		}),
		[clearRegisterFormDraft, getRegisterFormDraft, setRegisterFormDraft],
	);

	const isMobileExperience = isMobileExperienceEnabled();

	if (isMobileExperience) {
		return (
			<AuthRegisterDraftContext.Provider value={authRegisterDraftContextValue}>
				<AuthLayoutContext.Provider value={authLayoutContextValue}>
					<NativeDragRegion className={styles.topDragRegion} />
					<div className={styles.scrollerWrapper}>
						<Scroller
							ref={scrollerRef}
							className={styles.mobileContainer}
							fade={false}
							key="auth-layout-mobile-scroller"
						>
							<div className={styles.mobileContent}>
								<div className={styles.mobileLogoContainer}>
									<FluxerWordmarkMonochrome className={styles.mobileWordmark} />
								</div>
								{children}
							</div>
						</Scroller>
					</div>
				</AuthLayoutContext.Provider>
			</AuthRegisterDraftContext.Provider>
		);
	}
	return (
		<AuthRegisterDraftContext.Provider value={authRegisterDraftContextValue}>
			<AuthLayoutContext.Provider value={authLayoutContextValue}>
				<NativeDragRegion className={styles.topDragRegion} />
				<div className={styles.scrollerWrapper}>
					<Scroller ref={scrollerRef} className={styles.container} key="auth-layout-scroller">
						{isNative && !isMacOS && <NativeTitlebar platform={platform} />}
						<div className={styles.characterBackground}>
							<AuthBackground
								splashUrl={splashUrl}
								splashLoaded={splashLoaded}
								splashDimensions={splashDimensions}
								splashScale={splashScale}
								patternReady={patternReady}
								patternImageUrl={foodPatternUrl}
								splashAlignment={splashAlignment}
								useFullCover={false}
							/>

							<div
								className={clsx(
									styles.leftSplit,
									splashAlignment === GuildSplashCardAlignment.LEFT && styles.alignLeft,
									splashAlignment === GuildSplashCardAlignment.RIGHT && styles.alignRight,
								)}
							>
								<div className={styles.leftSplitWrapper}>
									<div className={styles.leftSplitAnimated}>
										<AuthCardContainer showLogoSide={showLogoSide} isInert={false}>
											{children}
										</AuthCardContainer>
									</div>
								</div>
							</div>
						</div>
					</Scroller>
				</div>
			</AuthLayoutContext.Provider>
		</AuthRegisterDraftContext.Provider>
	);
});

export const AuthLayout = observer(function AuthLayout({children}: {children?: ReactNode}) {
	const [isI18nInitialized, setIsI18nInitialized] = useState(false);
	const setLayoutVariant = useSetLayoutVariant();

	useEffect(() => {
		setLayoutVariant('auth');
		return () => {
			setLayoutVariant('app');
		};
	}, [setLayoutVariant]);

	useEffect(() => {
		initI18n().then(() => {
			setIsI18nInitialized(true);
		});
	}, []);

	if (!isI18nInitialized) {
		return null;
	}

	return (
		<I18nProvider i18n={i18n}>
			<AuthLayoutContent>{children}</AuthLayoutContent>
		</I18nProvider>
	);
});
