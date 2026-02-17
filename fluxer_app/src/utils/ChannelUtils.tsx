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

import {NSFWIcon} from '@app/components/icons/NSFWIcon';
import i18n from '@app/I18n';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import ChannelDisplayNameStore from '@app/stores/ChannelDisplayNameStore';
import UserStore from '@app/stores/UserStore';
import {compareChannelPosition} from '@app/utils/ChannelShared';
import * as NicknameUtils from '@app/utils/NicknameUtils';
import {FLUXERBOT_ID} from '@fluxer/constants/src/AppConstants';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {msg} from '@lingui/core/macro';
import {
	CaretDownIcon,
	HashIcon,
	type IconProps,
	LinkIcon,
	NotePencilIcon,
	SpeakerHighIcon,
} from '@phosphor-icons/react';

export function compareChannels(a: ChannelRecord, b: ChannelRecord): number {
	return compareChannelPosition(a, b);
}

export function getIcon(channel: {type: number; nsfw?: boolean}, props: IconProps = {}) {
	if (channel.type === ChannelTypes.GUILD_TEXT && channel.nsfw) {
		return <NSFWIcon {...props} />;
	}

	switch (channel.type) {
		case ChannelTypes.GUILD_VOICE:
			return <SpeakerHighIcon weight="fill" {...props} />;
		case ChannelTypes.GUILD_CATEGORY:
			return <CaretDownIcon weight="bold" {...props} />;
		case ChannelTypes.GUILD_LINK:
			return <LinkIcon weight="bold" {...props} />;
		case ChannelTypes.DM_PERSONAL_NOTES:
			return <NotePencilIcon weight="bold" {...props} />;
		default:
			return <HashIcon weight="bold" {...props} />;
	}
}

export function getName(channel: ChannelRecord) {
	let baseName: string;
	switch (channel.type) {
		case ChannelTypes.GUILD_VOICE:
			baseName = i18n._(msg`Voice`);
			break;
		case ChannelTypes.GUILD_CATEGORY:
			baseName = i18n._(msg`Category`);
			break;
		case ChannelTypes.GUILD_LINK:
			baseName = i18n._(msg`Link`);
			break;
		default:
			baseName = i18n._(msg`Text`);
			break;
	}

	if (channel.type === ChannelTypes.GUILD_TEXT && channel.nsfw) {
		return i18n._(msg`Text (NSFW)`);
	}

	return baseName;
}

const getDirectMessageDisplayName = (channel: ChannelRecord): string => {
	if (channel.recipientIds.length === 0) {
		return i18n._(msg`Unknown User`);
	}

	const recipient = UserStore.getUser(channel.recipientIds[0]);
	const nickname = recipient ? NicknameUtils.getNickname(recipient) : null;
	return nickname ?? i18n._(msg`Unknown User`);
};

const getGroupDMDisplayName = (channel: ChannelRecord): string => {
	const customName = channel.name?.trim() ?? '';
	if (customName.length > 0) {
		return customName;
	}

	return ChannelDisplayNameStore.getDisplayName(channel.id) ?? i18n._(msg`Unnamed Group`);
};

export function getDMDisplayName(channel: ChannelRecord): string {
	switch (channel.type) {
		case ChannelTypes.DM_PERSONAL_NOTES:
			return i18n._(msg`Personal Notes`);
		case ChannelTypes.DM:
			return getDirectMessageDisplayName(channel);
		case ChannelTypes.GROUP_DM:
			return getGroupDMDisplayName(channel);
		default:
			return channel.name || i18n._(msg`Unknown Channel`);
	}
}

export function isSystemDmChannel(channel: ChannelRecord): boolean {
	return channel.type === ChannelTypes.DM && channel.recipientIds.includes(FLUXERBOT_ID);
}
