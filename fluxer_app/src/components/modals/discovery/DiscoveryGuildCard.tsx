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

import type {DiscoveryGuild} from '@app/actions/DiscoveryActionCreators';
import * as DiscoveryActionCreators from '@app/actions/DiscoveryActionCreators';
import {GuildBadge} from '@app/components/guild/GuildBadge';
import styles from '@app/components/modals/discovery/DiscoveryGuildCard.module.css';
import {GuildIcon} from '@app/components/popouts/GuildIcon';
import {Button} from '@app/components/uikit/button/Button';
import GuildStore from '@app/stores/GuildStore';
import {getCurrentLocale} from '@app/utils/LocaleUtils';
import type {DiscoveryCategory} from '@fluxer/constants/src/DiscoveryConstants';
import {DiscoveryCategoryLabels} from '@fluxer/constants/src/DiscoveryConstants';
import {formatNumber} from '@fluxer/number_utils/src/NumberFormatting';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback, useState} from 'react';

interface DiscoveryGuildCardProps {
	guild: DiscoveryGuild;
}

export const DiscoveryGuildCard = observer(function DiscoveryGuildCard({guild}: DiscoveryGuildCardProps) {
	const {t} = useLingui();
	const [joining, setJoining] = useState(false);
	const isAlreadyMember = GuildStore.getGuild(guild.id) != null;
	const categoryLabel = DiscoveryCategoryLabels[guild.category_id as DiscoveryCategory] ?? '';
	const memberCount = formatNumber(guild.member_count, getCurrentLocale());
	const onlineCount = formatNumber(guild.online_count, getCurrentLocale());

	const handleJoin = useCallback(async () => {
		if (joining || isAlreadyMember) return;
		setJoining(true);
		try {
			await DiscoveryActionCreators.joinGuild(guild.id);
		} catch {
			setJoining(false);
		}
	}, [guild.id, joining, isAlreadyMember]);

	return (
		<div className={styles.card}>
			<div className={styles.cardBody}>
				<div className={styles.header}>
					<GuildIcon id={guild.id} name={guild.name} icon={guild.icon} className={styles.icon} />
					<div className={styles.titleRow}>
						<h3 className={styles.name}>{guild.name}</h3>
						<GuildBadge features={guild.features} />
					</div>
				</div>
				{categoryLabel && <span className={styles.category}>{categoryLabel}</span>}
				<p className={styles.description}>{guild.description || t`No description provided.`}</p>
			</div>
			<div className={styles.footer}>
				<div className={styles.stats}>
					{guild.online_count > 0 && (
						<div className={styles.stat}>
							<div className={styles.statDotOnline} />
							<span className={styles.statText}>{t`${onlineCount} Online`}</span>
						</div>
					)}
					<div className={styles.stat}>
						<div className={styles.statDotMembers} />
						<span className={styles.statText}>
							{guild.member_count === 1 ? t`${memberCount} Member` : t`${memberCount} Members`}
						</span>
					</div>
				</div>
				<Button variant="primary" small onClick={handleJoin} disabled={joining || isAlreadyMember}>
					{isAlreadyMember ? t`Joined` : t`Join`}
				</Button>
			</div>
		</div>
	);
});
