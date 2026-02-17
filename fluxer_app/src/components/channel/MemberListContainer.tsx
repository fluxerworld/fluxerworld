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

import styles from '@app/components/channel/MemberListContainer.module.css';
import {Scroller, type ScrollerHandle} from '@app/components/uikit/Scroller';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import type {UIEvent} from 'react';

type ScrollerResizeType = 'container' | 'content';

interface MemberListContainerProps {
	channelId: string;
	children: React.ReactNode;
	scrollerRef?: React.RefObject<ScrollerHandle | null>;
	onScroll?: (event: UIEvent<HTMLDivElement>) => void;
	onResize?: (entry: ResizeObserverEntry, type: ScrollerResizeType) => void;
}

export const MemberListContainer: React.FC<MemberListContainerProps> = observer(function MemberListContainer({
	channelId,
	children,
	scrollerRef,
	onScroll,
	onResize,
}) {
	return (
		<div className={styles.memberListContainer}>
			<Scroller
				ref={scrollerRef}
				className={styles.memberListScroller}
				key={`member-list-scroller-${channelId}`}
				onScroll={onScroll}
				onResize={onResize}
				fade={false}
			>
				{children}
			</Scroller>
		</div>
	);
});
