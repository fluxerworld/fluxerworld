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

import React, {useContext} from 'react';

export type LayoutVariant = 'app' | 'auth' | 'call';

interface LayoutVariantContextValue {
	variant: LayoutVariant;
	setVariant: (variant: LayoutVariant) => void;
}

const defaultValue: LayoutVariantContextValue = {
	variant: 'app',
	setVariant: () => {},
};

const LayoutVariantContext = React.createContext<LayoutVariantContextValue>(defaultValue);

export const LayoutVariantProvider = LayoutVariantContext.Provider;

export const useLayoutVariant = () => useContext(LayoutVariantContext).variant;

export const useSetLayoutVariant = () => useContext(LayoutVariantContext).setVariant;
