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

import styles from '@app/components/guild/GuildBadge.module.css';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {GuildFeatures} from '@fluxer/constants/src/GuildConstants';
import {useLingui} from '@lingui/react/macro';
import {InfinityIcon, SealCheckIcon} from '@phosphor-icons/react';

interface GuildBadgeProps {
	readonly features: ReadonlySet<string> | ReadonlyArray<string>;
	readonly variant?: 'default' | 'large' | 'banner';
	readonly tooltipPosition?: 'top' | 'bottom';
	readonly showTooltip?: boolean;
}

function hasFeature(features: ReadonlySet<string> | ReadonlyArray<string>, feature: string): boolean {
	if (Array.isArray(features)) {
		return features.includes(feature);
	}
	return (features as ReadonlySet<string>).has(feature);
}

export function GuildBadge({
	features,
	variant = 'default',
	tooltipPosition = 'top',
	showTooltip = true,
}: GuildBadgeProps) {
	const {t} = useLingui();

	const isVerified = hasFeature(features, GuildFeatures.VERIFIED);
	const isPartnered = hasFeature(features, GuildFeatures.PARTNERED);

	if (!isVerified && !isPartnered) {
		return null;
	}

	const tooltipText = isPartnered
		? isVerified
			? t`Verified & Partnered Community`
			: t`Partnered Community`
		: t`Verified Community`;

	let icon: React.JSX.Element;
	if (isPartnered) {
		const partnerClassName =
			variant === 'banner'
				? styles.partnerBadgeBanner
				: variant === 'large'
					? styles.partnerBadgeLarge
					: styles.partnerBadge;
		icon = (
			<span className={partnerClassName}>
				<InfinityIcon className={styles.partnerIcon} weight="bold" />
			</span>
		);
	} else {
		const verifiedClassName =
			variant === 'banner' ? styles.badgeBanner : variant === 'large' ? styles.badgeLarge : styles.badge;
		icon = <SealCheckIcon className={verifiedClassName} />;
	}

	if (!showTooltip) {
		return icon;
	}

	return (
		<Tooltip text={tooltipText} position={tooltipPosition}>
			{icon}
		</Tooltip>
	);
}
