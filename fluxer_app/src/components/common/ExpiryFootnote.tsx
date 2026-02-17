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

import * as ContextMenuActionCreators from '@app/actions/ContextMenuActionCreators';
import styles from '@app/components/common/ExpiryFootnote.module.css';
import {ExpiryFootnoteContextMenu} from '@app/components/common/ExpiryFootnoteContextMenu';
import {HelpCenterArticleSlug} from '@app/constants/HelpCenterConstants';
import {getFormattedShortDate} from '@app/utils/DateUtils';
import * as HelpCenterUtils from '@app/utils/HelpCenterUtils';
import {useLingui} from '@lingui/react/macro';
import clsx from 'clsx';
import {type FC, type MouseEvent, useCallback} from 'react';

interface ExpiryFootnoteProps {
	expiresAt: Date | null;
	isExpired: boolean;
	label?: string;
	className?: string;
	inline?: boolean;
}

export const ExpiryFootnote: FC<ExpiryFootnoteProps> = ({expiresAt, isExpired, label, className, inline = false}) => {
	const {t} = useLingui();
	const helpUrl = HelpCenterUtils.getURL(HelpCenterArticleSlug.AttachmentExpiry);

	const handleContextMenu = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
		ContextMenuActionCreators.openFromEvent(event, () => <ExpiryFootnoteContextMenu />);
	}, []);

	let resolved = label;
	if (!resolved) {
		if (expiresAt) {
			const date = getFormattedShortDate(expiresAt);
			resolved = isExpired ? t`Expired on ${date}` : t`Expires on ${date}`;
		} else {
			return null;
		}
	}

	return (
		<a
			className={clsx(inline ? styles.inlineFootnote : styles.footnote, className)}
			href={helpUrl}
			onContextMenu={handleContextMenu}
			target="_blank"
			rel="noreferrer"
		>
			{resolved}
		</a>
	);
};
