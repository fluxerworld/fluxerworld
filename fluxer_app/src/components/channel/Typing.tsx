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

import styles from '@app/styles/Typing.module.css';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type {CSSProperties} from 'react';
import {useMemo} from 'react';

interface TypingProps {
	className?: string;
	size?: number;
	style?: CSSProperties;
	color?: string;
}

export const Typing = observer(
	({className, size = 40, style, color = 'var(--typing-indicator-color, var(--text-chat))'}: TypingProps) => {
		const {t} = useLingui();
		const scale = useMemo(() => size / 40, [size]);
		const x = useMemo(() => 3.75 * scale, [scale]);
		const y = useMemo(() => 7.5 * scale, [scale]);
		const width = useMemo(() => 17.5 * scale, [scale]);
		const height = useMemo(() => 5 * scale, [scale]);
		const viewBoxWidth = 20;
		const viewBoxHeight = 5;
		const mergedStyle = useMemo(() => ({...(style || {}), color}), [style, color]);

		return (
			<svg
				x={x}
				y={y}
				width={width}
				height={height}
				viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
				className={className}
				style={mergedStyle}
				role="img"
				aria-label={t`Typing indicator`}
			>
				<circle cx="2.5" cy="2.5" r="2.5" className={styles.dot} fill={color} />
				<circle cx="8.75" cy="2.5" r="2.5" className={styles.dot} fill={color} />
				<circle cx={15} cy="2.5" r="2.5" className={styles.dot} fill={color} />
			</svg>
		);
	},
);
