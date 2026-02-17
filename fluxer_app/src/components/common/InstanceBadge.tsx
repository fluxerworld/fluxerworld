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

import styles from '@app/components/common/InstanceBadge.module.css';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {GlobeIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useMemo, useState} from 'react';

interface InstanceBadgeProps {
	instanceDomain: string;
	size?: 'small' | 'medium';
	showTooltip?: boolean;
	className?: string;
}

type FaviconLoadState = 'loading' | 'loaded' | 'error';

const faviconCache = new Map<string, {state: FaviconLoadState; url: string | null}>();

function getFaviconUrl(instanceDomain: string): string {
	return `https://${instanceDomain}/favicon.ico`;
}

export const InstanceBadge = observer(function InstanceBadge({
	instanceDomain,
	size = 'small',
	showTooltip = true,
	className,
}: InstanceBadgeProps) {
	const [faviconState, setFaviconState] = useState<FaviconLoadState>(() => {
		const cached = faviconCache.get(instanceDomain);
		return cached?.state ?? 'loading';
	});

	const faviconUrl = useMemo(() => getFaviconUrl(instanceDomain), [instanceDomain]);

	const handleImageLoad = useCallback(() => {
		faviconCache.set(instanceDomain, {state: 'loaded', url: faviconUrl});
		setFaviconState('loaded');
	}, [instanceDomain, faviconUrl]);

	const handleImageError = useCallback(() => {
		faviconCache.set(instanceDomain, {state: 'error', url: null});
		setFaviconState('error');
	}, [instanceDomain]);

	useEffect(() => {
		const cached = faviconCache.get(instanceDomain);
		if (cached) {
			setFaviconState(cached.state);
			return;
		}

		const img = new Image();
		img.onload = handleImageLoad;
		img.onerror = handleImageError;
		img.src = faviconUrl;

		return () => {
			img.onload = null;
			img.onerror = null;
		};
	}, [instanceDomain, faviconUrl, handleImageLoad, handleImageError]);

	const iconSize = size === 'small' ? 12 : 18;

	const badgeContent = useMemo(() => {
		const containerClass = clsx(styles.badge, size === 'small' ? styles.small : styles.medium, className);

		if (faviconState === 'loaded') {
			return (
				<span className={containerClass}>
					<img src={faviconUrl} alt="" className={styles.favicon} aria-hidden="true" />
				</span>
			);
		}

		return (
			<span className={containerClass}>
				<GlobeIcon size={iconSize} weight="regular" className={styles.globeIcon} aria-hidden="true" />
			</span>
		);
	}, [faviconState, faviconUrl, size, iconSize, className]);

	if (!showTooltip) {
		return badgeContent;
	}

	return (
		<Tooltip text={instanceDomain} position="top">
			{badgeContent}
		</Tooltip>
	);
});
