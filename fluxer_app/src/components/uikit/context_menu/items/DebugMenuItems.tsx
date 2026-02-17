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
import {ChannelDebugModal} from '@app/components/debug/ChannelDebugModal';
import {GuildDebugModal} from '@app/components/debug/GuildDebugModal';
import {GuildMemberDebugModal} from '@app/components/debug/GuildMemberDebugModal';
import {UserDebugModal} from '@app/components/debug/UserDebugModal';
import {DebugIcon} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {GuildMemberRecord} from '@app/records/GuildMemberRecord';
import type {GuildRecord} from '@app/records/GuildRecord';
import type {UserRecord} from '@app/records/UserRecord';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback} from 'react';

interface BaseDebugMenuItemProps {
	onClose: () => void;
}

type DebugUserMenuItemProps = BaseDebugMenuItemProps & {
	user: UserRecord;
};

export const DebugUserMenuItem: React.FC<DebugUserMenuItemProps> = observer(({user, onClose}) => {
	const {t} = useLingui();
	const handleDebug = useCallback(() => {
		ModalActionCreators.push(modal(() => <UserDebugModal title={t`User Debug`} user={user} />));
		onClose();
	}, [user, onClose]);

	return (
		<MenuItem icon={<DebugIcon />} onClick={handleDebug}>
			{t`Debug User`}
		</MenuItem>
	);
});

type DebugChannelMenuItemProps = BaseDebugMenuItemProps & {
	channel: ChannelRecord;
};

export const DebugChannelMenuItem: React.FC<DebugChannelMenuItemProps> = observer(({channel, onClose}) => {
	const {t} = useLingui();
	const handleDebug = useCallback(() => {
		ModalActionCreators.push(modal(() => <ChannelDebugModal title={t`Channel Debug`} channel={channel} />));
		onClose();
	}, [channel, onClose]);

	return (
		<MenuItem icon={<DebugIcon />} onClick={handleDebug}>
			{t`Debug Channel`}
		</MenuItem>
	);
});

type DebugGuildMenuItemProps = BaseDebugMenuItemProps & {
	guild: GuildRecord;
};

export const DebugGuildMenuItem: React.FC<DebugGuildMenuItemProps> = observer(({guild, onClose}) => {
	const {t} = useLingui();
	const handleDebug = useCallback(() => {
		ModalActionCreators.push(modal(() => <GuildDebugModal title={t`Community Debug`} guild={guild} />));
		onClose();
	}, [guild, onClose]);

	return (
		<MenuItem icon={<DebugIcon />} onClick={handleDebug}>
			{t`Debug Community`}
		</MenuItem>
	);
});

type DebugGuildMemberMenuItemProps = BaseDebugMenuItemProps & {
	member: GuildMemberRecord;
};

export const DebugGuildMemberMenuItem: React.FC<DebugGuildMemberMenuItemProps> = observer(({member, onClose}) => {
	const {t} = useLingui();
	const handleDebug = useCallback(() => {
		ModalActionCreators.push(modal(() => <GuildMemberDebugModal title={t`Community Member Debug`} member={member} />));
		onClose();
	}, [member, onClose]);

	return (
		<MenuItem icon={<DebugIcon />} onClick={handleDebug}>
			{t`Debug Member`}
		</MenuItem>
	);
});
