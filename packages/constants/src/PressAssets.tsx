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

import type {ValueOf} from '@fluxer/constants/src/ValueOf';

export const PressAssetIds = {
	LOGO_WHITE: 'logo-white',
	LOGO_BLACK: 'logo-black',
	LOGO_COLOR: 'logo-color',
	SYMBOL_WHITE: 'symbol-white',
	SYMBOL_BLACK: 'symbol-black',
	SYMBOL_COLOR: 'symbol-color',
} as const;

export type PressAssetId = ValueOf<typeof PressAssetIds>;

export interface PressAssetDefinition {
	id: PressAssetId;
	path: string;
	filename: string;
}

export const PressAssets: Record<PressAssetId, PressAssetDefinition> = {
	[PressAssetIds.LOGO_WHITE]: {
		id: PressAssetIds.LOGO_WHITE,
		path: '/marketing/branding/logo-white.svg',
		filename: 'fluxer-logo-white.svg',
	},
	[PressAssetIds.LOGO_BLACK]: {
		id: PressAssetIds.LOGO_BLACK,
		path: '/marketing/branding/logo-black.svg',
		filename: 'fluxer-logo-black.svg',
	},
	[PressAssetIds.LOGO_COLOR]: {
		id: PressAssetIds.LOGO_COLOR,
		path: '/marketing/branding/logo-color.svg',
		filename: 'fluxer-logo-color.svg',
	},
	[PressAssetIds.SYMBOL_WHITE]: {
		id: PressAssetIds.SYMBOL_WHITE,
		path: '/marketing/branding/symbol-white.svg',
		filename: 'fluxer-symbol-white.svg',
	},
	[PressAssetIds.SYMBOL_BLACK]: {
		id: PressAssetIds.SYMBOL_BLACK,
		path: '/marketing/branding/symbol-black.svg',
		filename: 'fluxer-symbol-black.svg',
	},
	[PressAssetIds.SYMBOL_COLOR]: {
		id: PressAssetIds.SYMBOL_COLOR,
		path: '/marketing/branding/symbol-color.svg',
		filename: 'fluxer-symbol-color.svg',
	},
};

export function isPressAssetId(value: string): value is PressAssetId {
	return Object.hasOwn(PressAssets, value);
}
