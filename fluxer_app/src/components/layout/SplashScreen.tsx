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

import {FluxerIcon} from '@app/components/icons/FluxerIcon';
import {NativeDragRegion} from '@app/components/layout/NativeDragRegion';
import styles from '@app/components/layout/SplashScreen.module.css';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import DeveloperOptionsStore from '@app/stores/DeveloperOptionsStore';
import GatewayConnectionStore from '@app/stores/gateway/GatewayConnectionStore';
import InitializationStore from '@app/stores/InitializationStore';
import {getReducedMotionProps} from '@app/utils/ReducedMotionAnimation';
import {AnimatePresence, motion} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import {useEffect, useState} from 'react';

const SPLASH_SCREEN_DELAY = 10000;

export const SplashScreen = observer(() => {
	const shouldBypass = DeveloperOptionsStore.bypassSplashScreen;
	const connected = GatewayConnectionStore.isConnected;
	const isInitialized = InitializationStore.canNavigateToProtectedRoutes;
	const [showSplash, setShowSplash] = useState(true);

	useEffect(() => {
		if (connected && isInitialized) {
			setShowSplash(false);
			return;
		}

		const timer = setTimeout(() => setShowSplash(true), SPLASH_SCREEN_DELAY);
		return () => clearTimeout(timer);
	}, [connected, isInitialized]);

	if (shouldBypass) return null;
	return <AnimatePresence initial={false}>{showSplash && <SplashScreenContent />}</AnimatePresence>;
});

const SPLASH_MOTION = {
	initial: {opacity: 0},
	animate: {opacity: 1},
	exit: {opacity: 0},
	transition: {duration: 0.5},
};

const SplashScreenContent = observer(() => {
	const splashMotion = getReducedMotionProps(SPLASH_MOTION, AccessibilityStore.useReducedMotion);
	return (
		<motion.div {...splashMotion} className={styles.splashOverlay}>
			<NativeDragRegion className={styles.topDragRegion} />
			<div className={styles.splashContent}>
				<div className={styles.iconWrapper}>
					<div className={styles.iconPulse} />
					<FluxerIcon className={styles.icon} />
				</div>
			</div>
		</motion.div>
	);
});
