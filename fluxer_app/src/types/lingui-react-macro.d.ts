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

import type {I18n} from '@lingui/core';
import type {MacroMessageDescriptor} from '@lingui/core/macro';
import type {I18nContext} from '@lingui/react';

declare module '@lingui/react/macro' {
	type LinguiMacroTagFunction = {
		(descriptor: MacroMessageDescriptor): string;
		(literals: TemplateStringsArray, ...placeholders: Array<any>): string;
	};

	type LinguiMacro = LinguiMacroTagFunction & ((i18n: I18n) => LinguiMacroTagFunction);

	export function useLingui(): Omit<I18nContext, '_'> & {
		t: LinguiMacro;
	};
}
