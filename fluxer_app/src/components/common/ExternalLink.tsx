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

import styles from '@app/components/common/ExternalLink.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {openExternalUrl} from '@app/utils/NativeUtils';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type {AnchorHTMLAttributes, FC, MouseEventHandler} from 'react';
import {useRef} from 'react';

type ExternalLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
	href: string;
	children: React.ReactNode;
};

export const ExternalLink: FC<ExternalLinkProps> = observer(({href, children, className, ...props}) => {
	const linkRef = useRef<HTMLAnchorElement>(null);

	const handleClick: MouseEventHandler<HTMLAnchorElement> = async (event) => {
		event.preventDefault();
		event.stopPropagation();
		await openExternalUrl(href);
	};

	return (
		<FocusRing ringTarget={linkRef}>
			<a
				ref={linkRef}
				href={href}
				target="_blank"
				rel="noopener noreferrer"
				className={clsx(styles.externalLink, className)}
				onClick={handleClick}
				{...props}
			>
				{children}
			</a>
		</FocusRing>
	);
});
