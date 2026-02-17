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

import {
	ArrowBendUpLeftIcon,
	ArrowBendUpRightIcon,
	ArrowLeftIcon,
	ArrowRightIcon,
	ArrowSquareOutIcon,
	ArrowsClockwiseIcon,
	ArrowsLeftRightIcon,
	ArrowsOutCardinalIcon,
	AtIcon,
	BellIcon,
	BellSlashIcon,
	BookmarkSimpleIcon,
	BootIcon,
	BugBeetleIcon,
	BugIcon,
	CameraIcon,
	CameraSlashIcon,
	CaretDownIcon,
	CaretRightIcon,
	CaretUpIcon,
	ChatCircleIcon,
	CheckCircleIcon,
	CircleNotchIcon,
	ClipboardTextIcon,
	ClockCounterClockwiseIcon,
	ClockIcon,
	CopySimpleIcon,
	CrownIcon,
	DotsThreeIcon,
	DotsThreeVerticalIcon,
	DownloadSimpleIcon,
	EnvelopeOpenIcon,
	EyeIcon,
	EyeSlashIcon,
	FlagIcon,
	FolderPlusIcon,
	FunnelIcon,
	GavelIcon,
	GearIcon,
	GlobeIcon,
	GridFourIcon,
	type IconWeight,
	LinkBreakIcon,
	LinkIcon,
	MagnifyingGlassIcon,
	MicrophoneIcon,
	MicrophoneSlashIcon,
	MonitorPlayIcon,
	NotePencilIcon,
	PaperPlaneIcon,
	PaperPlaneRightIcon,
	PencilIcon,
	PencilSimpleIcon,
	PhoneIcon,
	PhoneXIcon,
	CheckIcon as PhosphorCheckIcon,
	CopyIcon as PhosphorCopyIcon,
	PlusCircleIcon,
	PlusIcon,
	ProhibitIcon,
	PushPinIcon,
	ShieldIcon,
	SignOutIcon,
	SmileyIcon,
	SnowflakeIcon,
	SortAscendingIcon,
	SpeakerHighIcon,
	SpeakerSimpleSlashIcon,
	SpeakerSlashIcon,
	StarIcon,
	StopCircleIcon,
	TicketIcon,
	TrashIcon,
	UserCircleIcon,
	UserIcon,
	UserListIcon,
	UserMinusIcon,
	UserPlusIcon,
	UsersIcon,
	VideoCameraIcon,
	VideoCameraSlashIcon,
	VideoIcon,
	WrenchIcon,
	XIcon,
} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';

interface IconProps {
	size?: number;
	weight?: IconWeight;
	className?: string;
}

export const ReplyIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<ArrowBendUpLeftIcon size={size} weight="fill" />
));

export const ForwardIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<ArrowBendUpRightIcon size={size} weight="fill" />
));

export const EditIcon: React.FC<IconProps> = observer(({size = 16, weight = 'fill'}) => (
	<PencilIcon size={size} weight={weight} />
));

export const DeleteIcon: React.FC<IconProps> = observer(({size = 16}) => <TrashIcon size={size} weight="fill" />);

export const PinIcon: React.FC<IconProps> = observer(({size = 16}) => <PushPinIcon size={size} weight="fill" />);

export const AddReactionIcon: React.FC<IconProps> = observer(({size = 16}) => <SmileyIcon size={size} weight="fill" />);

export const RemoveAllReactionsIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<XIcon size={size} weight="bold" />
));

export const BookmarkIcon: React.FC<IconProps & {filled?: boolean}> = observer(({size = 16, filled = false}) => (
	<BookmarkSimpleIcon size={size} weight={filled ? 'fill' : 'regular'} />
));

export const FavoriteIcon: React.FC<IconProps & {filled?: boolean}> = observer(({size = 16, filled = false}) => (
	<StarIcon size={size} weight={filled ? 'fill' : 'regular'} />
));

export const CopyTextIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<ClipboardTextIcon size={size} weight="fill" />
));

export const CopyLinkIcon: React.FC<IconProps> = observer(({size = 16}) => <LinkIcon size={size} weight="bold" />);

export const CopyIdIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<SnowflakeIcon size={size} weight="regular" />
));

export const CopyIcon: React.FC<IconProps> = observer(({size = 16}) => <CopySimpleIcon size={size} weight="fill" />);

export const OpenLinkIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<ArrowSquareOutIcon size={size} weight="regular" />
));

export const RetryIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<ArrowsClockwiseIcon size={size} weight="fill" />
));

export const SaveIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<DownloadSimpleIcon size={size} weight="fill" />
));

export const SuppressEmbedsIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<LinkBreakIcon size={size} weight="bold" />
));

export const MarkAsReadIcon: React.FC<IconProps> = observer(({size = 16}) => <EyeIcon size={size} weight="fill" />);

export const MarkAsUnreadIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<EnvelopeOpenIcon size={size} weight="fill" />
));

export const MuteIcon: React.FC<IconProps> = observer(({size = 16}) => <BellSlashIcon size={size} weight="fill" />);

export const NotificationSettingsIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<BellIcon size={size} weight="fill" />
));

export const InviteIcon: React.FC<IconProps> = observer(({size = 16}) => <UserPlusIcon size={size} weight="fill" />);

export const CreateChannelIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<PlusCircleIcon size={size} weight="fill" />
));

export const CreateCategoryIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<FolderPlusIcon size={size} weight="fill" />
));

export const SettingsIcon: React.FC<IconProps> = observer(({size = 16}) => <GearIcon size={size} weight="fill" />);

export const PrivacySettingsIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<ShieldIcon size={size} weight="fill" />
));

export const LeaveIcon: React.FC<IconProps> = observer(({size = 16}) => <SignOutIcon size={size} weight="fill" />);

export const EditProfileIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<UserCircleIcon size={size} weight="fill" />
));

export const ViewGlobalProfileIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<GlobeIcon size={size} weight="fill" />
));

export const VoiceCallIcon: React.FC<IconProps> = observer(({size = 16}) => <PhoneIcon size={size} weight="fill" />);

export const VideoCallIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<VideoCameraIcon size={size} weight="fill" />
));

export const SpeakIcon: React.FC<IconProps> = observer(({size = 16}) => <SpeakerHighIcon size={size} weight="fill" />);

export const SendFriendRequestIcon: React.FC<IconProps> = observer(({size = 16, weight = 'fill'}) => (
	<UserPlusIcon size={size} weight={weight} />
));

export const AcceptFriendRequestIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<CheckCircleIcon size={size} weight="fill" />
));

export const RemoveFriendIcon: React.FC<IconProps> = observer(({size = 16, weight = 'fill'}) => (
	<UserMinusIcon size={size} weight={weight} />
));

export const IgnoreFriendRequestIcon: React.FC<IconProps> = observer(({size = 16, weight = 'bold'}) => (
	<XIcon size={size} weight={weight} />
));

export const CancelFriendRequestIcon: React.FC<IconProps> = observer(({size = 16, weight = 'fill'}) => (
	<ClockCounterClockwiseIcon size={size} weight={weight} />
));

export const BlockUserIcon: React.FC<IconProps> = observer(({size = 16, weight = 'fill'}) => (
	<ProhibitIcon size={size} weight={weight} />
));

export const ReportUserIcon: React.FC<IconProps> = observer(({size = 16, weight = 'fill'}) => (
	<FlagIcon size={size} weight={weight} />
));

export const AddNoteIcon: React.FC<IconProps> = observer(({size = 16}) => <NotePencilIcon size={size} weight="fill" />);

export const DebugIcon: React.FC<IconProps> = observer(({size = 16}) => <BugBeetleIcon size={size} weight="fill" />);

export const WrenchToolIcon: React.FC<IconProps> = observer(({size = 16}) => <WrenchIcon size={size} weight="fill" />);

export const EditMessageIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<PencilSimpleIcon size={size} weight="fill" />
));

export const CopyMessageTextIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<PhosphorCopyIcon size={size} weight="fill" />
));

export const DebugMessageIcon: React.FC<IconProps> = observer(({size = 16}) => <BugIcon size={size} weight="fill" />);

export const SpeakMessageIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<SpeakerHighIcon size={size} weight="fill" />
));

export const StopSpeakingIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<StopCircleIcon size={size} weight="fill" />
));

export const MoreIcon: React.FC<IconProps> = observer(({size = 16}) => <DotsThreeIcon size={size} weight="bold" />);

export const ViewReactionsIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<SmileyIcon size={size} weight="fill" />
));

export const ReportMessageIcon: React.FC<IconProps> = observer(({size = 16}) => <FlagIcon size={size} weight="fill" />);

export const EditSimpleIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<PencilSimpleIcon size={size} weight="fill" />
));

export const ExpandIcon: React.FC<IconProps> = observer(({size = 16}) => <CaretDownIcon size={size} weight="fill" />);

export const CollapseIcon: React.FC<IconProps> = observer(({size = 16}) => <CaretUpIcon size={size} weight="fill" />);

export const TransferOwnershipIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<CrownIcon size={size} weight="fill" />
));

export const RemoveFromGroupIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<UserMinusIcon size={size} weight="fill" />
));

export const CloseDMIcon: React.FC<IconProps> = observer(({size = 16}) => <XIcon size={size} weight="bold" />);

export const ChangeNicknameIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<PencilSimpleIcon size={size} weight="fill" />
));

export const CreateIcon: React.FC<IconProps> = observer(({size = 16}) => <PlusIcon size={size} weight="bold" />);

export const HideIcon: React.FC<IconProps> = observer(({size = 16}) => <EyeSlashIcon size={size} weight="fill" />);

export const MoveToIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<ArrowsOutCardinalIcon size={size} weight="fill" />
));

export const ViewDetailsIcon: React.FC<IconProps> = observer(({size = 16}) => <EyeIcon size={size} weight="bold" />);

export const RevokeBanIcon: React.FC<IconProps> = observer(({size = 16}) => <ProhibitIcon size={size} weight="bold" />);

export const RemoveFromFavoritesIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<StarIcon size={size} weight="fill" />
));

export const OpenInCommunityIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<ArrowSquareOutIcon size={size} weight="fill" />
));

export const CheckIcon: React.FC<IconProps> = observer(({size = 16, weight = 'bold', className}) => (
	<PhosphorCheckIcon size={size} weight={weight} className={className} />
));

export const PreviousIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<ArrowLeftIcon size={size} weight="fill" className={className} />
));

export const NextIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<ArrowRightIcon size={size} weight="fill" className={className} />
));

export const ExpandChevronIcon: React.FC<IconProps> = observer(({size = 16, weight = 'bold', className}) => (
	<CaretDownIcon size={size} weight={weight} className={className} />
));

export const CollapseChevronIcon: React.FC<IconProps> = observer(({size = 16, weight = 'bold', className}) => (
	<CaretUpIcon size={size} weight={weight} className={className} />
));

export const ChevronRightIcon: React.FC<IconProps> = observer(({size = 16, weight = 'bold', className}) => (
	<CaretRightIcon size={size} weight={weight} className={className} />
));

export const LoadingIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<CircleNotchIcon size={size} className={className} />
));

export const FilterIcon: React.FC<IconProps> = observer(({size = 16, weight = 'bold', className}) => (
	<FunnelIcon size={size} weight={weight} className={className} />
));

export const SearchIcon: React.FC<IconProps> = observer(({size = 16, weight = 'bold', className}) => (
	<MagnifyingGlassIcon size={size} weight={weight} className={className} />
));

export const SortIcon: React.FC<IconProps> = observer(({size = 16, weight = 'bold', className}) => (
	<SortAscendingIcon size={size} weight={weight} className={className} />
));

export const UserFilterIcon: React.FC<IconProps> = observer(({size = 16, weight = 'bold', className}) => (
	<UserIcon size={size} weight={weight} className={className} />
));

export const CloseIcon: React.FC<IconProps> = observer(({size = 16, weight = 'bold', className}) => (
	<XIcon size={size} weight={weight} className={className} />
));

export const CameraOnIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<CameraIcon size={size} weight="fill" className={className} />
));

export const CameraOffIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<CameraSlashIcon size={size} weight="fill" className={className} />
));

export const MicrophoneOnIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<MicrophoneIcon size={size} weight="fill" className={className} />
));

export const MicrophoneOffIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<MicrophoneSlashIcon size={size} weight="fill" className={className} />
));

export const DisconnectCallIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<PhoneXIcon size={size} weight="fill" className={className} />
));

export const DeafenIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<SpeakerSlashIcon size={size} weight="fill" className={className} />
));

export const UndeafenIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<SpeakerHighIcon size={size} weight="fill" className={className} />
));

export const NewGroupIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<ChatCircleIcon size={size} weight="fill" className={className} />
));

export const OwnerCrownIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<CrownIcon size={size} weight="fill" className={className} />
));

export const MoreOptionsVerticalIcon: React.FC<IconProps> = observer(({size = 16, weight = 'bold', className}) => (
	<DotsThreeVerticalIcon size={size} weight={weight} className={className} />
));

export const InvitesIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<TicketIcon size={size} weight="fill" className={className} />
));

export const MembersIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<UsersIcon size={size} weight="fill" className={className} />
));

export const GridViewIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<GridFourIcon size={size} weight="fill" className={className} />
));

export const EchoCancellationIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<SpeakerSimpleSlashIcon size={size} weight="fill" className={className} />
));

export const VideoSettingsIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<VideoIcon size={size} weight="fill" className={className} />
));

export const InputDeviceIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<MicrophoneIcon size={size} weight="fill" className={className} />
));

export const OutputDeviceIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<SpeakerHighIcon size={size} weight="fill" className={className} />
));

export const MentionUserIcon: React.FC<IconProps> = observer(({size = 16}) => <AtIcon size={size} weight="bold" />);

export const ViewProfileIcon: React.FC<IconProps> = observer(({size = 16}) => <UserIcon size={size} weight="fill" />);

export const GroupInvitesIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<TicketIcon size={size} weight="fill" />
));

export const EditGroupIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<NotePencilIcon size={size} weight="fill" />
));

export const InviteToCommunityIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<UsersIcon size={size} weight="fill" />
));

export const CollapseCategoryIcon: React.FC<IconProps & {collapsed?: boolean}> = observer(
	({size = 16, collapsed = false}) => (
		<CaretDownIcon size={size} weight="bold" style={{transform: collapsed ? 'rotate(-90deg)' : undefined}} />
	),
);

export const MessageUserIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<ChatCircleIcon size={size} weight="fill" />
));

export const RingIcon: React.FC<IconProps> = observer(({size = 16}) => <PhoneIcon size={size} weight="fill" />);

export const StopRingingIcon: React.FC<IconProps> = observer(({size = 16}) => <PhoneXIcon size={size} weight="fill" />);

export const MoveToChannelIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<ArrowsLeftRightIcon size={size} weight="fill" />
));

export const KickMemberIcon: React.FC<IconProps> = observer(({size = 16}) => <BootIcon size={size} weight="fill" />);

export const BanMemberIcon: React.FC<IconProps> = observer(({size = 16}) => <GavelIcon size={size} weight="fill" />);

export const ManageRolesIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<UserListIcon size={size} weight="fill" />
));

export const TimeoutIcon: React.FC<IconProps> = observer(({size = 16}) => <ClockIcon size={size} weight="fill" />);

export const TurnOffCameraIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<VideoCameraSlashIcon size={size} weight="fill" />
));

export const TurnOffStreamIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<MonitorPlayIcon size={size} weight="fill" />
));

export const DisconnectIcon: React.FC<IconProps> = observer(({size = 16}) => <PhoneXIcon size={size} weight="fill" />);

export const SelfMuteIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<MicrophoneSlashIcon size={size} weight="fill" />
));

export const SelfDeafenIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<SpeakerSlashIcon size={size} weight="fill" />
));

export const FocusIcon: React.FC<IconProps> = observer(({size = 16}) => <EyeIcon size={size} weight="fill" />);

export const UnfocusIcon: React.FC<IconProps> = observer(({size = 16}) => <EyeSlashIcon size={size} weight="fill" />);

export const SendInvitesIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<PaperPlaneIcon size={size} weight="fill" />
));

export const SendInviteToCommunityIcon: React.FC<IconProps> = observer(({size = 16}) => (
	<PaperPlaneRightIcon size={size} weight="fill" />
));

export const LocalMuteIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<SpeakerSlashIcon size={size} weight="fill" className={className} />
));

export const LocalDisableVideoIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<VideoCameraSlashIcon size={size} weight="fill" className={className} />
));

export const GuildMuteIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<MicrophoneSlashIcon size={size} weight="fill" className={className} />
));

export const GuildDeafenIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<SpeakerSlashIcon size={size} weight="fill" className={className} />
));

export const BulkTurnOffCameraIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<VideoIcon size={size} weight="fill" className={className} />
));

export const DebugChannelIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<BugBeetleIcon size={size} weight="fill" className={className} />
));

export const CopyMediaIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<CopySimpleIcon size={size} weight="fill" className={className} />
));

export const SaveMediaIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<DownloadSimpleIcon size={size} weight="fill" className={className} />
));

export const OpenMediaLinkIcon: React.FC<IconProps> = observer(({size = 16, className}) => (
	<ArrowSquareOutIcon size={size} weight="regular" className={className} />
));
