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

import {GuildIcon} from '@app/components/popouts/GuildIcon';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import type {GuildRecord} from '@app/records/GuildRecord';
import GuildListStore from '@app/stores/GuildListStore';
import GuildStore from '@app/stores/GuildStore';
import type {Guild} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import {Trans, useLingui} from '@lingui/react/macro';
import {SealCheckIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';

type EmojiAttributionType =
	| 'default'
	| 'custom_invite_required'
	| 'custom_unknown'
	| 'custom_guild'
	| 'custom_pack';
type EmojiGuild = Guild | GuildRecord;

export interface EmojiAttribution {
	type: EmojiAttributionType;
	guild?: EmojiGuild | null;
	isVerified?: boolean;
	packName?: string | null;
}

export interface EmojiAttributionSource {
	emojiId?: string | null;
	guildId?: string | null;
	guild?: EmojiGuild | null;
	emojiName?: string | null;
	packId?: string | null;
	packName?: string | null;
}

const getIsVerified = (guild?: EmojiGuild | null): boolean => {
	if (!guild) return false;
	const features = (guild as GuildRecord).features ?? (guild as Guild).features;
	if (!features) return false;
	if (Array.isArray(features)) {
		return features.includes('VERIFIED');
	}
	if (features instanceof Set) {
		return features.has('VERIFIED');
	}
	return false;
};

export const getEmojiAttribution = ({
	emojiId,
	guildId,
	guild,
	packId,
	packName,
}: EmojiAttributionSource): EmojiAttribution => {
	if (!emojiId) {
		return {type: 'default'};
	}

	if (packId) {
		return {type: 'custom_pack', packName: packName ?? null};
	}

	const resolvedGuild = guildId ? (guild ?? GuildStore.getGuild(guildId)) : null;
	const isVerified = getIsVerified(resolvedGuild);

	if (resolvedGuild) {
		return {type: 'custom_guild', guild: resolvedGuild, isVerified};
	}

	const isMember = guildId ? GuildListStore.guilds.some((candidate) => candidate.id === guildId) : null;

	if (isMember === false) {
		return {type: 'custom_invite_required'};
	}

	return {type: 'custom_unknown'};
};

interface EmojiAttributionSubtextProps {
	attribution: EmojiAttribution;
	classes?: {
		container?: string;
		text?: string;
		guildRow?: string;
		guildIcon?: string;
		guildName?: string;
		verifiedIcon?: string;
	};
}

export const EmojiAttributionSubtext = observer(function EmojiAttributionSubtext({
	attribution,
	classes = {},
}: EmojiAttributionSubtextProps) {
	const {t} = useLingui();

	if (attribution.type === 'default') {
		return (
			<div className={classes.container}>
				<span className={classes.text}>
					<Trans>This is a default emoji on Fluxer.</Trans>
				</span>
			</div>
		);
	}

	if (attribution.type === 'custom_pack') {
		return (
			<div className={classes.container}>
				<span className={classes.text}>
					{attribution.packName ? (
						<Trans>This is a custom emoji from the {attribution.packName} pack.</Trans>
					) : (
						<Trans>This is a custom emoji from an expression pack.</Trans>
					)}
				</span>
			</div>
		);
	}

	if (attribution.type === 'custom_invite_required') {
		return (
			<div className={classes.container}>
				<span className={classes.text}>
					<Trans>This is a custom emoji from a community. Ask the author for an invite to use this emoji.</Trans>
				</span>
			</div>
		);
	}

	if (attribution.type === 'custom_unknown' || !attribution.guild) {
		return (
			<div className={classes.container}>
				<span className={classes.text}>
					<Trans>This is a custom emoji from a community.</Trans>
				</span>
			</div>
		);
	}

	return (
		<div className={classes.container}>
			<span className={classes.text}>
				<Trans>This is a custom emoji from</Trans>
			</span>
			<div className={classes.guildRow}>
				<div className={classes.guildIcon}>
					<GuildIcon
						id={attribution.guild.id}
						name={attribution.guild.name}
						icon={attribution.guild.icon}
						sizePx={20}
					/>
				</div>
				<span className={classes.guildName}>{attribution.guild.name}</span>
				{attribution.isVerified && (
					<Tooltip text={t`Verified Community`} position="top">
						<SealCheckIcon className={classes.verifiedIcon} />
					</Tooltip>
				)}
			</div>
		</div>
	);
});

EmojiAttributionSubtext.displayName = 'EmojiAttributionSubtext';
