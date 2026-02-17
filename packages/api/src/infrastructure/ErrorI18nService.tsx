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

import {ErrorCodeToI18nKey} from '@fluxer/errors/src/i18n/ErrorCodeMappings';
import {getErrorMessage} from '@fluxer/errors/src/i18n/ErrorI18n';

export class ErrorI18nService {
	getMessage(
		code: string,
		locale: string | null | undefined,
		variables?: Record<string, unknown>,
		fallbackMessage?: string,
	): string {
		const i18nKey = ErrorCodeToI18nKey[code as keyof typeof ErrorCodeToI18nKey] ?? code;
		return getErrorMessage(i18nKey, locale, variables, fallbackMessage);
	}
}
