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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import {Trans} from '@lingui/react/macro';

interface ShowAnimatedAvifConfirmModalOptions {
	onConfirm: () => void;
	i18n: I18n;
}

export function showAnimatedAvifConfirmModal({onConfirm, i18n}: ShowAnimatedAvifConfirmModalOptions): void {
	ModalActionCreators.push(
		modal(() => (
			<ConfirmModal
				title={i18n._(msg`Animated AVIF Not Supported`)}
				description={
					<Trans>
						Cropping and rotating animated AVIF files isn't supported yet. If you proceed with uploading this file, it
						will be uploaded in its original form without any modifications.
					</Trans>
				}
				primaryText={i18n._(msg`Upload As-Is`)}
				primaryVariant="primary"
				secondaryText={i18n._(msg`Cancel`)}
				onPrimary={onConfirm}
			/>
		)),
	);
}
