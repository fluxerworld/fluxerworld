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

import {ComponentDispatch} from '@app/lib/ComponentDispatch';
import {Logger} from '@app/lib/Logger';
import {ChannelRecord} from '@app/records/ChannelRecord';
import {UserRecord} from '@app/records/UserRecord';
import DeveloperOptionsStore, {type DeveloperOptionsState} from '@app/stores/DeveloperOptionsStore';
import MockIncomingCallStore from '@app/stores/MockIncomingCallStore';
import UserStore from '@app/stores/UserStore';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import type {Channel} from '@fluxer/schema/src/domains/channel/ChannelSchemas';
import type {UserPartial} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {generateSnowflake} from '@fluxer/snowflake/src/Snowflake';

const logger = new Logger('DeveloperOptions');

export function updateOption<K extends keyof DeveloperOptionsState>(key: K, value: DeveloperOptionsState[K]): void {
	logger.debug(`Updating developer option: ${String(key)} = ${value}`);
	DeveloperOptionsStore.updateOption(key, value);
}

export function setAttachmentMock(
	attachmentId: string,
	mock: DeveloperOptionsState['mockAttachmentStates'][string] | null,
): void {
	const next = {...DeveloperOptionsStore.mockAttachmentStates};
	if (mock === null) {
		delete next[attachmentId];
	} else {
		next[attachmentId] = mock;
	}
	updateOption('mockAttachmentStates', next);
	ComponentDispatch.dispatch('LAYOUT_RESIZED');
}

export function clearAllAttachmentMocks(): void {
	updateOption('mockAttachmentStates', {});
	ComponentDispatch.dispatch('LAYOUT_RESIZED');
}

export function triggerMockIncomingCall(): void {
	const currentUser = UserStore.getCurrentUser();
	if (!currentUser) {
		logger.warn('Cannot trigger mock incoming call: No current user');
		return;
	}

	const mockChannelId = generateSnowflake().toString();

	const initiatorPartial: UserPartial = {
		id: currentUser.id,
		username: currentUser.username,
		discriminator: currentUser.discriminator,
		global_name: currentUser.globalName,
		avatar: currentUser.avatar ?? null,
		avatar_color: currentUser.avatarColor ?? null,
		flags: currentUser.flags ?? 0,
	};

	const channelData: Channel = {
		id: mockChannelId,
		type: ChannelTypes.DM,
		recipients: [initiatorPartial],
	};

	const channelRecord = new ChannelRecord(channelData);
	const initiatorRecord = new UserRecord(initiatorPartial);

	MockIncomingCallStore.setMockCall({
		channel: channelRecord,
		initiator: initiatorRecord,
	});

	logger.info(`Triggered mock incoming call from user ${currentUser.username}`);
}
