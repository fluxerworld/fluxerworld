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

import {AttachmentGridItem, type LayoutType} from '@app/components/channel/embeds/attachments/AttachmentGridItem';
import type {MessageRecord} from '@app/records/MessageRecord';
import styles from '@app/styles/AttachmentLayoutGrid.module.css';
import type {MessageAttachment} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {observer} from 'mobx-react-lite';
import type {FC} from 'react';

export interface AttachmentLayoutGridProps {
	attachments: ReadonlyArray<MessageAttachment>;
	message?: MessageRecord;
	isPreview?: boolean;
}

interface LayoutConfig {
	type: LayoutType;
	gridClassName: string;
	getAspectRatio: (index: number) => string | undefined;
}

function getLayoutConfig(count: number): LayoutConfig {
	const configs: Record<number, LayoutConfig> = {
		2: {
			type: 'two',
			gridClassName: styles.twoImageGrid,
			getAspectRatio: () => '1 / 1',
		},
		3: {
			type: 'three',
			gridClassName: styles.threeImageGrid,
			getAspectRatio: (index) => (index === 0 ? undefined : '1 / 1'),
		},
		4: {
			type: 'four',
			gridClassName: styles.fourImageGrid,
			getAspectRatio: () => '3 / 2',
		},
		5: {
			type: 'five',
			gridClassName: styles.fiveImageGrid,
			getAspectRatio: (index) => (index < 2 ? '3 / 2' : '1 / 1'),
		},
		6: {
			type: 'six',
			gridClassName: styles.sixImageGrid,
			getAspectRatio: () => '1 / 1',
		},
		7: {
			type: 'seven',
			gridClassName: styles.sevenImageContainer,
			getAspectRatio: (index) => (index === 0 ? '16 / 9' : '1 / 1'),
		},
		8: {
			type: 'eight',
			gridClassName: styles.eightImageContainer,
			getAspectRatio: (index) => (index < 2 ? '3 / 2' : '1 / 1'),
		},
		9: {
			type: 'nine',
			gridClassName: styles.nineImageGrid,
			getAspectRatio: () => '1 / 1',
		},
		10: {
			type: 'ten',
			gridClassName: styles.tenImageContainer,
			getAspectRatio: (index) => (index === 0 ? '16 / 9' : '1 / 1'),
		},
	};

	return configs[count] || configs[4];
}

export const AttachmentLayoutGrid: FC<AttachmentLayoutGridProps> = observer(({attachments, message, isPreview}) => {
	const count = attachments.length;
	const config = getLayoutConfig(count);

	if (count === 7) {
		return (
			<div className={styles.sevenImageContainer}>
				<div className={styles.sevenHero}>
					<AttachmentGridItem
						key={attachments[0].id}
						attachment={attachments[0]}
						targetAspectRatio={config.getAspectRatio(0)}
						message={message}
						mediaAttachments={attachments}
						isPreview={isPreview}
					/>
				</div>
				<div className={styles.sevenGrid}>
					{attachments.slice(1, 7).map((attachment, index) => (
						<AttachmentGridItem
							key={attachment.id}
							attachment={attachment}
							targetAspectRatio={config.getAspectRatio(index + 1)}
							message={message}
							mediaAttachments={attachments}
							isPreview={isPreview}
						/>
					))}
				</div>
			</div>
		);
	}

	if (count === 8) {
		return (
			<div className={styles.eightImageContainer}>
				<div className={styles.eightTopRow}>
					{attachments.slice(0, 2).map((attachment, index) => (
						<AttachmentGridItem
							key={attachment.id}
							attachment={attachment}
							targetAspectRatio={config.getAspectRatio(index)}
							message={message}
							mediaAttachments={attachments}
							isPreview={isPreview}
						/>
					))}
				</div>
				<div className={styles.eightBottomGrid}>
					{attachments.slice(2, 8).map((attachment, index) => (
						<AttachmentGridItem
							key={attachment.id}
							attachment={attachment}
							targetAspectRatio={config.getAspectRatio(index + 2)}
							message={message}
							mediaAttachments={attachments}
							isPreview={isPreview}
						/>
					))}
				</div>
			</div>
		);
	}

	if (count === 10) {
		return (
			<div className={styles.tenImageContainer}>
				<div className={styles.tenHero}>
					<AttachmentGridItem
						key={attachments[0].id}
						attachment={attachments[0]}
						targetAspectRatio={config.getAspectRatio(0)}
						message={message}
						mediaAttachments={attachments}
						isPreview={isPreview}
					/>
				</div>
				<div className={styles.tenGrid}>
					{attachments.slice(1, 10).map((attachment, index) => (
						<AttachmentGridItem
							key={attachment.id}
							attachment={attachment}
							targetAspectRatio={config.getAspectRatio(index + 1)}
							message={message}
							mediaAttachments={attachments}
							isPreview={isPreview}
						/>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className={config.gridClassName}>
			{attachments.map((attachment, index) => (
				<AttachmentGridItem
					key={attachment.id}
					attachment={attachment}
					targetAspectRatio={config.getAspectRatio(index)}
					message={message}
					mediaAttachments={attachments}
					isPreview={isPreview}
				/>
			))}
		</div>
	);
});
