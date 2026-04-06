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

import {BlueskyIcon} from '@app/components/icons/BlueskyIcon';
import type {ConnectionType} from '@fluxer/constants/src/ConnectionConstants';
import {ConnectionTypes} from '@fluxer/constants/src/ConnectionConstants';
import {GlobeSimpleIcon} from '@phosphor-icons/react';

interface IconProps {
	size?: number;
	className?: string;
}

function SvgIcon({size = 16, className, viewBox, color, children}: IconProps & {viewBox: string; color: string; children: React.ReactNode}) {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox={viewBox} fill={color} className={className}>
			{children}
		</svg>
	);
}

function BattleNetIcon({size, className}: IconProps) {
	return (
		<SvgIcon size={size} className={className} viewBox="0 0 24 24" color="#148eff">
			<path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 1.5c5.799 0 10.5 4.701 10.5 10.5S17.799 22.5 12 22.5 1.5 17.799 1.5 12 6.201 1.5 12 1.5zm-.563 3.75c-1.125.075-2.1.6-2.887 1.35-.412.394-.75.862-1.012 1.387-.075-.037-.15-.075-.225-.075-.9-.3-1.875-.337-2.738.075.15.525.45.975.825 1.35-.15.375-.225.787-.225 1.2 0 .525.112 1.05.337 1.537-.6.338-1.125.825-1.462 1.425.525.225 1.087.3 1.65.225.15.413.375.788.675 1.125-.15.45-.225.938-.15 1.425.525-.075 1.012-.3 1.425-.6.375.262.787.45 1.237.562-.037.488.037.975.225 1.425.487-.225.9-.563 1.2-.975.45.112.937.112 1.387 0 .3.413.713.75 1.2.975.188-.45.262-.938.225-1.425.45-.112.863-.3 1.238-.562.412.3.9.525 1.425.6.075-.488 0-.975-.15-1.425.3-.338.525-.713.675-1.125.562.075 1.125 0 1.65-.225-.338-.6-.863-1.088-1.463-1.425.225-.488.338-1.013.338-1.538 0-.412-.075-.825-.225-1.2.375-.375.675-.825.825-1.35-.863-.412-1.838-.375-2.738-.075-.075 0-.15.038-.225.075-.263-.525-.6-.993-1.013-1.387-.787-.75-1.762-1.275-2.887-1.35z" />
		</SvgIcon>
	);
}

function EpicGamesIcon({size, className}: IconProps) {
	return (
		<SvgIcon size={size} className={className} viewBox="0 0 24 24" color="#2f2d2e">
			<path d="M3.537 0C2.165 0 1.66.506 1.66 1.879V18.44c0 .508.152.756.456 1.009L9.72 24h.008l7.603-4.551c.305-.253.456-.501.456-1.009V1.879C17.787.506 17.283 0 15.91 0H3.537zm2.101 3.554h4.144c1.086 0 1.631.527 1.631 1.596v2.837h-2.1V5.375c0-.283-.152-.435-.435-.435h-.706c-.283 0-.435.152-.435.435v5.642c0 .283.152.435.435.435h.706c.283 0 .435-.152.435-.435V9.048h2.1v2.687c0 1.069-.545 1.596-1.631 1.596H5.638c-1.086 0-1.631-.527-1.631-1.596V5.15c0-1.069.545-1.596 1.631-1.596z" />
		</SvgIcon>
	);
}

function FacebookIcon({size, className}: IconProps) {
	return (
		<SvgIcon size={size} className={className} viewBox="0 0 24 24" color="#1877f2">
			<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
		</SvgIcon>
	);
}

function GitHubIcon({size, className}: IconProps) {
	return (
		<SvgIcon size={size} className={className} viewBox="0 0 24 24" color="#24292f">
			<path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
		</SvgIcon>
	);
}

function PayPalIcon({size, className}: IconProps) {
	return (
		<SvgIcon size={size} className={className} viewBox="0 0 24 24" color="#003087">
			<path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z" />
		</SvgIcon>
	);
}

function PlayStationIcon({size, className}: IconProps) {
	return (
		<SvgIcon size={size} className={className} viewBox="0 0 24 24" color="#003791">
			<path d="M8.985 2.596v17.548l3.915 1.261V6.688c0-.69.304-1.151.794-.991.636.181.76.814.76 1.505v5.876c2.441 1.193 4.362-.002 4.362-3.153 0-3.237-1.126-4.675-4.438-5.827-1.307-.448-3.728-1.186-5.393-1.502zm11.009 11.222c-2.124.992-4.652 1.404-7.17 1.628v3.614l1.587-.545V14.29c2.282-.56 4.702-.964 5.583-1.472zM1.478 18.119c2.523.854 5.152.771 6.994.009.304-.126.502-.38.502-.709V15.68l-3.5 1.199c-1.98.676-4.082-.161-4.082-2.475 0-2.126 1.327-3.556 4.082-4.479l3.5-1.199v-.744c-4.144.954-8.174 2.7-8.174 5.986 0 1.923.895 3.415 2.678 4.151z" />
		</SvgIcon>
	);
}

function RedditIcon({size, className}: IconProps) {
	return (
		<SvgIcon size={size} className={className} viewBox="0 0 24 24" color="#ff4500">
			<path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.951 7.773c.652 0 1.181.529 1.181 1.181 0 .456-.259.853-.637 1.052.044.222.066.448.066.679 0 2.819-3.073 5.108-6.86 5.108-3.788 0-6.861-2.289-6.861-5.108 0-.21.018-.416.052-.618a1.18 1.18 0 0 1-.618-1.037c0-.652.529-1.181 1.181-1.181.329 0 .626.135.84.352 1.139-.787 2.588-1.256 4.138-1.297l.907-3.723a.318.318 0 0 1 .378-.242l2.74.634a.96.96 0 0 1 1.796.074l.013.056c.017.068.026.138.026.21a.96.96 0 0 1-1.92 0 .96.96 0 0 1 .032-.242l-2.345-.543-.759 3.114c1.499.063 2.896.53 4 1.298a1.176 1.176 0 0 1 .84-.352zM9.333 11.21a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92zm5.334 0a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92zm-4.722 3.367a.318.318 0 0 1 .45-.002c.75.74 2.039 1.076 3.109 1.076s2.358-.337 3.109-1.076a.318.318 0 0 1 .45.448c-.881.87-2.303 1.305-3.559 1.305-1.255 0-2.677-.435-3.559-1.305a.318.318 0 0 1 0-.446z" />
		</SvgIcon>
	);
}

function SpotifyIcon({size, className}: IconProps) {
	return (
		<SvgIcon size={size} className={className} viewBox="0 0 24 24" color="#1db954">
			<path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
		</SvgIcon>
	);
}

function SteamIcon({size, className}: IconProps) {
	return (
		<SvgIcon size={size} className={className} viewBox="0 0 24 24" color="#1b2838">
			<path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012zm11.415-9.303a3.01 3.01 0 0 0-3.015-3.015 3.01 3.01 0 0 0-3.015 3.015 3.01 3.01 0 0 0 3.015 3.015 3.01 3.01 0 0 0 3.015-3.015z" />
		</SvgIcon>
	);
}

function TikTokIcon({size, className}: IconProps) {
	return (
		<SvgIcon size={size} className={className} viewBox="0 0 24 24" color="#010101">
			<path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
		</SvgIcon>
	);
}

function TwitchIcon({size, className}: IconProps) {
	return (
		<SvgIcon size={size} className={className} viewBox="0 0 24 24" color="#9146ff">
			<path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
		</SvgIcon>
	);
}

function XIcon({size, className}: IconProps) {
	return (
		<SvgIcon size={size} className={className} viewBox="0 0 24 24" color="#14171a">
			<path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
		</SvgIcon>
	);
}

function XboxIcon({size, className}: IconProps) {
	return (
		<SvgIcon size={size} className={className} viewBox="0 0 24 24" color="#107c10">
			<path d="M4.102 21.033C6.211 22.881 8.977 24 12 24c3.026 0 5.789-1.119 7.902-2.967 1.877-1.912-.458-5.833-2.588-7.373-3.063 3.228-6.193 5.676-8.027 5.676S5.79 16.878 2.727 13.648c-2.114 1.576-4.389 5.476-2.625 7.385zM12 3.79c2.784 3.18 3.775 4.665 5.949 7.527 1.574-1.508 3.551-4.107 2.938-6.261C19.244 2.426 15.868.687 12.137.687h-.274C8.132.687 4.756 2.426 3.113 5.056c-.612 2.159 1.377 4.753 2.938 6.261C8.231 8.459 9.221 6.97 12 3.79z" />
		</SvgIcon>
	);
}

function YouTubeIcon({size, className}: IconProps) {
	return (
		<SvgIcon size={size} className={className} viewBox="0 0 24 24" color="#ff0000">
			<path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
		</SvgIcon>
	);
}

const ICON_MAP: Record<ConnectionType, React.FC<IconProps>> = {
	[ConnectionTypes.BLUESKY]: BlueskyIcon,
	[ConnectionTypes.DOMAIN]: ({size, className}) => <GlobeSimpleIcon size={size} className={className} color="#555" />,
	[ConnectionTypes.BATTLENET]: BattleNetIcon,
	[ConnectionTypes.EPIC_GAMES]: EpicGamesIcon,
	[ConnectionTypes.FACEBOOK]: FacebookIcon,
	[ConnectionTypes.GITHUB]: GitHubIcon,
	[ConnectionTypes.PAYPAL]: PayPalIcon,
	[ConnectionTypes.PLAYSTATION]: PlayStationIcon,
	[ConnectionTypes.REDDIT]: RedditIcon,
	[ConnectionTypes.SPOTIFY]: SpotifyIcon,
	[ConnectionTypes.STEAM]: SteamIcon,
	[ConnectionTypes.TIKTOK]: TikTokIcon,
	[ConnectionTypes.TWITCH]: TwitchIcon,
	[ConnectionTypes.X]: XIcon,
	[ConnectionTypes.XBOX]: XboxIcon,
	[ConnectionTypes.YOUTUBE]: YouTubeIcon,
};

export function ConnectionIcon({type, size = 20, className}: {type: ConnectionType; size?: number; className?: string}) {
	const Icon = ICON_MAP[type] ?? ICON_MAP[ConnectionTypes.DOMAIN];
	return <Icon size={size} className={className} />;
}
