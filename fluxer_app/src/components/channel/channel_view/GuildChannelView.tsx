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
	AccountTooNewBarrier,
	NoPhoneNumberBarrier,
	NotMemberLongEnoughBarrier,
	SendMessageDisabledBarrier,
	UnclaimedAccountBarrier,
	UnverifiedEmailBarrier,
} from '@app/components/channel/barriers/BarrierComponents';
import {ChannelChatLayout} from '@app/components/channel/ChannelChatLayout';
import {ChannelHeader} from '@app/components/channel/ChannelHeader';
import styles from '@app/components/channel/ChannelIndexPage.module.css';
import {ChannelMembers} from '@app/components/channel/ChannelMembers';
import {ChannelSearchResults} from '@app/components/channel/ChannelSearchResults';
import {ChannelTextarea} from '@app/components/channel/ChannelTextarea';
import {ChannelViewScaffold} from '@app/components/channel/channel_view/ChannelViewScaffold';
import {useChannelSearchState} from '@app/components/channel/channel_view/useChannelSearchState';
import {Messages} from '@app/components/channel/Messages';
import {NSFWChannelGate} from '@app/components/channel/NSFWChannelGate';
import {VerificationBarrier} from '@app/components/channel/VerificationBarrier';
import {Button} from '@app/components/uikit/button/Button';
import {VoiceCallView} from '@app/components/voice/VoiceCallView';
import {useChannelMemberListVisibility} from '@app/hooks/useChannelMemberListVisibility';
import {useChannelSearchVisibility} from '@app/hooks/useChannelSearchVisibility';
import {useFluxerDocumentTitle} from '@app/hooks/useFluxerDocumentTitle';
import {useMemberListVisible} from '@app/hooks/useMemberListVisible';
import ChannelStore from '@app/stores/ChannelStore';
import DeveloperOptionsStore from '@app/stores/DeveloperOptionsStore';
import GuildNSFWAgreeStore, {NSFWGateReason} from '@app/stores/GuildNSFWAgreeStore';
import GuildStore from '@app/stores/GuildStore';
import GuildVerificationStore from '@app/stores/GuildVerificationStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {GuildNSFWLevel} from '@fluxer/constants/src/GuildConstants';
import {observer} from 'mobx-react-lite';
import {useEffect, useState} from 'react';

interface GuildChannelViewProps {
	channelId: string;
	guildId?: string | null;
	messageId?: string;
}

export const GuildChannelView = observer(({channelId, guildId}: GuildChannelViewProps) => {
	const channel = ChannelStore.getChannel(channelId);
	const guild = guildId ? GuildStore.getGuild(guildId) : null;
	const isMemberListVisible = useMemberListVisible();
	const {enabled: isMobileLayout} = MobileLayoutStore;
	const room = MediaEngineStore.room;
	const connectedChannelId = MediaEngineStore.channelId;
	const nsfwGateReason = GuildNSFWAgreeStore.getGateReason({channelId, guildId});
	const showNSFWGate = nsfwGateReason !== NSFWGateReason.NONE;
	const forceMockNSFWGate = DeveloperOptionsStore.mockNSFWGateReason !== 'none';
	const searchState = useChannelSearchState(channel);
	const {
		isSearchActive,
		handleSearchClose,
		handleSearchSubmit,
		searchRefreshKey,
		activeSearchQuery,
		activeSearchSegments,
	} = searchState;
	const [hasMessagesBottomBar, setHasMessagesBottomBar] = useState(false);

	useEffect(() => {
		setHasMessagesBottomBar(false);
	}, [channelId]);

	useChannelSearchVisibility(channelId, isSearchActive);
	useChannelMemberListVisibility(channelId, isMemberListVisible && !isMobileLayout);

	useEffect(() => {
		const handleGlobalKeydown = (event: Event) => {
			const keyboardEvent = event as KeyboardEvent;
			if (keyboardEvent.key === 'Escape' && isSearchActive) {
				searchState.setIsSearchActive(false);
			}
		};

		const options = {capture: true} as const;
		document.addEventListener('keydown', handleGlobalKeydown, options);
		return () => {
			document.removeEventListener('keydown', handleGlobalKeydown, options);
		};
	}, [isSearchActive, searchState]);

	const channelTitlePart = channel
		? `${channel.type === ChannelTypes.GUILD_VOICE ? '' : '#'}${channel.name ?? ''}`
		: null;
	const guildTitlePart = guild ? guild.name : null;
	useFluxerDocumentTitle(channel ? [channelTitlePart, guildTitlePart] : undefined);

	if (!(guild && channel)) {
		return null;
	}

	const isGuildAgeRestricted = guild.nsfwLevel === GuildNSFWLevel.AGE_RESTRICTED;
	const gateScope: 'channel' | 'guild' = isGuildAgeRestricted ? 'guild' : 'channel';

	if (showNSFWGate || forceMockNSFWGate) {
		return (
			<div className={styles.channelGrid}>
				<ChannelHeader channel={channel} showMembersToggle={false} showPins={false} />
				<NSFWChannelGate channelId={channelId} guildId={guild.id} scope={gateScope} reason={nsfwGateReason} />
			</div>
		);
	}

	const isVoiceChannel = channel.type === ChannelTypes.GUILD_VOICE;
	const isConnectedToThisChannel = isVoiceChannel && connectedChannelId === channelId && room;

	const passesVerification = channel.isPrivate() || GuildVerificationStore.canAccessGuild(channel.guildId || '');

	const renderChatArea = () => {
		if (DeveloperOptionsStore.mockVerificationBarrier !== 'none' && !channel.isPrivate()) {
			switch (DeveloperOptionsStore.mockVerificationBarrier) {
				case 'unclaimed_account':
					return <UnclaimedAccountBarrier />;
				case 'unverified_email':
					return <UnverifiedEmailBarrier />;
				case 'account_too_new':
					return (
						<AccountTooNewBarrier initialTimeRemaining={DeveloperOptionsStore.mockBarrierTimeRemaining || 300000} />
					);
				case 'not_member_long':
					return (
						<NotMemberLongEnoughBarrier
							initialTimeRemaining={DeveloperOptionsStore.mockBarrierTimeRemaining || 600000}
						/>
					);
				case 'no_phone':
					return <NoPhoneNumberBarrier />;
				case 'send_message_disabled':
					return <SendMessageDisabledBarrier />;
				default:
					return passesVerification ? <ChannelTextarea channel={channel} /> : <VerificationBarrier channel={channel} />;
			}
		}

		return passesVerification ? <ChannelTextarea channel={channel} /> : <VerificationBarrier channel={channel} />;
	};

	if (isVoiceChannel) {
		if (isConnectedToThisChannel && room) {
			return (
				<div className={styles.voiceChannelContainer}>
					<VoiceCallView channel={channel} />
				</div>
			);
		}

		return (
			<div className={styles.channelGrid}>
				<ChannelHeader channel={channel} showMembersToggle={false} showPins={false} />
				<div className={styles.emptyStateContent}>
					<div className={styles.centeredText}>
						<h2 className={styles.voiceChannelTitle}>{channel.name}</h2>
						<p className={styles.voiceChannelDescription}>This is a voice channel. Connect to start talking!</p>
					</div>
					<div className={styles.buttonContainer}>
						<Button
							type="button"
							onClick={() => MediaEngineStore.connectToVoiceChannel(channel.guildId!, channel.id)}
							fitContainer={false}
							fitContent
						>
							Join Voice Channel
						</Button>
					</div>
				</div>
			</div>
		);
	}

	const shouldRenderMemberList = isMemberListVisible && !isMobileLayout && !isSearchActive;

	return (
		<ChannelViewScaffold
			header={
				<ChannelHeader
					channel={channel}
					showMembersToggle={true}
					showPins={true}
					onSearchSubmit={handleSearchSubmit}
					onSearchClose={handleSearchClose}
					isSearchResultsOpen={isSearchActive}
				/>
			}
			chatArea={
				<ChannelChatLayout
					channel={channel}
					messages={
						<Messages key={channel.id} channel={channel} onBottomBarVisibilityChange={setHasMessagesBottomBar} />
					}
					textarea={renderChatArea()}
					hideSlowmodeIndicator={hasMessagesBottomBar}
				/>
			}
			sidePanel={
				isSearchActive ? (
					<div className={styles.searchPanel}>
						<ChannelSearchResults
							channel={channel}
							searchQuery={activeSearchQuery}
							searchSegments={activeSearchSegments}
							refreshKey={searchRefreshKey}
							onClose={() => searchState.setIsSearchActive(false)}
						/>
					</div>
				) : shouldRenderMemberList ? (
					<ChannelMembers channel={channel} guild={guild} />
				) : null
			}
			showMemberListDivider={shouldRenderMemberList && !isSearchActive}
		/>
	);
});
