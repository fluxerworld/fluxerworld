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

import * as ContextMenuActionCreators from '@app/actions/ContextMenuActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import * as NavigationActionCreators from '@app/actions/NavigationActionCreators';
import * as PremiumActionCreators from '@app/actions/PremiumActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {Logger} from '@app/lib/Logger';
import type {GuildRecord} from '@app/records/GuildRecord';
import ChannelStore from '@app/stores/ChannelStore';
import ContextMenuStore from '@app/stores/ContextMenuStore';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {autorun} from 'mobx';
import type React from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';

const logger = new Logger('useCommunityActions');

export const useCommunityActions = (
	visionaryGuild: GuildRecord | undefined,
	operatorGuild: GuildRecord | undefined,
) => {
	const {t} = useLingui();
	const [loadingRejoinCommunity, setLoadingRejoinCommunity] = useState(false);
	const [isCommunityMenuOpen, setIsCommunityMenuOpen] = useState(false);
	const communityButtonRef = useRef<HTMLButtonElement | null>(null);

	const hasVisionaryGuild = Boolean(visionaryGuild);
	const hasOperatorGuild = Boolean(operatorGuild);

	const getFirstViewableChannel = useCallback((guildId: string) => {
		const channels = ChannelStore.getGuildChannels(guildId);
		return channels.find((channel) => channel.type === ChannelTypes.GUILD_TEXT);
	}, []);

	const handleRejoinCommunity = useCallback(
		async (type: 'visionary' | 'operator') => {
			setLoadingRejoinCommunity(true);
			try {
				if (type === 'visionary') {
					await PremiumActionCreators.rejoinVisionaryGuild();
				} else {
					await PremiumActionCreators.rejoinOperatorGuild();
				}
				const guild = type === 'visionary' ? visionaryGuild : operatorGuild;
				if (guild) {
					const firstChannel = getFirstViewableChannel(guild.id);
					ModalActionCreators.popAll();
					NavigationActionCreators.selectChannel(guild.id, firstChannel?.id);
				}
			} catch (error) {
				logger.error(`Failed to rejoin ${type} guild`, error);
				ToastActionCreators.error(
					type === 'visionary'
						? t`Failed to rejoin the Visionary community. Please try again.`
						: t`Failed to rejoin the Operators community. Please try again.`,
				);
			} finally {
				setLoadingRejoinCommunity(false);
			}
		},
		[visionaryGuild, operatorGuild, getFirstViewableChannel, t],
	);

	const handleCommunityButtonPointerDown = useCallback((event: React.PointerEvent) => {
		const contextMenu = ContextMenuStore.contextMenu;
		const isOpen = !!contextMenu && contextMenu.target.target === communityButtonRef.current;
		if (isOpen) {
			event.stopPropagation();
			event.preventDefault();
			ContextMenuActionCreators.close();
		}
	}, []);

	const handleCommunityButtonClick = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>) => {
			const contextMenu = ContextMenuStore.contextMenu;
			const isOpen = !!contextMenu && contextMenu.target.target === event.currentTarget;
			if (isOpen) {
				return;
			}
			ContextMenuActionCreators.openFromEvent(event, () => (
				<>
					<MenuItem
						onClick={() => {
							ContextMenuActionCreators.close();
							if (hasVisionaryGuild && visionaryGuild) {
								const firstChannel = getFirstViewableChannel(visionaryGuild.id);
								ModalActionCreators.popAll();
								NavigationActionCreators.selectChannel(visionaryGuild.id, firstChannel?.id);
							} else {
								handleRejoinCommunity('visionary');
							}
						}}
					>
						{hasVisionaryGuild ? t`Open Visionary Community` : t`Join Visionary Community`}
					</MenuItem>
					<MenuItem
						onClick={() => {
							ContextMenuActionCreators.close();
							if (hasOperatorGuild && operatorGuild) {
								const firstChannel = getFirstViewableChannel(operatorGuild.id);
								ModalActionCreators.popAll();
								NavigationActionCreators.selectChannel(operatorGuild.id, firstChannel?.id);
							} else {
								handleRejoinCommunity('operator');
							}
						}}
					>
						{hasOperatorGuild ? t`Open Operators Community` : t`Join Operators Community`}
					</MenuItem>
				</>
			));
		},
		[
			hasVisionaryGuild,
			hasOperatorGuild,
			visionaryGuild,
			operatorGuild,
			getFirstViewableChannel,
			handleRejoinCommunity,
			t,
		],
	);

	useEffect(() => {
		const handleContextMenuChange = () => {
			const contextMenu = ContextMenuStore.contextMenu;
			const isOpen =
				!!contextMenu && !!communityButtonRef.current && contextMenu.target.target === communityButtonRef.current;
			setIsCommunityMenuOpen(isOpen);
		};
		const disposer = autorun(handleContextMenuChange);
		return () => disposer();
	}, []);

	return {
		loadingRejoinCommunity,
		isCommunityMenuOpen,
		communityButtonRef,
		handleCommunityButtonPointerDown,
		handleCommunityButtonClick,
	};
};
