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

import type {MessageRecord} from '@app/records/MessageRecord';
import AccessibilityStore, {MediaDimensionSize} from '@app/stores/AccessibilityStore';
import type {MediaDimensions} from '@app/types/BrandedTypes';
import {MessageFlags} from '@fluxer/constants/src/ChannelConstants';

interface MediaDimensionConstraints extends MediaDimensions {}

const DIMENSION_PRESETS = {
	SMALL: {
		maxWidth: 400,
		maxHeight: 300,
	},
	LARGE: {
		maxWidth: 550,
		maxHeight: 400,
	},
} as const;

export function getAttachmentMediaDimensions(message?: MessageRecord): MediaDimensionConstraints {
	if (message && (message.flags & MessageFlags.COMPACT_ATTACHMENTS) !== 0) {
		return DIMENSION_PRESETS.SMALL;
	}

	const size = AccessibilityStore.attachmentMediaDimensionSize;
	return size === MediaDimensionSize.SMALL ? DIMENSION_PRESETS.SMALL : DIMENSION_PRESETS.LARGE;
}

export function getEmbedMediaDimensions(): MediaDimensionConstraints {
	const size = AccessibilityStore.embedMediaDimensionSize;
	return size === MediaDimensionSize.SMALL ? DIMENSION_PRESETS.SMALL : DIMENSION_PRESETS.LARGE;
}

export function getMosaicMediaDimensions(message?: MessageRecord): MediaDimensionConstraints {
	return getAttachmentMediaDimensions(message);
}
