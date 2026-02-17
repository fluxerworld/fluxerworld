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

import * as CallActionCreators from '@app/actions/CallActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {ChannelHeaderIcon} from '@app/components/channel/channel_header_components/ChannelHeaderIcon';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import CallStateStore from '@app/stores/CallStateStore';
import UserStore from '@app/stores/UserStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import * as CallUtils from '@app/utils/CallUtils';
import {isSystemDmChannel} from '@app/utils/ChannelUtils';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {PhoneIcon, VideoCameraIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback} from 'react';

const VoiceCallButton = observer(({channel}: {channel: ChannelRecord}) => {
	const {t} = useLingui();
	const call = CallStateStore.getCall(channel.id);
	const isConnected = MediaEngineStore.connected;
	const connectedChannelId = MediaEngineStore.channelId;
	const isInCall = isConnected && connectedChannelId === channel.id;
	const hasActiveCall = CallStateStore.hasActiveCall(channel.id);
	const participants = call ? CallStateStore.getParticipants(channel.id) : [];
	const participantCount = participants.length;
	const currentUser = UserStore.getCurrentUser();
	const isUnclaimed = !(currentUser?.isClaimed() ?? false);
	const is1to1 = channel.type === ChannelTypes.DM;
	const systemDmBlock = isSystemDmChannel(channel);
	const unclaimedBlock = isUnclaimed && is1to1;
	const blocked = systemDmBlock || unclaimedBlock;

	const handleClick = useCallback(
		async (event: React.MouseEvent) => {
			if (systemDmBlock) {
				ToastActionCreators.createToast({
					type: 'error',
					children: t`System DMs cannot host voice calls.`,
				});
				return;
			}

			if (unclaimedBlock) {
				ToastActionCreators.createToast({
					type: 'error',
					children: t`Claim your account to start or join 1:1 calls.`,
				});
				return;
			}

			if (isInCall) {
				void CallActionCreators.leaveCall(channel.id);
			} else if (hasActiveCall) {
				CallActionCreators.joinCall(channel.id);
			} else {
				const silent = event.shiftKey;
				await CallUtils.checkAndStartCall(channel.id, silent);
			}
		},
		[channel.id, hasActiveCall, isInCall, systemDmBlock, unclaimedBlock],
	);

	let label: string;
	if (systemDmBlock) {
		label = t`System DMs cannot host voice calls`;
	} else if (participantCount > 0 && hasActiveCall) {
		if (isInCall) {
			label = t`Leave Voice Call`;
		} else {
			label = t`Join Voice Call`;
		}
	} else {
		label = blocked
			? t`Claim your account to call`
			: isInCall
				? t`Leave Voice Call`
				: hasActiveCall
					? t`Join Voice Call`
					: t`Start Voice Call`;
	}

	return (
		<ChannelHeaderIcon
			icon={PhoneIcon}
			label={label}
			isSelected={isInCall}
			onClick={handleClick}
			disabled={blocked}
			keybindAction="start_pm_call"
		/>
	);
});

const VideoCallButton = observer(({channel}: {channel: ChannelRecord}) => {
	const {t} = useLingui();
	const call = CallStateStore.getCall(channel.id);
	const isConnected = MediaEngineStore.connected;
	const connectedChannelId = MediaEngineStore.channelId;
	const isInCall = isConnected && connectedChannelId === channel.id;
	const hasActiveCall = CallStateStore.hasActiveCall(channel.id);
	const participants = call ? CallStateStore.getParticipants(channel.id) : [];
	const participantCount = participants.length;
	const currentUser = UserStore.getCurrentUser();
	const isUnclaimed = !(currentUser?.isClaimed() ?? false);
	const is1to1 = channel.type === ChannelTypes.DM;
	const systemDmBlock = isSystemDmChannel(channel);
	const unclaimedBlock = isUnclaimed && is1to1;
	const blocked = systemDmBlock || unclaimedBlock;

	const handleClick = useCallback(
		async (event: React.MouseEvent) => {
			if (systemDmBlock) {
				ToastActionCreators.createToast({
					type: 'error',
					children: t`System DMs cannot host video calls.`,
				});
				return;
			}

			if (unclaimedBlock) {
				ToastActionCreators.createToast({
					type: 'error',
					children: t`Claim your account to start or join 1:1 calls.`,
				});
				return;
			}

			if (isInCall) {
				void CallActionCreators.leaveCall(channel.id);
			} else if (hasActiveCall) {
				CallActionCreators.joinCall(channel.id);
			} else {
				const silent = event.shiftKey;
				await CallUtils.checkAndStartCall(channel.id, silent);
			}
		},
		[channel.id, hasActiveCall, isInCall, systemDmBlock, unclaimedBlock],
	);

	let label: string;
	if (systemDmBlock) {
		label = t`System DMs cannot host video calls`;
	} else if (participantCount > 0 && hasActiveCall) {
		if (isInCall) {
			label =
				participantCount === 1
					? t`Leave Video Call (${participantCount} participant)`
					: t`Leave Video Call (${participantCount} participants)`;
		} else {
			label =
				participantCount === 1
					? t`Join Video Call (${participantCount} participant)`
					: t`Join Video Call (${participantCount} participants)`;
		}
	} else {
		label = blocked
			? t`Claim your account to call`
			: isInCall
				? t`Leave Video Call`
				: hasActiveCall
					? t`Join Video Call`
					: t`Start Video Call`;
	}

	return (
		<ChannelHeaderIcon
			icon={VideoCameraIcon}
			label={label}
			isSelected={isInCall}
			onClick={handleClick}
			disabled={blocked}
		/>
	);
});

export const CallButtons = {
	VoiceCallButton,
	VideoCallButton,
};
