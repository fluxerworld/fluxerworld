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

import headerStyles from '@app/components/bottomsheets/GuildHeaderBottomSheet.module.css';
import {MuteDurationSheet} from '@app/components/bottomsheets/MuteDurationSheet';
import {GuildIcon} from '@app/components/popouts/GuildIcon';
import {useGuildMenuData} from '@app/components/uikit/context_menu/items/GuildMenuData';
import {MenuBottomSheet} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import {useMuteSheet} from '@app/hooks/useMuteSheet';
import type {GuildRecord} from '@app/records/GuildRecord';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import GatewayConnectionStore from '@app/stores/gateway/GatewayConnectionStore';
import PresenceStore from '@app/stores/PresenceStore';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useEffect} from 'react';

interface GuildHeaderBottomSheetProps {
	isOpen: boolean;
	onClose: () => void;
	guild: GuildRecord;
}

export const GuildHeaderBottomSheet: React.FC<GuildHeaderBottomSheetProps> = observer(({isOpen, onClose, guild}) => {
	const {t} = useLingui();

	useEffect(() => {
		if (!isOpen) return;
		GatewayConnectionStore.syncGuildIfNeeded(guild.id, 'guild-header-bottom-sheet');
	}, [guild.id, isOpen]);

	const {muteSheetOpen, muteConfig, openMuteSheet, closeMuteSheet, handleMute, handleUnmute} = useMuteSheet({
		mode: 'guild',
		guildId: guild.id,
	});

	const {groups, isMuted, mutedText} = useGuildMenuData(guild, {
		onClose,
		onOpenMuteSheet: openMuteSheet,
	});

	const presenceCount = PresenceStore.getPresenceCount(guild.id);
	const memberCount = GuildMemberStore.getMemberCount(guild.id);

	const headerContent = (
		<div className={headerStyles.header}>
			<div className={headerStyles.avatarWrapper}>
				<GuildIcon id={guild.id} name={guild.name} icon={guild.icon} className={headerStyles.icon} sizePx={48} />
			</div>
			<div className={headerStyles.text}>
				<span className={headerStyles.title}>{guild.name}</span>
				<div className={headerStyles.stats}>
					<div className={headerStyles.stat}>
						<div className={`${headerStyles.statDot} ${headerStyles.statDotOnline}`} />
						<span className={headerStyles.statText}>{t`${presenceCount} Online`}</span>
					</div>
					<div className={headerStyles.stat}>
						<div className={`${headerStyles.statDot} ${headerStyles.statDotMembers}`} />
						<span className={headerStyles.statText}>
							{memberCount === 1 ? t`${memberCount} Member` : t`${memberCount} Members`}
						</span>
					</div>
				</div>
			</div>
		</div>
	);

	return (
		<>
			<MenuBottomSheet isOpen={isOpen} onClose={onClose} groups={groups} headerContent={headerContent} />

			<MuteDurationSheet
				isOpen={muteSheetOpen}
				onClose={closeMuteSheet}
				isMuted={isMuted}
				mutedText={mutedText ?? null}
				muteConfig={muteConfig}
				muteTitle={t`Mute Community`}
				unmuteTitle={t`Unmute Community`}
				onMute={handleMute}
				onUnmute={handleUnmute}
			/>
		</>
	);
});
