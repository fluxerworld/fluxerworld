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

import * as CallActionCreators from '@app/actions/CallActionCreators';
import type {SelectOption} from '@app/components/form/Select';
import {Select as FormSelect} from '@app/components/form/Select';
import styles from '@app/components/voice/VoiceRegionSelector.module.css';
import {Logger} from '@app/lib/Logger';
import * as EmojiUtils from '@app/utils/EmojiUtils';
import type {RtcRegionResponse} from '@fluxer/schema/src/domains/channel/ChannelSchemas';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {useCallback, useEffect, useMemo, useState} from 'react';

const logger = new Logger('VoiceRegionSelector');

interface VoiceRegionSelectorProps {
	channelId?: string | null;
	currentRegion?: string | null;
	compact?: boolean;
}

interface RtcRegionOption extends SelectOption<string | null> {
	region: RtcRegionResponse;
}

export function VoiceRegionSelector({channelId, currentRegion, compact = false}: VoiceRegionSelectorProps) {
	const {t} = useLingui();

	const [regions, setRegions] = useState<Array<RtcRegionResponse>>([]);
	const [isChangingRegion, setIsChangingRegion] = useState(false);

	useEffect(() => {
		if (!channelId) {
			setRegions([]);
			return undefined;
		}

		let cancelled = false;
		CallActionCreators.fetchCallRegions(channelId)
			.then((fetchedRegions) => {
				if (!cancelled) setRegions(fetchedRegions);
			})
			.catch(() => {
				if (!cancelled) setRegions([]);
			});

		return () => {
			cancelled = true;
		};
	}, [channelId]);

	const getRegionDisplayName = useCallback(
		(regionId: string, regionName: string): string => {
			if (regionName && regionName !== regionId) {
				return regionName;
			}
			if (regionId === 'us-east') {
				return t`US East`;
			}
			if (regionId === 'eu-central') {
				return t`EU Central`;
			}
			return regionId
				.split('-')
				.map((part) => {
					const lower = part.toLowerCase();
					if (lower === 'us') return 'US';
					if (lower === 'eu') return 'EU';
					return `${lower.slice(0, 1).toUpperCase()}${lower.slice(1)}`;
				})
				.join(' ');
		},
		[t],
	);

	const options = useMemo<Array<RtcRegionOption>>(() => {
		const automatic: RtcRegionOption = {
			value: null,
			label: t`Automatic`,
			region: {id: '', name: '', emoji: ''},
		};
		const regionOptions = regions.map((region) => ({
			value: region.id,
			label: getRegionDisplayName(region.id, region.name),
			region,
		}));
		return [automatic, ...regionOptions];
	}, [getRegionDisplayName, regions, t]);

	const displayName = useMemo(() => {
		const regionData = regions.find((region) => region.id === currentRegion);
		if (regionData) return getRegionDisplayName(regionData.id, regionData.name);
		return currentRegion ?? t`Automatic`;
	}, [currentRegion, getRegionDisplayName, regions, t]);

	const selectDensity = compact ? 'compactOverlay' : 'default';

	const handleRegionSelect = useCallback(
		async (regionId: string | null) => {
			if (!channelId || isChangingRegion) return;

			setIsChangingRegion(true);
			try {
				await CallActionCreators.updateCallRegion(channelId, regionId);
			} catch (error) {
				logger.error('Failed to update region:', error);
			} finally {
				setIsChangingRegion(false);
			}
		},
		[channelId, isChangingRegion],
	);

	const selectedValue = useMemo(() => {
		if (!currentRegion) return null;
		return options.some((option) => option.value === currentRegion) ? currentRegion : null;
	}, [currentRegion, options]);

	const renderRegionOption = useCallback(
		(option: RtcRegionOption) => {
			if (compact) {
				return <span className={clsx(styles.regionName, styles.regionNameCompact)}>{option.label}</span>;
			}
			const emojiUrl = EmojiUtils.getEmojiURL(option.region.emoji);
			return (
				<div className={styles.regionOption}>
					{emojiUrl ? (
						<img src={emojiUrl} alt={option.label} className={styles.regionEmoji} />
					) : (
						<span className={styles.regionEmojiText}>{option.region.emoji}</span>
					)}
					<span className={clsx(styles.regionName, compact && styles.regionNameCompact)}>{option.label}</span>
				</div>
			);
		},
		[compact],
	);

	return (
		<div className={clsx(styles.regionSelectorContainer, compact && styles.regionSelectorContainerCompact)}>
			<FormSelect<string | null, false, RtcRegionOption>
				value={selectedValue}
				options={options}
				onChange={handleRegionSelect}
				disabled={regions.length === 0 || isChangingRegion}
				isSearchable={false}
				closeMenuOnSelect={true}
				menuPlacement="bottom"
				maxMenuHeight={compact ? 140 : 220}
				placeholder={displayName}
				density={selectDensity}
				className={compact ? styles.selectCompact : styles.select}
				renderOption={(option) => renderRegionOption(option)}
				renderValue={(option) => (option ? renderRegionOption(option as RtcRegionOption) : null)}
			/>
		</div>
	);
}
