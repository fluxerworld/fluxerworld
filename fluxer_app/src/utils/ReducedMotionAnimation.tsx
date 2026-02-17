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

import type {Transition} from 'framer-motion';

type MotionTarget = Record<string, string | number>;

interface MotionAnimation {
	initial: MotionTarget;
	animate: MotionTarget;
	exit: MotionTarget;
	transition: Transition;
}

/**
 * Returns animation props that respect the user's reduced motion preference.
 * When reduced motion is enabled, initial and exit states match the animate
 * state and the transition duration is zero for an instant appearance.
 */
export function getReducedMotionProps(animation: MotionAnimation, prefersReducedMotion: boolean): MotionAnimation {
	if (!prefersReducedMotion) {
		return animation;
	}
	return {
		initial: animation.animate,
		animate: animation.animate,
		exit: animation.animate,
		transition: {duration: 0},
	};
}

export const TOOLTIP_MOTION: MotionAnimation = {
	initial: {opacity: 0, scale: 0.98},
	animate: {opacity: 1, scale: 1},
	exit: {opacity: 0, scale: 0.98},
	transition: {
		opacity: {duration: 0.1},
		scale: {type: 'spring', damping: 25, stiffness: 500},
	},
};

export const FADE_MOTION: MotionAnimation = {
	initial: {opacity: 0},
	animate: {opacity: 1},
	exit: {opacity: 0},
	transition: {duration: 0.2},
};
