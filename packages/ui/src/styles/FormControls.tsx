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

import {cn} from '@fluxer/ui/src/utils/ClassNames';

const FORM_CONTROL_BASE_CLASS =
	'w-full rounded-lg border border-neutral-300 bg-white text-neutral-900 text-sm transition-all placeholder:text-neutral-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:opacity-50';

export const FORM_FIELD_CLASS = 'flex flex-col gap-2';
export const FORM_LABEL_CLASS = 'font-semibold text-neutral-500 text-xs uppercase tracking-wide';
export const FORM_HELPER_CLASS = 'text-neutral-500 text-xs';
export const FORM_CONTROL_INPUT_CLASS = cn(FORM_CONTROL_BASE_CLASS, 'h-8 px-3 py-1.5');
export const FORM_CONTROL_TEXTAREA_CLASS = cn(FORM_CONTROL_BASE_CLASS, 'px-3 py-2');
export const FORM_CONTROL_SELECT_CLASS = cn(FORM_CONTROL_BASE_CLASS, 'h-8 appearance-none px-3 py-1.5 pr-10');
export const FORM_SELECT_ICON_CLASS =
	'pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-neutral-500';
