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

import {canViewStreamPreview} from '@app/utils/StreamPreviewPermissionUtils';
import {describe, expect, it, vi} from 'vitest';

describe('canViewStreamPreview', () => {
	it('allows stream preview for DM contexts without CONNECT permission checks', () => {
		const hasConnectPermission = vi.fn(() => false);

		expect(canViewStreamPreview({guildId: null, channelId: '123', hasConnectPermission})).toBe(true);
		expect(hasConnectPermission).not.toHaveBeenCalled();
	});

	it('allows stream preview when channel id is unavailable', () => {
		const hasConnectPermission = vi.fn(() => false);

		expect(canViewStreamPreview({guildId: '123', channelId: null, hasConnectPermission})).toBe(true);
		expect(hasConnectPermission).not.toHaveBeenCalled();
	});

	it('requires CONNECT permission for guild stream previews', () => {
		const hasConnectPermission = vi.fn(() => false);

		expect(canViewStreamPreview({guildId: '123', channelId: '456', hasConnectPermission})).toBe(false);
		expect(hasConnectPermission).toHaveBeenCalledTimes(1);
	});

	it('allows guild stream preview when CONNECT permission is granted', () => {
		const hasConnectPermission = vi.fn(() => true);

		expect(canViewStreamPreview({guildId: '123', channelId: '456', hasConnectPermission})).toBe(true);
		expect(hasConnectPermission).toHaveBeenCalledTimes(1);
	});
});
