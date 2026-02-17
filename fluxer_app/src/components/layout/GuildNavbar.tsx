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

import * as UserGuildSettingsActionCreators from '@app/actions/UserGuildSettingsActionCreators';
import {TopNagbarContext} from '@app/components/layout/app_layout/TopNagbarContext';
import {ChannelListContent} from '@app/components/layout/ChannelListContent';
import {GuildHeader} from '@app/components/layout/GuildHeader';
import {GuildSidebar} from '@app/components/layout/GuildSidebar';
import {useNativePlatform} from '@app/hooks/useNativePlatform';
import type {GuildRecord} from '@app/records/GuildRecord';
import ChannelStore from '@app/stores/ChannelStore';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {useMotionValue} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import {useContext, useEffect, useMemo} from 'react';
import {useHotkeys} from 'react-hotkeys-hook';

export const GuildNavbar = observer(({guild}: {guild: GuildRecord}) => {
	const scrollY = useMotionValue(0);
	const {isNative, isWindows, isLinux} = useNativePlatform();
	const hasTopNagbar = useContext(TopNagbarContext);
	const shouldRoundTopLeft = isNative && (isWindows || isLinux) && !hasTopNagbar;

	useEffect(() => {
		scrollY.set(0);
	}, [guild.id, scrollY]);

	const channels = ChannelStore.getGuildChannels(guild.id);

	const categoryIds = useMemo(() => {
		return channels.filter((ch) => ch.type === ChannelTypes.GUILD_CATEGORY).map((ch) => ch.id);
	}, [channels]);

	useHotkeys(
		'mod+shift+a',
		() => {
			if (categoryIds.length > 0) {
				UserGuildSettingsActionCreators.toggleAllCategoriesCollapsed(guild.id, categoryIds);
			}
		},
		{
			enableOnFormTags: true,
			enableOnContentEditable: true,
			preventDefault: true,
		},
		[guild.id, categoryIds],
	);

	return (
		<GuildSidebar
			roundTopLeft={shouldRoundTopLeft}
			header={<GuildHeader guild={guild} />}
			content={<ChannelListContent guild={guild} scrollY={scrollY} />}
		/>
	);
});
