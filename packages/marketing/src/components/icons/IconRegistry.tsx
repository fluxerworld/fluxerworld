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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import {ArrowUpIcon} from '@fluxer/marketing/src/components/icons/ArrowUpIcon';
import {BlueskyIcon} from '@fluxer/marketing/src/components/icons/BlueskyIcon';
import {BugIcon} from '@fluxer/marketing/src/components/icons/BugIcon';
import {CalendarCheckIcon} from '@fluxer/marketing/src/components/icons/CalendarCheckIcon';
import {ChatCenteredTextIcon} from '@fluxer/marketing/src/components/icons/ChatCenteredTextIcon';
import {ChatsCircleIcon} from '@fluxer/marketing/src/components/icons/ChatsCircleIcon';
import {ChatsIcon} from '@fluxer/marketing/src/components/icons/ChatsIcon';
import {CodeIcon} from '@fluxer/marketing/src/components/icons/CodeIcon';
import {CoinsIcon} from '@fluxer/marketing/src/components/icons/CoinsIcon';
import {DevicesIcon} from '@fluxer/marketing/src/components/icons/DevicesIcon';
import {FluxerPartnerIcon} from '@fluxer/marketing/src/components/icons/FluxerPartnerIcon';
import {FluxerPremiumIcon} from '@fluxer/marketing/src/components/icons/FluxerPremiumIcon';
import {FluxerStaffIcon} from '@fluxer/marketing/src/components/icons/FluxerStaffIcon';
import {GearIcon} from '@fluxer/marketing/src/components/icons/GearIcon';
import {GifIcon} from '@fluxer/marketing/src/components/icons/GifIcon';
import {GlobeIcon} from '@fluxer/marketing/src/components/icons/GlobeIcon';
import {HashIcon} from '@fluxer/marketing/src/components/icons/HashIcon';
import {HeartIcon} from '@fluxer/marketing/src/components/icons/HeartIcon';
import {InfinityIcon} from '@fluxer/marketing/src/components/icons/InfinityIcon';
import {LinkIcon} from '@fluxer/marketing/src/components/icons/LinkIcon';
import {MagnifyingGlassIcon} from '@fluxer/marketing/src/components/icons/MagnifyingGlassIcon';
import {MedalIcon} from '@fluxer/marketing/src/components/icons/MedalIcon';
import {MicrophoneIcon} from '@fluxer/marketing/src/components/icons/MicrophoneIcon';
import {NewspaperIcon} from '@fluxer/marketing/src/components/icons/NewspaperIcon';
import {PaletteIcon} from '@fluxer/marketing/src/components/icons/PaletteIcon';
import {RocketIcon} from '@fluxer/marketing/src/components/icons/RocketIcon';
import {RocketLaunchIcon} from '@fluxer/marketing/src/components/icons/RocketLaunchIcon';
import {SealCheckIcon} from '@fluxer/marketing/src/components/icons/SealCheckIcon';
import {ShieldCheckIcon} from '@fluxer/marketing/src/components/icons/ShieldCheckIcon';
import {SmileyIcon} from '@fluxer/marketing/src/components/icons/SmileyIcon';
import {SparkleIcon} from '@fluxer/marketing/src/components/icons/SparkleIcon';
import {SpeakerHighIcon} from '@fluxer/marketing/src/components/icons/SpeakerHighIcon';
import {TranslateIcon} from '@fluxer/marketing/src/components/icons/TranslateIcon';
import {TshirtIcon} from '@fluxer/marketing/src/components/icons/TshirtIcon';
import {UserCircleIcon} from '@fluxer/marketing/src/components/icons/UserCircleIcon';
import {UserPlusIcon} from '@fluxer/marketing/src/components/icons/UserPlusIcon';
import {VideoCameraIcon} from '@fluxer/marketing/src/components/icons/VideoCameraIcon';
import {VideoIcon} from '@fluxer/marketing/src/components/icons/VideoIcon';

const ICON_MAP = {
	chats: ChatsIcon,
	microphone: MicrophoneIcon,
	palette: PaletteIcon,
	magnifying_glass: MagnifyingGlassIcon,
	devices: DevicesIcon,
	gear: GearIcon,
	heart: HeartIcon,
	globe: GlobeIcon,
	server: GlobeIcon,
	newspaper: NewspaperIcon,

	rocket_launch: RocketLaunchIcon,
	fluxer_partner: FluxerPartnerIcon,
	chat_centered_text: ChatCenteredTextIcon,
	bluesky: BlueskyIcon,
	bug: BugIcon,
	code: CodeIcon,
	translate: TranslateIcon,
	shield_check: ShieldCheckIcon,

	fluxer_premium: FluxerPremiumIcon,
	fluxer_staff: FluxerStaffIcon,
	seal_check: SealCheckIcon,
	link: LinkIcon,
	arrow_up: ArrowUpIcon,
	rocket: RocketIcon,
	coins: CoinsIcon,
	tshirt: TshirtIcon,
	gif: GifIcon,

	video: VideoIcon,
	video_camera: VideoCameraIcon,
	user_circle: UserCircleIcon,
	user_plus: UserPlusIcon,
	speaker_high: SpeakerHighIcon,
	calendar_check: CalendarCheckIcon,
	hash: HashIcon,
	smiley: SmileyIcon,
	sparkle: SparkleIcon,

	infinity: InfinityIcon,
	medal: MedalIcon,
	chats_circle: ChatsCircleIcon,
} as const;

export type IconName = keyof typeof ICON_MAP;

export function Icon({name, class: className}: {name: IconName; class?: string}): JSX.Element {
	const Component = ICON_MAP[name];
	return <Component class={className} />;
}
