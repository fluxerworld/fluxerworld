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

import * as AccessibilityActionCreators from '@app/actions/AccessibilityActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {ThemeAcceptModal} from '@app/components/modals/ThemeAcceptModal';
import {Logger} from '@app/lib/Logger';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';

const logger = new Logger('Themes');

export function applyTheme(css: string, i18n: I18n): void {
	try {
		AccessibilityActionCreators.update({customThemeCss: css});
		ToastActionCreators.success(i18n._(msg`Imported theme has been applied.`));
	} catch (error) {
		logger.error('Failed to apply theme:', error);
		ToastActionCreators.error(i18n._(msg`We couldn't apply this theme.`));
		throw error;
	}
}

export function openAcceptModal(themeId: string | undefined, i18n: I18n): void {
	if (!themeId) {
		ToastActionCreators.error(i18n._(msg`This theme link is missing data.`));
		return;
	}

	ModalActionCreators.pushWithKey(
		modal(() => <ThemeAcceptModal themeId={themeId} />),
		`theme-accept-${themeId}`,
	);
}
