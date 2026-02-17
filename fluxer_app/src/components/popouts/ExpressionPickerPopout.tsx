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

import * as ExpressionPickerActionCreators from '@app/actions/ExpressionPickerActionCreators';
import {EmojiPicker} from '@app/components/channel/EmojiPicker';
import {GifPicker} from '@app/components/channel/pickers/gif/GifPicker';
import {MemesPicker} from '@app/components/channel/pickers/memes/MemesPicker';
import {StickersPicker} from '@app/components/channel/StickersPicker';
import styles from '@app/components/popouts/ExpressionPickerPopout.module.css';
import * as StickerSendUtils from '@app/lib/StickerSendUtils';
import type {GuildStickerRecord} from '@app/records/GuildStickerRecord';
import ExpressionPickerStore from '@app/stores/ExpressionPickerStore';
import type {FlatEmoji} from '@app/types/EmojiTypes';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import React, {useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import ReactDOM from 'react-dom';

interface ExpressionPickerHeaderContextType {
	headerPortalElement: HTMLDivElement | null;
}

export const ExpressionPickerHeaderContext = React.createContext<ExpressionPickerHeaderContextType | null>(null);

export const useExpressionPickerHeaderPortal = () => {
	return useContext(ExpressionPickerHeaderContext);
};

export const ExpressionPickerHeaderPortal = ({children}: {children: React.ReactNode}) => {
	const context = useExpressionPickerHeaderPortal();
	if (!context?.headerPortalElement) {
		return null;
	}
	return ReactDOM.createPortal(children, context.headerPortalElement);
};

export type ExpressionPickerTabType = 'gifs' | 'memes' | 'stickers' | 'emojis';

interface ExpressionPickerCategory {
	type: ExpressionPickerTabType;
	label: string;
	renderComponent: (props: {
		channelId?: string;
		onSelect: (emoji: FlatEmoji, shiftKey?: boolean) => void;
		onClose?: () => void;
	}) => React.ReactNode;
}

const createAllCategories = (i18n: I18n): Array<ExpressionPickerCategory> => [
	{
		type: 'gifs' as const,
		label: i18n._(msg`GIFs`),
		renderComponent: ({onClose}) => <GifPicker onClose={onClose} />,
	},
	{
		type: 'memes' as const,
		label: i18n._(msg`Media`),
		renderComponent: ({onClose}) => <MemesPicker onClose={onClose} />,
	},
	{
		type: 'stickers' as const,
		label: i18n._(msg`Stickers`),
		renderComponent: ({channelId, onClose}) => {
			const handleStickerSelect = (sticker: GuildStickerRecord, shiftKey?: boolean) => {
				if (channelId) {
					StickerSendUtils.handleStickerSelect(channelId, sticker);
					if (onClose && !shiftKey) {
						onClose();
					}
				}
			};

			return <StickersPicker channelId={channelId} handleSelect={handleStickerSelect} />;
		},
	},
	{
		type: 'emojis' as const,
		label: i18n._(msg`Emojis`),
		renderComponent: ({channelId, onSelect}) => <EmojiPicker channelId={channelId} handleSelect={onSelect} />,
	},
];

interface ExpressionPickerPopoutProps {
	channelId?: string;
	onEmojiSelect: (emoji: FlatEmoji, shiftKey?: boolean) => void;
	onClose?: () => void;
	visibleTabs?: Array<ExpressionPickerTabType>;
	selectedTab?: ExpressionPickerTabType;
	onTabChange?: (tab: ExpressionPickerTabType) => void;
}

export const ExpressionPickerPopout = observer(
	({
		channelId,
		onEmojiSelect,
		onClose,
		visibleTabs = ['gifs', 'memes', 'stickers', 'emojis'],
		selectedTab: controlledSelectedTab,
		onTabChange,
	}: ExpressionPickerPopoutProps) => {
		const {t, i18n} = useLingui();

		const categories = useMemo(() => {
			const all = createAllCategories(i18n);
			return all.filter((category) => visibleTabs.includes(category.type));
		}, [i18n, visibleTabs]);

		const [internalSelectedTab, setInternalSelectedTab] = useState<ExpressionPickerTabType>(
			() => categories[0]?.type || 'emojis',
		);

		const storeSelectedTab = ExpressionPickerStore.selectedTab;
		const selectedTab = storeSelectedTab ?? controlledSelectedTab ?? internalSelectedTab;

		const setSelectedTab = useCallback(
			(tab: ExpressionPickerTabType) => {
				if (tab === selectedTab) {
					return;
				}

				if (onTabChange) {
					onTabChange(tab);
					return;
				}

				const pickerChannelId = ExpressionPickerStore.channelId;
				if (pickerChannelId) {
					ExpressionPickerActionCreators.toggle(pickerChannelId, tab);
				} else {
					setInternalSelectedTab(tab);
				}
			},
			[onTabChange, selectedTab],
		);

		const selectedCategory = categories.find((category) => category.type === selectedTab) || categories[0];
		const containerRef = useRef<HTMLDivElement>(null);

		useEffect(() => {
			if (containerRef.current) {
				const firstInput = containerRef.current.querySelector('input[type="text"]') as HTMLInputElement | null;
				if (firstInput) {
					firstInput.focus();
				}
			}
		}, []);

		const handleEmojiSelect = useCallback(
			(emoji: FlatEmoji, shiftKey?: boolean) => {
				onEmojiSelect(emoji, shiftKey);
				if (onClose && !shiftKey) {
					onClose();
				}
			},
			[onEmojiSelect, onClose],
		);

		const showTabs = categories.length > 1;
		const [headerPortalElement, setHeaderPortalElement] = useState<HTMLDivElement | null>(null);

		const headerPortalCallback = useCallback((node: HTMLDivElement | null) => {
			setHeaderPortalElement(node);
		}, []);

		const headerContextValue = useMemo(() => ({headerPortalElement}), [headerPortalElement]);

		return (
			<ExpressionPickerHeaderContext.Provider value={headerContextValue}>
				<div
					ref={containerRef}
					className={clsx(styles.container, showTabs ? styles.containerWithTabs : styles.containerNoTabs)}
				>
					<div className={styles.header}>
						{showTabs && (
							<nav className={styles.nav}>
								<div className={styles.tabList} role="tablist" aria-label={t`Expression picker categories`}>
									{categories.map((category) => (
										<button
											key={category.type}
											id={category.type}
											role="tab"
											type="button"
											aria-selected={selectedTab === category.type}
											className={clsx(
												styles.tab,
												selectedTab === category.type ? styles.tabActive : styles.tabInactive,
											)}
											onClick={() => setSelectedTab(category.type)}
										>
											{category.label}
										</button>
									))}
								</div>
							</nav>
						)}
						<div ref={headerPortalCallback} className={styles.headerPortal} />
					</div>
					<div className={styles.content}>
						{selectedCategory.renderComponent({channelId, onSelect: handleEmojiSelect, onClose})}
					</div>
				</div>
			</ExpressionPickerHeaderContext.Provider>
		);
	},
);
