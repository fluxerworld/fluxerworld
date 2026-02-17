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

import {
	SettingsTabContainer,
	SettingsTabHeader,
	SettingsTabSection,
} from '@app/components/modals/shared/SettingsTabLayout';
import styles from '@app/components/modals/tabs/LimitsConfigTab.module.css';
import {Button} from '@app/components/uikit/button/Button';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {PASSWORD_MANAGER_IGNORE_ATTRIBUTES} from '@app/lib/PasswordManagerAutocomplete';
import LimitOverrideStore from '@app/stores/LimitOverrideStore';
import {LimitResolver} from '@app/utils/limits/LimitResolverAdapter';
import type {LimitCategory, LimitKeyMetadata} from '@fluxer/constants/src/LimitConfigMetadata';
import {LIMIT_CATEGORY_LABELS, LIMIT_KEY_METADATA} from '@fluxer/constants/src/LimitConfigMetadata';
import {Trans, useLingui} from '@lingui/react/macro';
import {XIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type {FC} from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';

const CATEGORY_ORDER: Array<LimitCategory> = [
	'features',
	'messages',
	'guilds',
	'channels',
	'expressions',
	'files',
	'social',
];

const METADATA_BY_CATEGORY: Record<LimitCategory, Array<LimitKeyMetadata>> = (() => {
	const result: Record<LimitCategory, Array<LimitKeyMetadata>> = {
		features: [],
		messages: [],
		guilds: [],
		channels: [],
		expressions: [],
		files: [],
		social: [],
	};

	for (const metadata of Object.values(LIMIT_KEY_METADATA)) {
		result[metadata.category].push(metadata);
	}

	for (const category of CATEGORY_ORDER) {
		result[category].sort((a, b) => a.label.localeCompare(b.label));
	}

	return result;
})();

const LimitsConfigTab: FC = observer(() => {
	const {t} = useLingui();
	const overrideEntries = LimitOverrideStore.getAllOverrides();
	const overrideCount = Object.keys(overrideEntries).length;

	const activeCategories = useMemo(
		() => CATEGORY_ORDER.filter((category) => METADATA_BY_CATEGORY[category].length > 0),
		[],
	);

	return (
		<SettingsTabContainer>
			<SettingsTabHeader
				title={t`Limits Config`}
				description={t`Override instance limits locally for testing. Changes only affect your client.`}
			/>
			{overrideCount > 0 && (
				<div className={styles.toolbar}>
					<span className={styles.overrideCount}>
						<Trans>{overrideCount} active</Trans>
					</span>
					<Button variant="secondary" compact superCompact onClick={() => LimitOverrideStore.clearAll()}>
						<Trans>Clear all</Trans>
					</Button>
				</div>
			)}
			{activeCategories.map((category) => (
				<SettingsTabSection key={category} title={LIMIT_CATEGORY_LABELS[category]}>
					<div className={styles.limitList}>
						{METADATA_BY_CATEGORY[category].map((item) => (
							<LimitRow key={item.key} metadata={item} />
						))}
					</div>
				</SettingsTabSection>
			))}
		</SettingsTabContainer>
	);
});

const LimitRow: FC<{metadata: LimitKeyMetadata}> = observer(({metadata}) => {
	const {t} = useLingui();
	const overrideValue = LimitOverrideStore.getOverride(metadata.key);
	const [draft, setDraft] = useState(overrideValue !== null ? overrideValue.toString() : '');
	const resolvedValue = LimitResolver.resolve({key: metadata.key, fallback: 0});
	const hasOverride = overrideValue !== null;

	useEffect(() => {
		setDraft(overrideValue !== null ? overrideValue.toString() : '');
	}, [overrideValue]);

	const handleApplyOverride = useCallback(() => {
		const normalized = draft.trim();
		if (normalized === '') {
			LimitOverrideStore.clearOverride(metadata.key);
			return;
		}

		const parsed = Number(normalized);
		if (!Number.isFinite(parsed) || parsed < 0) {
			return;
		}

		LimitOverrideStore.setOverride(metadata.key, Math.floor(parsed));
	}, [draft, metadata.key]);

	const handleClearOverride = useCallback(() => {
		LimitOverrideStore.clearOverride(metadata.key);
	}, [metadata.key]);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>) => {
			if (event.key === 'Enter') {
				handleApplyOverride();
			}
		},
		[handleApplyOverride],
	);

	return (
		<div className={clsx(styles.row, hasOverride && styles.rowActive)}>
			<div className={styles.rowLabel}>
				<span className={styles.label}>{metadata.label}</span>
				<span className={styles.scope}>{metadata.scope}</span>
			</div>
			<div className={styles.rowControls}>
				<span className={clsx(styles.value, hasOverride && styles.valueOverridden)}>{resolvedValue}</span>
				<FocusRing offset={-2}>
					<input
						className={styles.input}
						type="number"
						{...PASSWORD_MANAGER_IGNORE_ATTRIBUTES}
						min="0"
						value={draft}
						placeholder={t`Override`}
						aria-label={t`Override ${metadata.label}`}
						onChange={(event) => setDraft(event.target.value)}
						onKeyDown={handleKeyDown}
						onBlur={handleApplyOverride}
					/>
				</FocusRing>
				{hasOverride && (
					<button
						type="button"
						className={styles.clearButton}
						onClick={handleClearOverride}
						aria-label={t`Clear override`}
					>
						<XIcon size={14} weight="bold" />
					</button>
				)}
			</div>
		</div>
	);
});

export default LimitsConfigTab;
