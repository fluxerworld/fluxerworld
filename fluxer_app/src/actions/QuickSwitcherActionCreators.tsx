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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as NavigationActionCreators from '@app/actions/NavigationActionCreators';
import * as PrivateChannelActionCreators from '@app/actions/PrivateChannelActionCreators';
import {UserSettingsModal} from '@app/components/modals/UserSettingsModal';
import {Routes} from '@app/Routes';
import type {QuickSwitcherExecutableResult} from '@app/stores/QuickSwitcherStore';
import QuickSwitcherStore from '@app/stores/QuickSwitcherStore';
import SelectedChannelStore from '@app/stores/SelectedChannelStore';
import {goToMessage, parseMessagePath} from '@app/utils/MessageNavigator';
import * as RouterUtils from '@app/utils/RouterUtils';
import {FAVORITES_GUILD_ID, ME} from '@fluxer/constants/src/AppConstants';
import {QuickSwitcherResultTypes} from '@fluxer/constants/src/QuickSwitcherConstants';

const QUICK_SWITCHER_MODAL_KEY = 'quick_switcher';

export function hide(): void {
	QuickSwitcherStore.hide();
}

export function search(query: string): void {
	QuickSwitcherStore.search(query);
}

export function select(selectedIndex: number): void {
	QuickSwitcherStore.select(selectedIndex);
}

export function moveSelection(direction: 'up' | 'down'): void {
	const nextIndex = QuickSwitcherStore.findNextSelectableIndex(direction);
	select(nextIndex);
}

export async function confirmSelection(): Promise<void> {
	const result = QuickSwitcherStore.getSelectedResult();
	if (!result) return;
	await switchTo(result);
}

export async function switchTo(result: QuickSwitcherExecutableResult): Promise<void> {
	try {
		switch (result.type) {
			case QuickSwitcherResultTypes.USER: {
				if (result.dmChannelId) {
					NavigationActionCreators.selectChannel(ME, result.dmChannelId);
				} else {
					await PrivateChannelActionCreators.openDMChannel(result.user.id);
				}
				break;
			}
			case QuickSwitcherResultTypes.GROUP_DM: {
				NavigationActionCreators.selectChannel(ME, result.channel.id);
				break;
			}
			case QuickSwitcherResultTypes.TEXT_CHANNEL: {
				if (result.viewContext === FAVORITES_GUILD_ID) {
					NavigationActionCreators.selectChannel(FAVORITES_GUILD_ID, result.channel.id);
				} else if (result.guild) {
					NavigationActionCreators.selectChannel(result.guild.id, result.channel.id);
				} else {
					NavigationActionCreators.selectChannel(ME, result.channel.id);
				}
				break;
			}
			case QuickSwitcherResultTypes.VOICE_CHANNEL: {
				if (result.viewContext === FAVORITES_GUILD_ID) {
					NavigationActionCreators.selectChannel(FAVORITES_GUILD_ID, result.channel.id);
				} else if (result.guild) {
					NavigationActionCreators.selectChannel(result.guild.id, result.channel.id);
				}
				break;
			}
			case QuickSwitcherResultTypes.GUILD: {
				const channelId = SelectedChannelStore.selectedChannelIds.get(result.guild.id);
				NavigationActionCreators.selectGuild(result.guild.id, channelId);
				break;
			}
			case QuickSwitcherResultTypes.VIRTUAL_GUILD: {
				if (result.virtualGuildType === 'favorites') {
					const validChannelId = SelectedChannelStore.getValidatedFavoritesChannel();
					NavigationActionCreators.selectGuild(FAVORITES_GUILD_ID, validChannelId ?? undefined);
				} else if (result.virtualGuildType === 'home') {
					const dmChannelId = SelectedChannelStore.selectedChannelIds.get(ME);
					NavigationActionCreators.selectGuild(ME, dmChannelId);
				}
				break;
			}
			case QuickSwitcherResultTypes.SETTINGS: {
				const initialTab = result.settingsTab.type;
				const initialSubtab = result.settingsSubtab?.type;

				ModalActionCreators.push(
					modal(() => <UserSettingsModal initialTab={initialTab} initialSubtab={initialSubtab} />),
				);
				break;
			}
			case QuickSwitcherResultTypes.QUICK_ACTION: {
				result.action();
				break;
			}
			case QuickSwitcherResultTypes.LINK: {
				const parsed = parseMessagePath(result.path);
				if (parsed) {
					const viewContext = result.path.startsWith(Routes.favoritesChannel(parsed.channelId))
						? 'favorites'
						: undefined;
					goToMessage(parsed.channelId, parsed.messageId, {viewContext});
				} else {
					RouterUtils.transitionTo(result.path);
				}
				break;
			}
			default:
				break;
		}
	} finally {
		hide();
	}
}

export function getModalKey(): string {
	return QUICK_SWITCHER_MODAL_KEY;
}
