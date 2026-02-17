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

import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {useMemo} from 'react';

interface SimpleCommand {
	type: 'simple';
	name: string;
	content: string;
	description: string;
}

interface ActionCommand {
	type: 'action';
	name: string;
	description: string;
	permission?: bigint;
	requiresGuild?: boolean;
}

export type Command = SimpleCommand | ActionCommand;

export function useCommands(): Array<Command> {
	const {t} = useLingui();

	return useMemo(
		(): Array<Command> => [
			{type: 'simple', name: '/shrug', content: '¯\\_(ツ)_/¯', description: t`Appends ¯\\_(ツ)_/¯ to your message.`},
			{
				type: 'simple',
				name: '/tableflip',
				content: '(╯°□°)╯︵ ┻━┻',
				description: t`Appends (╯°□°)╯︵ ┻━┻ to your message.`,
			},
			{
				type: 'simple',
				name: '/unflip',
				content: '┬─┬ ノ( ゜-゜ノ)',
				description: t`Appends ┬─┬ ノ( ゜-゜ノ) to your message.`,
			},
			{type: 'action', name: '/me', description: t`Send an action message (wraps in italics).`},
			{type: 'action', name: '/spoiler', description: t`Send a spoiler message (wraps in spoiler tags).`},
			{
				type: 'action',
				name: '/tts',
				description: t`Send a text-to-speech message.`,
				permission: Permissions.SEND_TTS_MESSAGES,
			},
			{
				type: 'action',
				name: '/nick',
				description: t`Change your nickname in this community.`,
				permission: Permissions.CHANGE_NICKNAME,
				requiresGuild: true,
			},
			{
				type: 'action',
				name: '/kick',
				description: t`Kick a member from this community.`,
				permission: Permissions.KICK_MEMBERS,
				requiresGuild: true,
			},
			{
				type: 'action',
				name: '/ban',
				description: t`Ban a member from this community.`,
				permission: Permissions.BAN_MEMBERS,
				requiresGuild: true,
			},
			{type: 'action', name: '/msg', description: t`Send a direct message to a user.`},
			{type: 'action', name: '/saved', description: t`Send a saved media item.`},
			{type: 'action', name: '/sticker', description: t`Send a sticker.`},
			{type: 'action', name: '/gif', description: t`Search for and send a GIF.`},
		],
		[t],
	);
}
