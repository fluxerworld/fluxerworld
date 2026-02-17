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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import {UnifiedBadge as Badge} from '@fluxer/ui/src/components/Badge';
import {Checkbox, Input} from '@fluxer/ui/src/components/Form';
import type {FC} from 'hono/jsx';

export interface VoiceRestrictions {
	vip_only: boolean;
	required_guild_features: Array<string>;
	allowed_guild_ids: Array<string>;
}

export interface VoiceStatusBadgesProps {
	vip_only: boolean;
	has_features: boolean;
	has_guild_ids: boolean;
}

export const VoiceStatusBadges: FC<VoiceStatusBadgesProps> = ({vip_only, has_features, has_guild_ids}) => (
	<>
		{vip_only && <Badge label="VIP ONLY" tone="purple" intensity="subtle" rounded="default" />}
		{has_features && <Badge label="FEATURES" tone="orange" intensity="subtle" rounded="default" />}
		{has_guild_ids && <Badge label="GUILD IDS" tone="warning" intensity="subtle" rounded="default" />}
	</>
);

export interface VoiceFeaturesListProps {
	features: Array<string>;
}

export const VoiceFeaturesList: FC<VoiceFeaturesListProps> = ({features}) =>
	features.length > 0 ? (
		<div>
			<span class="font-medium text-neutral-600 text-xs">Required Features: </span>
			<span class="text-neutral-700 text-xs">{features.join(', ')}</span>
		</div>
	) : null;

export interface VoiceGuildIdsListProps {
	guild_ids: Array<string>;
}

export const VoiceGuildIdsList: FC<VoiceGuildIdsListProps> = ({guild_ids}) =>
	guild_ids.length > 0 ? (
		<div>
			<span class="font-medium text-neutral-600 text-xs">Allowed Guilds: </span>
			<span class="text-neutral-700 text-xs">{guild_ids.join(', ')}</span>
		</div>
	) : null;

export interface VoiceRestrictionFieldsProps {
	id_prefix?: string;
	restrictions: VoiceRestrictions;
}

export const VoiceRestrictionFields: FC<VoiceRestrictionFieldsProps> = ({id_prefix = '', restrictions}) => {
	const {vip_only, required_guild_features, allowed_guild_ids} = restrictions;

	return (
		<div class="space-y-3 border-neutral-200 border-t pt-3">
			<h4 class="font-medium text-neutral-700 text-sm">Access Restrictions</h4>
			<Checkbox name="vip_only" value="true" label="VIP Only" checked={vip_only} />
			<Input
				label="Required Guild Features"
				name="required_guild_features"
				type="text"
				value={required_guild_features.join(', ')}
				placeholder="e.g. FEATURE_1, FEATURE_2"
				id={id_prefix ? `${id_prefix}-required-guild-features` : undefined}
				helper="Separate features with commas."
			/>
			<Input
				label="Allowed Guild IDs"
				name="allowed_guild_ids"
				type="text"
				value={allowed_guild_ids.join(', ')}
				placeholder="e.g. 123456789, 987654321"
				id={id_prefix ? `${id_prefix}-allowed-guild-ids` : undefined}
				helper="Separate guild IDs with commas."
			/>
		</div>
	);
};
