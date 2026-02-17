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

import type {Child} from 'hono/jsx';

export type LayoutGap = '0' | '1' | '1.5' | '2' | '3' | '4' | '5' | '6' | 'sm' | 'md' | 'lg';
export type LayoutColumns = '1' | '2' | '3' | '4' | 1 | 2 | 3 | 4;

export interface ChildrenProps {
	children?: Child;
}

export interface GapProps {
	gap?: LayoutGap;
}

export interface GridProps extends GapProps {
	cols?: LayoutColumns;
}

export interface InfoItemProps {
	label: string;
	value?: string | null;
}

export interface LabelProps {
	label: string;
}

export interface MutedProps {
	muted?: boolean;
}

export interface TextProps {
	text: string;
}

export interface BaseFormProps {
	name: string;
	id?: string;
	label?: string;
	helper?: string;
	required?: boolean;
	placeholder?: string;
	disabled?: boolean;
}

export interface SelectOption {
	value: string;
	label: string;
}

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'info' | 'ghost' | 'brand';

export type ButtonSize = 'small' | 'medium' | 'large' | 'xl';
export type ButtonIconPosition = 'left' | 'right';

export type CardPadding = 'none' | 'small' | 'medium' | 'large' | 'xl';
export type CardVariant = 'default' | 'elevated' | 'empty' | 'marketing';
export type CardShadow = 'none' | 'sm' | 'md' | 'lg' | 'xl';
