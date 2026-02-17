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

import * as GuildMemberActionCreators from '@app/actions/GuildMemberActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as PrivateChannelActionCreators from '@app/actions/PrivateChannelActionCreators';
import * as SoundActionCreators from '@app/actions/SoundActionCreators';
import * as TextCopyActionCreators from '@app/actions/TextCopyActionCreators';
import * as UserProfileActionCreators from '@app/actions/UserProfileActionCreators';
import * as VoiceCallLayoutActionCreators from '@app/actions/VoiceCallLayoutActionCreators';
import * as VoiceSettingsActionCreators from '@app/actions/VoiceSettingsActionCreators';
import * as VoiceStateActionCreators from '@app/actions/VoiceStateActionCreators';
import {UserDebugModal} from '@app/components/debug/UserDebugModal';
import {BanMemberModal} from '@app/components/modals/BanMemberModal';
import {ChangeFriendNicknameModal} from '@app/components/modals/ChangeFriendNicknameModal';
import {ChangeNicknameModal} from '@app/components/modals/ChangeNicknameModal';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {HideOwnCameraConfirmModal} from '@app/components/modals/HideOwnCameraConfirmModal';
import {HideOwnScreenShareConfirmModal} from '@app/components/modals/HideOwnScreenShareConfirmModal';
import {KickMemberModal} from '@app/components/modals/KickMemberModal';
import {RemoveTimeoutModal} from '@app/components/modals/RemoveTimeoutModal';
import {TimeoutMemberModal} from '@app/components/modals/TimeoutMemberModal';
import {UserSettingsModal} from '@app/components/modals/UserSettingsModal';
import {
	AcceptFriendRequestIcon,
	AddNoteIcon,
	BanMemberIcon,
	BlockUserIcon,
	BulkTurnOffCameraIcon,
	ChangeNicknameIcon,
	CopyIdIcon,
	DebugIcon,
	DisconnectIcon,
	FocusIcon,
	GuildDeafenIcon,
	GuildMuteIcon,
	IgnoreFriendRequestIcon,
	KickMemberIcon,
	LocalDisableVideoIcon,
	LocalMuteIcon,
	MentionUserIcon,
	MessageUserIcon,
	RemoveFriendIcon,
	SelfDeafenIcon,
	SelfMuteIcon,
	SendFriendRequestIcon,
	SettingsIcon,
	TimeoutIcon,
	TurnOffCameraIcon,
	TurnOffStreamIcon,
	UnfocusIcon,
	ViewProfileIcon,
	VoiceCallIcon,
} from '@app/components/uikit/context_menu/ContextMenuIcons';
import type {
	MenuCheckboxType,
	MenuGroupType,
	MenuItemType,
	MenuSliderType,
	MenuSubmenuItemType,
} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import {useRoleHierarchy} from '@app/hooks/useRoleHierarchy';
import {ComponentDispatch} from '@app/lib/ComponentDispatch';
import {Logger} from '@app/lib/Logger';
import type {GuildMemberRecord} from '@app/records/GuildMemberRecord';
import type {UserRecord} from '@app/records/UserRecord';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import CallMediaPrefsStore from '@app/stores/CallMediaPrefsStore';
import ChannelStore from '@app/stores/ChannelStore';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import GuildStore from '@app/stores/GuildStore';
import ParticipantVolumeStore from '@app/stores/ParticipantVolumeStore';
import PermissionStore from '@app/stores/PermissionStore';
import RelationshipStore from '@app/stores/RelationshipStore';
import SelectedChannelStore from '@app/stores/SelectedChannelStore';
import StreamAudioPrefsStore from '@app/stores/StreamAudioPrefsStore';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import VoiceCallLayoutStore from '@app/stores/VoiceCallLayoutStore';
import VoicePromptsStore from '@app/stores/VoicePromptsStore';
import VoiceSettingsStore from '@app/stores/VoiceSettingsStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import type {VoiceState} from '@app/types/gateway/GatewayVoiceTypes';
import * as PermissionUtils from '@app/utils/PermissionUtils';
import * as RelationshipActionUtils from '@app/utils/RelationshipActionUtils';
import {SoundType} from '@app/utils/SoundUtils';
import {ChannelTypes, Permissions, TEXT_BASED_CHANNEL_TYPES} from '@fluxer/constants/src/ChannelConstants';
import {RelationshipTypes} from '@fluxer/constants/src/UserConstants';
import {useLingui} from '@lingui/react/macro';
import {Track} from 'livekit-client';
import {useCallback, useMemo} from 'react';

const logger = new Logger('VoiceParticipantMenuData');

export interface VoiceParticipantMenuDataOptions {
	user: UserRecord;
	guildId?: string;
	connectionId?: string;
	isGroupedItem?: boolean;
	isParentGroupedItem?: boolean;
	streamKey?: string;
	isScreenShare?: boolean;
	isWatching?: boolean;
	hasScreenShareAudio?: boolean;
	isOwnScreenShare?: boolean;
	onStopWatching?: () => void;
	onClose: () => void;
}

export interface VoiceParticipantMenuData {
	groups: Array<MenuGroupType>;
	member: GuildMemberRecord | null;
	isCurrentUser: boolean;
	developerMode: boolean;
	relationshipType: number | undefined;
	canMoveMembers: boolean;
	userVoiceStates: Array<{connectionId: string; voiceState: VoiceState}>;
	hasMultipleConnections: boolean;
	voiceChannels: Array<{id: string; name: string}>;
	hasVoiceChannels: boolean;
}

export function useVoiceParticipantMenuData(options: VoiceParticipantMenuDataOptions): VoiceParticipantMenuData {
	const {
		user,
		guildId,
		connectionId,
		isGroupedItem = false,
		isParentGroupedItem = false,
		streamKey,
		isScreenShare = false,
		isWatching = false,
		hasScreenShareAudio = false,
		isOwnScreenShare = false,
		onStopWatching,
		onClose,
	} = options;
	const {t, i18n} = useLingui();

	const member = GuildMemberStore.getMember(guildId ?? '', user.id);
	const isCurrentUser = user.id === AuthenticationStore.currentUserId;
	const developerMode = UserSettingsStore.developerMode;
	const relationship = RelationshipStore.getRelationship(user.id);
	const relationshipType = relationship?.type;
	const isBlocked = relationshipType === RelationshipTypes.BLOCKED;

	const canMuteMembers = guildId ? PermissionStore.can(Permissions.MUTE_MEMBERS, {guildId}) : false;
	const canMoveMembers = guildId ? PermissionStore.can(Permissions.MOVE_MEMBERS, {guildId}) : false;
	const canKickMembers = guildId ? PermissionStore.can(Permissions.KICK_MEMBERS, {guildId}) : false;
	const canBanMembers = guildId ? PermissionStore.can(Permissions.BAN_MEMBERS, {guildId}) : false;
	const canModerateMembers = guildId ? PermissionStore.can(Permissions.MODERATE_MEMBERS, {guildId}) : false;

	const guild = guildId ? GuildStore.getGuild(guildId) : null;
	const {canManageTarget} = useRoleHierarchy(guild);
	const canModerateTarget = !isCurrentUser && canManageTarget(user.id);

	const guildSnapshot = guild?.toJSON();
	const targetHasModerateMembersPermission =
		guildSnapshot !== undefined && PermissionUtils.can(Permissions.MODERATE_MEMBERS, user.id, guildSnapshot);

	const canKickTarget = canModerateTarget && canKickMembers;
	const canBanTarget = canModerateTarget && canBanMembers;
	const canTimeoutTarget = canModerateTarget && canModerateMembers && !targetHasModerateMembersPermission;

	const focusedChannelId = SelectedChannelStore.currentChannelId;
	const focusedChannel = focusedChannelId ? ChannelStore.getChannel(focusedChannelId) : null;
	const isFocusedChannelTextBased = focusedChannel ? TEXT_BASED_CHANNEL_TYPES.has(focusedChannel.type) : false;
	const canMention =
		isFocusedChannelTextBased &&
		focusedChannelId &&
		PermissionStore.can(Permissions.SEND_MESSAGES, {guildId: focusedChannel?.guildId, channelId: focusedChannelId});

	const openDmChannel = useCallback(async () => {
		try {
			await PrivateChannelActionCreators.openDMChannel(user.id);
		} catch (error) {
			logger.error('Failed to open DM channel:', error);
		}
	}, [user.id]);

	const handleMessage = useCallback(async () => {
		onClose();
		await openDmChannel();
	}, [onClose, openDmChannel]);

	const handleOpenBlockedDm = useCallback(() => {
		onClose();
		ModalActionCreators.push(
			modal(() => (
				<ConfirmModal
					title={t`Open DM`}
					description={t`You blocked ${user.username}. You won't be able to send messages unless you unblock them.`}
					primaryText={t`Open DM`}
					primaryVariant="primary"
					onPrimary={openDmChannel}
				/>
			)),
		);
	}, [onClose, openDmChannel, t, user.username]);

	const currentUserVoiceStateInGuild = guildId ? MediaEngineStore.getCurrentUserVoiceState(guildId) : null;
	const isCurrentUserConnectedToVoice = currentUserVoiceStateInGuild !== null;

	const connectionVoiceState = connectionId ? MediaEngineStore.getVoiceStateByConnectionId(connectionId) : null;
	const currentUserVoiceState = MediaEngineStore.getCurrentUserVoiceState();
	const currentConnectionId = MediaEngineStore.connectionId;
	const currentConnectionVoiceState = currentConnectionId
		? MediaEngineStore.getVoiceStateByConnectionId(currentConnectionId)
		: null;

	const showMyOwnCamera = VoiceSettingsStore.showMyOwnCamera;
	const showMyOwnScreenShare = VoiceSettingsStore.showMyOwnScreenShare;
	const showNonVideoParticipants = VoiceSettingsStore.showNonVideoParticipants;

	const participantVolume = ParticipantVolumeStore.getVolume(user.id);
	const streamVolume = streamKey ? StreamAudioPrefsStore.getVolume(streamKey) : 100;
	const isStreamMuted = streamKey ? StreamAudioPrefsStore.isMuted(streamKey) : false;

	const callId = MediaEngineStore.connectionId ?? '';
	const participantIdentity = connectionId ? `user_${user.id}_${connectionId}` : '';
	const isFocusedScreenShareTile =
		isScreenShare &&
		participantIdentity !== '' &&
		VoiceCallLayoutStore.pinnedParticipantIdentity === participantIdentity &&
		VoiceCallLayoutStore.pinnedParticipantSource === Track.Source.ScreenShare;
	const isVideoDisabled =
		callId && participantIdentity ? CallMediaPrefsStore.isVideoDisabled(callId, participantIdentity) : false;

	const allVoiceStates = MediaEngineStore.getAllVoiceStates();

	const userVoiceStates = useMemo(() => {
		if (!guildId) return [] as Array<{connectionId: string; voiceState: VoiceState}>;
		const acc: Array<{connectionId: string; voiceState: VoiceState}> = [];
		Object.entries(allVoiceStates).forEach(([g, guildData]) => {
			if (g === guildId) {
				Object.entries(guildData).forEach(([, channelData]) => {
					Object.entries(channelData).forEach(([cid, vs]) => {
						if (vs.user_id === user.id) acc.push({connectionId: cid, voiceState: vs});
					});
				});
			}
		});
		return acc;
	}, [guildId, user.id, allVoiceStates]);

	const hasMultipleConnections = userVoiceStates.length > 1;

	const userVoiceState = guildId ? MediaEngineStore.getVoiceState(guildId, user.id) : null;

	const voiceChannels = useMemo(() => {
		if (!guildId) return [];
		const channels = ChannelStore.getGuildChannels(guildId);
		return channels
			.filter((channel) => {
				if (channel.type !== ChannelTypes.GUILD_VOICE) return false;
				if (userVoiceState?.channel_id === channel.id) return false;
				return PermissionStore.can(Permissions.CONNECT, {guildId, channelId: channel.id});
			})
			.map((channel) => ({id: channel.id, name: channel.name ?? ''}));
	}, [guildId, userVoiceState?.channel_id]);

	const groups = useMemo(() => {
		const menuGroups: Array<MenuGroupType> = [];
		const createCopyDeviceIdAction = (targetConnectionId: string): MenuItemType => ({
			icon: <CopyIdIcon size={16} />,
			label: t`Copy Device ID`,
			onClick: () => {
				TextCopyActionCreators.copy(i18n, targetConnectionId, true).catch(() => {});
				onClose();
			},
		});

		const streamActions: Array<MenuItemType | MenuCheckboxType | MenuSliderType> = [];

		if (isScreenShare && !isOwnScreenShare && !isCurrentUser && streamKey) {
			if (isWatching && onStopWatching && isFocusedScreenShareTile) {
				streamActions.push({
					icon: <TurnOffStreamIcon size={16} />,
					label: t`Stop Watching`,
					onClick: () => {
						onStopWatching();
						onClose();
					},
				});
			}

			if (hasScreenShareAudio) {
				streamActions.push({
					label: t`Stream Volume`,
					value: streamVolume,
					minValue: 0,
					maxValue: 200,
					onChange: (value: number) => {
						StreamAudioPrefsStore.setVolume(streamKey, value);
						MediaEngineStore.applyLocalAudioPreferencesForUser(user.id);
					},
					onFormat: (value: number) => `${Math.round(value)}%`,
					factoryDefaultValue: 100,
				});

				streamActions.push({
					icon: <LocalMuteIcon size={16} />,
					label: t`Mute`,
					checked: isStreamMuted,
					onChange: (checked: boolean) => {
						StreamAudioPrefsStore.setMuted(streamKey, checked);
						MediaEngineStore.applyLocalAudioPreferencesForUser(user.id);
					},
				});
			}
		}

		if (streamActions.length > 0) {
			menuGroups.push({items: streamActions});
		}

		const profileActions: Array<MenuItemType> = [];

		profileActions.push({
			icon: <ViewProfileIcon size={16} />,
			label: t`View Profile`,
			onClick: () => {
				onClose();
				UserProfileActionCreators.openUserProfile(user.id, guildId);
			},
		});

		if (connectionId && guildId && isCurrentUserConnectedToVoice) {
			const identity = `user_${user.id}_${connectionId}`;
			const pinnedParticipantSource = VoiceCallLayoutStore.pinnedParticipantSource;
			const isFocused =
				VoiceCallLayoutStore.pinnedParticipantIdentity === identity &&
				(pinnedParticipantSource == null ||
					pinnedParticipantSource === (isScreenShare ? Track.Source.ScreenShare : Track.Source.Camera));
			const allStates = MediaEngineStore.getAllVoiceStates();
			let connectionCount = 0;
			Object.values(allStates).forEach((guildData) => {
				Object.values(guildData).forEach((channelData) => {
					Object.values(channelData).forEach((vs: VoiceState) => {
						if (vs.user_id === user.id) connectionCount++;
					});
				});
			});
			const hasMultipleConnectionsForFocus = connectionCount > 1;

			const focusLabel = (() => {
				if (isFocused) return t`Unfocus`;
				if (hasMultipleConnectionsForFocus) return t`Focus This Device`;
				return t`Focus This Person`;
			})();

			profileActions.push({
				icon: isFocused ? <UnfocusIcon size={16} /> : <FocusIcon size={16} />,
				label: focusLabel,
				onClick: () => {
					if (isFocused) {
						VoiceCallLayoutActionCreators.setPinnedParticipant(null);
						VoiceCallLayoutActionCreators.setLayoutMode('grid');
						VoiceCallLayoutActionCreators.markUserOverride();
					} else {
						VoiceCallLayoutActionCreators.setLayoutMode('focus');
						VoiceCallLayoutActionCreators.setPinnedParticipant(
							identity,
							isScreenShare ? Track.Source.ScreenShare : Track.Source.Camera,
						);
						VoiceCallLayoutActionCreators.markUserOverride();
					}
					onClose();
				},
			});
		}

		if (canMention) {
			profileActions.push({
				icon: <MentionUserIcon size={16} />,
				label: t`Mention`,
				onClick: () => {
					onClose();
					ComponentDispatch.dispatch('INSERT_MENTION', {userId: user.id});
				},
			});
		}

		if (!isCurrentUser) {
			profileActions.push({
				icon: <MessageUserIcon size={16} />,
				label: isBlocked ? t`Open DM` : t`Message`,
				onClick: isBlocked ? handleOpenBlockedDm : handleMessage,
			});
		}

		profileActions.push({
			icon: <AddNoteIcon size={16} />,
			label: t`Add Note`,
			onClick: () => {
				onClose();
				UserProfileActionCreators.openUserProfile(user.id, guildId, true);
			},
		});

		if (!isCurrentUser && relationshipType === RelationshipTypes.FRIEND) {
			profileActions.push({
				icon: <ChangeNicknameIcon size={16} />,
				label: t`Change Friend Nickname`,
				onClick: () => {
					onClose();
					ModalActionCreators.push(modal(() => <ChangeFriendNicknameModal user={user} />));
				},
			});
		}

		if (!isCurrentUser && !user.bot) {
			profileActions.push({
				icon: <VoiceCallIcon size={16} />,
				label: t`Start Voice Call`,
				onClick: async () => {
					onClose();
					try {
						await PrivateChannelActionCreators.ensureDMChannel(user.id);
						await PrivateChannelActionCreators.openDMChannel(user.id);
					} catch (error) {
						logger.error('Failed to start voice call:', error);
					}
				},
			});
		}

		if (profileActions.length > 0) {
			menuGroups.push({items: profileActions});
		}

		if (isCurrentUser) {
			const selfVoiceActions: Array<MenuItemType | MenuCheckboxType> = [];

			if (isGroupedItem && connectionId) {
				const isSelfMuted = connectionVoiceState?.self_mute ?? false;
				const isSelfDeafened = connectionVoiceState?.self_deaf ?? false;
				const isCameraOn = connectionVoiceState?.self_video ?? false;
				const isStreaming = connectionVoiceState?.self_stream ?? false;

				selfVoiceActions.push({
					icon: <SelfMuteIcon size={16} />,
					label: t`Mute Device`,
					checked: isSelfMuted,
					onChange: () => {
						VoiceStateActionCreators.toggleSelfMuteForConnection(connectionId);
					},
				});

				selfVoiceActions.push({
					icon: <SelfDeafenIcon size={16} />,
					label: t`Deafen Device`,
					checked: isSelfDeafened,
					onChange: () => {
						VoiceStateActionCreators.toggleSelfDeafenForConnection(connectionId);
					},
				});

				if (isCameraOn) {
					selfVoiceActions.push({
						icon: <TurnOffCameraIcon size={16} />,
						label: t`Turn Off Device Camera`,
						onClick: () => {
							VoiceStateActionCreators.turnOffCameraForConnection(connectionId);
							onClose();
						},
					});
				}

				if (isStreaming) {
					selfVoiceActions.push({
						icon: <TurnOffStreamIcon size={16} />,
						label: t`Turn Off Device Stream`,
						onClick: () => {
							VoiceStateActionCreators.turnOffStreamForConnection(connectionId);
							onClose();
						},
					});
				}

				selfVoiceActions.push(createCopyDeviceIdAction(connectionId));
			} else {
				const isSelfMuted = currentUserVoiceState?.self_mute ?? false;
				const isSelfDeafened = currentUserVoiceState?.self_deaf ?? false;
				const isCameraOn = currentConnectionVoiceState?.self_video ?? false;
				const isStreaming = currentConnectionVoiceState?.self_stream ?? false;

				selfVoiceActions.push({
					icon: <SelfMuteIcon size={16} />,
					label: t`Mute`,
					checked: isSelfMuted,
					onChange: () => {
						VoiceStateActionCreators.toggleSelfMute(null);
					},
				});

				selfVoiceActions.push({
					icon: <SelfDeafenIcon size={16} />,
					label: t`Deafen`,
					checked: isSelfDeafened,
					onChange: () => {
						VoiceStateActionCreators.toggleSelfDeaf(null);
					},
				});

				if (isCameraOn) {
					selfVoiceActions.push({
						icon: <TurnOffCameraIcon size={16} />,
						label: t`Turn Off Camera`,
						onClick: () => {
							if (currentConnectionId) {
								VoiceStateActionCreators.turnOffCameraForConnection(currentConnectionId);
							}
							onClose();
						},
					});
				}

				if (isStreaming) {
					selfVoiceActions.push({
						icon: <TurnOffStreamIcon size={16} />,
						label: t`Turn Off Stream`,
						onClick: () => {
							if (currentConnectionId) {
								VoiceStateActionCreators.turnOffStreamForConnection(currentConnectionId);
							}
							onClose();
						},
					});
				}

				selfVoiceActions.push({
					icon: <SettingsIcon size={16} />,
					label: t`Voice & Video Settings`,
					onClick: () => {
						onClose();
						ModalActionCreators.push(modal(() => <UserSettingsModal initialTab="voice_video" />));
					},
				});

				if (currentConnectionId) {
					selfVoiceActions.push(createCopyDeviceIdAction(currentConnectionId));
				}
			}

			if (guildId) {
				const cid = connectionId ?? MediaEngineStore.connectionId ?? null;
				const isCurrentDevice = !connectionId || connectionId === MediaEngineStore.connectionId;
				selfVoiceActions.push({
					icon: <DisconnectIcon size={16} />,
					label: isGroupedItem ? t`Disconnect Device` : t`Disconnect`,
					onClick: async () => {
						if (isCurrentDevice) {
							await MediaEngineStore.disconnectFromVoiceChannel('user');
						} else if (cid) {
							MediaEngineStore.disconnectRemoteDevice(guildId, cid);
						}
						onClose();
					},
					danger: true,
				});
			}

			if (selfVoiceActions.length > 0) {
				menuGroups.push({items: selfVoiceActions});
			}

			const displayPrefs: Array<MenuCheckboxType> = [
				{
					label: t`Show My Own Camera`,
					checked: showMyOwnCamera,
					onChange: (checked) => {
						if (!checked) {
							if (VoicePromptsStore.getSkipHideOwnCameraConfirm()) {
								VoiceSettingsActionCreators.update({showMyOwnCamera: false});
							} else {
								onClose();
								ModalActionCreators.push(modal(() => <HideOwnCameraConfirmModal />));
							}
						} else {
							VoiceSettingsActionCreators.update({showMyOwnCamera: true});
						}
					},
				},
				{
					label: t`Show My Screen Share`,
					checked: showMyOwnScreenShare,
					onChange: (checked) => {
						if (!checked) {
							if (VoicePromptsStore.getSkipHideOwnScreenShareConfirm()) {
								VoiceSettingsActionCreators.update({showMyOwnScreenShare: false});
							} else {
								onClose();
								ModalActionCreators.push(modal(() => <HideOwnScreenShareConfirmModal />));
							}
						} else {
							VoiceSettingsActionCreators.update({showMyOwnScreenShare: true});
						}
					},
				},
				{
					label: t`Show Non-Video Participants`,
					checked: showNonVideoParticipants,
					onChange: (checked) => VoiceSettingsActionCreators.update({showNonVideoParticipants: checked}),
				},
			];

			if (displayPrefs.length > 0) {
				menuGroups.push({items: displayPrefs});
			}
		} else {
			const otherUserActions: Array<MenuItemType | MenuCheckboxType | MenuSliderType | MenuSubmenuItemType> = [];

			if (isCurrentUserConnectedToVoice) {
				const volumeMenuItems: Array<MenuSliderType> = [
					{
						label: t`User Volume`,
						value: participantVolume,
						minValue: 0,
						maxValue: 200,
						onChange: (value: number) => {
							ParticipantVolumeStore.setVolume(user.id, value);
							MediaEngineStore.applyLocalAudioPreferencesForUser(user.id);
						},
						onFormat: (value: number) => `${Math.round(value)}%`,
						factoryDefaultValue: 100,
					},
				];
				if (connectionId) {
					volumeMenuItems.push({
						label: t`Connection Volume`,
						value: ParticipantVolumeStore.getConnectionVolume(connectionId),
						minValue: 0,
						maxValue: 200,
						onChange: (value: number) => {
							ParticipantVolumeStore.setConnectionVolume(connectionId, value);
							MediaEngineStore.applyLocalAudioPreferencesForUser(user.id);
						},
						onFormat: (value: number) => `${Math.round(value)}%`,
						factoryDefaultValue: 100,
					});
				}
				otherUserActions.push({
					label: t`Volume`,
					items: volumeMenuItems,
				});

				if (connectionId) {
					otherUserActions.push({
						icon: <LocalDisableVideoIcon size={16} />,
						label: t`Disable Video (Local)`,
						checked: isVideoDisabled,
						onChange: (checked: boolean) => {
							const activeCallId = MediaEngineStore.connectionId;
							if (!activeCallId) {
								const error = new Error('Cannot toggle local video without an active voice connection');
								logger.error('Voice participant menu action invoked without connection id', {
									participantIdentity,
									connectionId,
									callId,
								});
								throw error;
							}
							MediaEngineStore.setLocalVideoDisabled(participantIdentity, checked);
						},
					});
				}
			}

			if (connectionId) {
				otherUserActions.push(createCopyDeviceIdAction(connectionId));
			}

			if (otherUserActions.length > 0) {
				menuGroups.push({items: otherUserActions});
			}
		}

		if (isParentGroupedItem && hasMultipleConnections && guildId) {
			const bulkActions: Array<MenuItemType> = [];
			const connectionIds = userVoiceStates.map((u) => u.connectionId);

			if (isCurrentUser && isCurrentUserConnectedToVoice) {
				const allMuted = userVoiceStates.every(({voiceState}) => voiceState.self_mute);
				bulkActions.push({
					icon: <SelfMuteIcon size={16} />,
					label: allMuted ? t`Unmute All Devices` : t`Mute All Devices`,
					onClick: () => {
						const targetMute = !allMuted;
						VoiceStateActionCreators.bulkMuteConnections(connectionIds, targetMute);
						if (targetMute) SoundActionCreators.playSound(SoundType.Mute);
						else SoundActionCreators.playSound(SoundType.Unmute);
						onClose();
					},
				});

				const allDeafened = userVoiceStates.every(({voiceState}) => voiceState.self_deaf);
				bulkActions.push({
					icon: <SelfDeafenIcon size={16} />,
					label: allDeafened ? t`Undeafen All Devices` : t`Deafen All Devices`,
					onClick: () => {
						const targetDeafen = !allDeafened;
						VoiceStateActionCreators.bulkDeafenConnections(connectionIds, targetDeafen);
						if (targetDeafen) SoundActionCreators.playSound(SoundType.Deaf);
						else SoundActionCreators.playSound(SoundType.Undeaf);
						onClose();
					},
				});

				bulkActions.push({
					icon: <BulkTurnOffCameraIcon size={16} />,
					label: t`Turn Off All Device Cameras`,
					onClick: () => {
						VoiceStateActionCreators.bulkTurnOffCameras(connectionIds);
						onClose();
					},
				});

				bulkActions.push({
					icon: <DisconnectIcon size={16} />,
					label: t`Disconnect All Devices`,
					onClick: async () => {
						await VoiceStateActionCreators.bulkDisconnect(connectionIds);
						onClose();
					},
					danger: true,
				});
			} else if (!isCurrentUser && canMoveMembers) {
				bulkActions.push({
					icon: <DisconnectIcon size={16} />,
					label: t`Disconnect All Devices`,
					onClick: async () => {
						await VoiceStateActionCreators.bulkDisconnect(connectionIds);
						onClose();
					},
					danger: true,
				});
			}

			if (bulkActions.length > 0) {
				menuGroups.push({items: bulkActions});
			}
		}

		if (guildId && member) {
			const guildActions: Array<MenuItemType> = [];
			const hasChangeNicknamePermission = PermissionStore.can(Permissions.CHANGE_NICKNAME, {guildId});
			const hasManageNicknamesPermission = PermissionStore.can(Permissions.MANAGE_NICKNAMES, {guildId});
			const canManageNicknames =
				(isCurrentUser && hasChangeNicknamePermission) || (!isCurrentUser && hasManageNicknamesPermission);

			if (canManageNicknames) {
				guildActions.push({
					icon: <ChangeNicknameIcon size={16} />,
					label: t`Change Nickname`,
					onClick: () => {
						onClose();
						ModalActionCreators.push(
							modal(() => <ChangeNicknameModal guildId={guildId} user={user} member={member} />),
						);
					},
				});
			}

			if (guildActions.length > 0) {
				menuGroups.push({items: guildActions});
			}
		}

		if (!isCurrentUser) {
			const relationshipActions: Array<MenuItemType> = [];

			switch (relationshipType) {
				case RelationshipTypes.FRIEND:
					relationshipActions.push({
						icon: <RemoveFriendIcon size={16} />,
						label: t`Remove Friend`,
						onClick: () => {
							onClose();
							RelationshipActionUtils.showRemoveFriendConfirmation(i18n, user);
						},
					});
					break;
				case RelationshipTypes.INCOMING_REQUEST:
					relationshipActions.push({
						icon: <AcceptFriendRequestIcon size={16} />,
						label: t`Accept Friend Request`,
						onClick: () => {
							onClose();
							RelationshipActionUtils.acceptFriendRequest(i18n, user.id);
						},
					});
					relationshipActions.push({
						icon: <IgnoreFriendRequestIcon size={16} />,
						label: t`Ignore Friend Request`,
						onClick: () => {
							onClose();
							RelationshipActionUtils.ignoreFriendRequest(i18n, user.id);
						},
					});
					break;
				case RelationshipTypes.OUTGOING_REQUEST:
					break;
				case RelationshipTypes.BLOCKED:
					break;
				default:
					if (!user.bot) {
						relationshipActions.push({
							icon: <SendFriendRequestIcon size={16} />,
							label: t`Add Friend`,
							onClick: async () => {
								await RelationshipActionUtils.sendFriendRequest(i18n, user.id);
							},
						});
					}
					break;
			}

			if (relationshipType === RelationshipTypes.BLOCKED) {
				relationshipActions.push({
					icon: <BlockUserIcon size={16} />,
					label: t`Unblock`,
					onClick: () => {
						onClose();
						RelationshipActionUtils.unblockUser(i18n, user.id);
					},
				});
			} else {
				relationshipActions.push({
					icon: <BlockUserIcon size={16} />,
					label: t`Block`,
					onClick: () => {
						onClose();
						RelationshipActionUtils.showBlockUserConfirmation(i18n, user);
					},
					danger: true,
				});
			}

			if (relationshipActions.length > 0) {
				menuGroups.push({items: relationshipActions});
			}
		}

		if (!isCurrentUser && guildId && member) {
			const moderationActions: Array<MenuItemType | MenuCheckboxType> = [];

			if (canMuteMembers) {
				const isGuildMuted = member.mute ?? false;
				const isGuildDeafened = member.deaf ?? false;

				moderationActions.push({
					icon: <GuildMuteIcon size={16} />,
					label: t`Community Mute`,
					checked: isGuildMuted,
					onChange: async (checked: boolean) => {
						try {
							await GuildMemberActionCreators.update(guildId, user.id, {mute: checked});
							if (checked) SoundActionCreators.playSound(SoundType.Mute);
							else SoundActionCreators.playSound(SoundType.Unmute);
						} catch {}
					},
				});

				moderationActions.push({
					icon: <GuildDeafenIcon size={16} />,
					label: t`Community Deafen`,
					checked: isGuildDeafened,
					onChange: async (checked: boolean) => {
						try {
							await GuildMemberActionCreators.update(guildId, user.id, {deaf: checked});
							if (checked) SoundActionCreators.playSound(SoundType.Deaf);
							else SoundActionCreators.playSound(SoundType.Undeaf);
						} catch {}
					},
				});
			}

			if (canMoveMembers && !isParentGroupedItem) {
				moderationActions.push({
					icon: <DisconnectIcon size={16} />,
					label: connectionId ? t`Disconnect Device` : t`Disconnect`,
					onClick: async () => {
						try {
							await GuildMemberActionCreators.update(guildId, user.id, {
								channel_id: null,
								connection_id: connectionId,
							});
						} catch (error) {
							logger.error('Failed to disconnect participant:', error);
						}
						onClose();
					},
					danger: true,
				});
			}

			if (canTimeoutTarget) {
				const isTimedOut = member.isTimedOut() ?? false;
				moderationActions.push({
					icon: <TimeoutIcon size={16} />,
					label: isTimedOut ? t`Remove Timeout` : t`Timeout`,
					onClick: () => {
						onClose();
						if (isTimedOut) {
							ModalActionCreators.push(modal(() => <RemoveTimeoutModal guildId={guildId} targetUser={user} />));
						} else {
							ModalActionCreators.push(modal(() => <TimeoutMemberModal guildId={guildId} targetUser={user} />));
						}
					},
					danger: !isTimedOut,
				});
			}

			if (canKickTarget) {
				moderationActions.push({
					icon: <KickMemberIcon size={16} />,
					label: t`Kick Member`,
					onClick: () => {
						onClose();
						ModalActionCreators.push(modal(() => <KickMemberModal guildId={guildId} targetUser={user} />));
					},
					danger: true,
				});
			}

			if (canBanTarget) {
				moderationActions.push({
					icon: <BanMemberIcon size={16} />,
					label: t`Ban Member`,
					onClick: () => {
						onClose();
						ModalActionCreators.push(modal(() => <BanMemberModal guildId={guildId} targetUser={user} />));
					},
					danger: true,
				});
			}

			if (moderationActions.length > 0) {
				menuGroups.push({items: moderationActions});
			}
		}

		const devActions: Array<MenuItemType> = [];

		if (developerMode) {
			devActions.push({
				icon: <DebugIcon size={16} />,
				label: t`Debug User`,
				onClick: () => {
					ModalActionCreators.push(modal(() => <UserDebugModal title={t`User Debug`} user={user} />));
					onClose();
				},
			});
		}

		devActions.push({
			icon: <CopyIdIcon size={16} />,
			label: t`Copy User ID`,
			onClick: () => {
				onClose();
				TextCopyActionCreators.copy(i18n, user.id, true);
			},
		});

		if (devActions.length > 0) {
			menuGroups.push({items: devActions});
		}

		return menuGroups;
	}, [
		t,
		i18n,
		user,
		guildId,
		connectionId,
		isCurrentUser,
		isGroupedItem,
		isParentGroupedItem,
		member,
		developerMode,
		relationshipType,
		canMention,
		focusedChannelId,
		canMuteMembers,
		canMoveMembers,
		canKickTarget,
		canBanTarget,
		canTimeoutTarget,
		userVoiceStates,
		hasMultipleConnections,
		onClose,
		connectionVoiceState,
		currentUserVoiceState,
		currentUserVoiceStateInGuild,
		isCurrentUserConnectedToVoice,
		currentConnectionId,
		currentConnectionVoiceState,
		showMyOwnCamera,
		showMyOwnScreenShare,
		showNonVideoParticipants,
		participantVolume,
		isVideoDisabled,
		callId,
		participantIdentity,
		streamKey,
		isScreenShare,
		isWatching,
		isFocusedScreenShareTile,
		hasScreenShareAudio,
		isOwnScreenShare,
		onStopWatching,
		streamVolume,
		isStreamMuted,
	]);

	return {
		groups,
		member,
		isCurrentUser,
		developerMode,
		relationshipType,
		canMoveMembers,
		userVoiceStates,
		hasMultipleConnections,
		voiceChannels,
		hasVoiceChannels: voiceChannels.length > 0,
	};
}
