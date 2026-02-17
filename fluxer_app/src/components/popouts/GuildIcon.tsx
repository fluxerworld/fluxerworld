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

import styles from '@app/components/popouts/GuildIcon.module.css';
import {useHover} from '@app/hooks/useHover';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import {getInitialsLength} from '@app/utils/GuildInitialsUtils';
import * as ImageCacheUtils from '@app/utils/ImageCacheUtils';
import * as StringUtils from '@app/utils/StringUtils';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useEffect, useMemo, useState} from 'react';

interface GuildIconProps {
	id: string;
	name: string;
	icon: string | null;
	className?: string;
	sizePx?: number;
	containerProps?: React.HTMLAttributes<HTMLElement> & {'data-jump-link-guild-icon'?: string};
}

type GuildIconStyleVars = React.CSSProperties & {
	'--guild-icon-size'?: string;
	'--guild-icon-image'?: string;
};

export const GuildIcon = observer(function GuildIcon({
	id,
	name,
	icon,
	className,
	sizePx,
	containerProps,
}: GuildIconProps) {
	const initials = useMemo(() => StringUtils.getInitialsFromName(name), [name]);
	const initialsLength = useMemo(() => getInitialsLength(initials), [initials]);
	const [hoverRef, isHovering] = useHover();

	const iconUrl = useMemo(() => (icon ? AvatarUtils.getGuildIconURL({id, icon}) : null), [id, icon]);
	const hoverIconUrl = useMemo(() => (icon ? AvatarUtils.getGuildIconURL({id, icon}, true) : null), [id, icon]);

	const [isStaticLoaded, setIsStaticLoaded] = useState(() => (iconUrl ? ImageCacheUtils.hasImage(iconUrl) : false));
	const [isAnimatedLoaded, setIsAnimatedLoaded] = useState(() =>
		hoverIconUrl ? ImageCacheUtils.hasImage(hoverIconUrl) : false,
	);
	const [shouldPlayAnimated, setShouldPlayAnimated] = useState(false);

	useEffect(() => {
		setIsStaticLoaded(iconUrl ? ImageCacheUtils.hasImage(iconUrl) : false);
		setIsAnimatedLoaded(hoverIconUrl ? ImageCacheUtils.hasImage(hoverIconUrl) : false);
		setShouldPlayAnimated(false);
	}, [iconUrl, hoverIconUrl]);

	useEffect(() => {
		if (!iconUrl || isStaticLoaded) return;

		let cancelled = false;
		ImageCacheUtils.loadImage(iconUrl, () => {
			if (!cancelled) setIsStaticLoaded(true);
		});
		return () => {
			cancelled = true;
		};
	}, [iconUrl, isStaticLoaded]);

	useEffect(() => {
		if (!isHovering || !hoverIconUrl || isAnimatedLoaded) return;

		let cancelled = false;
		ImageCacheUtils.loadImage(hoverIconUrl, () => {
			if (!cancelled) setIsAnimatedLoaded(true);
		});
		return () => {
			cancelled = true;
		};
	}, [isHovering, hoverIconUrl, isAnimatedLoaded]);

	useEffect(() => {
		setShouldPlayAnimated(Boolean(isHovering && isAnimatedLoaded));
	}, [isHovering, isAnimatedLoaded]);

	const activeUrl = shouldPlayAnimated && hoverIconUrl ? hoverIconUrl : iconUrl;

	const styleVars: GuildIconStyleVars = {};
	if (sizePx != null) {
		styleVars['--guild-icon-size'] = `${sizePx}px`;
	}
	if (isStaticLoaded && activeUrl) {
		styleVars['--guild-icon-image'] = `url(${activeUrl})`;
	}

	const reducedMotion = AccessibilityStore.useReducedMotion;

	return (
		<div
			ref={hoverRef}
			className={clsx(styles.container, className, !icon && styles.containerNoIcon)}
			{...containerProps}
			data-initials-length={initialsLength}
			data-reduced-motion={reducedMotion}
			style={styleVars}
		>
			{!icon && <span className={styles.initials}>{initials}</span>}
		</div>
	);
});
