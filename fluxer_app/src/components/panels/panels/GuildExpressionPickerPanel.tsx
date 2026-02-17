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
import {
	ExpressionPickerHeaderContext,
	type ExpressionPickerTabType,
} from '@app/components/popouts/ExpressionPickerPopout';
import {getExpressionPickerHeight} from '@app/lib/ExpressionPickerUtils';
import ExpressionPickerStore from '@app/stores/ExpressionPickerStore';
import type {FlatEmoji} from '@app/types/EmojiTypes';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

interface GuildExpressionPickerPanelProps {
	guildId: string;
	channelId?: string;
	onEmojiSelect: (emoji: FlatEmoji, shiftKey?: boolean) => void;
	onClose?: () => void;
	visibleTabs?: Array<ExpressionPickerTabType>;
	selectedTab?: ExpressionPickerTabType;
	onTabChange?: (tab: ExpressionPickerTabType) => void;
}

export const GuildExpressionPickerPanel = observer(
	({
		guildId,
		channelId,
		onEmojiSelect,
		onClose,
		visibleTabs = ['gifs', 'memes', 'stickers', 'emojis'],
		selectedTab: controlledSelectedTab,
		onTabChange,
	}: GuildExpressionPickerPanelProps) => {
		const {t, i18n} = useLingui();
		const containerRef = useRef<HTMLDivElement>(null);
		const [_openTime, setOpenTime] = useState<number>(Date.now());

		const categories = useMemo(() => {
			const allCategories = [
				{
					type: 'gifs' as const,
					label: i18n._(t`GIFs`),
					renderComponent: ({onClose: close}: {onClose?: () => void}) => <GifPicker onClose={close} />,
				},
				{
					type: 'memes' as const,
					label: i18n._(t`Media`),
					renderComponent: ({onClose: close}: {onClose?: () => void}) => <MemesPicker onClose={close} />,
				},
				{
					type: 'stickers' as const,
					label: i18n._(t`Stickers`),
					renderComponent: ({channelId: chanId, onClose: close}: {channelId?: string; onClose?: () => void}) => {
						const handleStickerSelect = (_sticker: unknown, shiftKey?: boolean) => {
							if (chanId) {
								if (close && !shiftKey) {
									close();
								}
							}
						};

						return <StickersPicker channelId={chanId} handleSelect={handleStickerSelect} />;
					},
				},
				{
					type: 'emojis' as const,
					label: i18n._(t`Emojis`),
					renderComponent: ({
						channelId: chanId,
						onSelect,
					}: {
						channelId?: string;
						onSelect: (emoji: FlatEmoji, shiftKey?: boolean) => void;
					}) => <EmojiPicker channelId={chanId} handleSelect={onSelect} />,
				},
			];

			return allCategories.filter((category) => visibleTabs.includes(category.type));
		}, [i18n, visibleTabs, t]);

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
					ExpressionPickerActionCreators.setTab(tab);
				} else {
					setInternalSelectedTab(tab);
				}
			},
			[channelId, onTabChange, selectedTab],
		);

		const selectedCategory = categories.find((category) => category.type === selectedTab) || categories[0];

		useEffect(() => {
			setOpenTime(Date.now());
		}, []);

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
			[channelId, onClose, onEmojiSelect],
		);

		const handleClose = useCallback(() => {
			onClose?.();
		}, [onClose]);

		const showTabs = categories.length > 1;
		const [headerPortalElement, setHeaderPortalElement] = useState<HTMLDivElement | null>(null);

		const headerPortalCallback = useCallback((node: HTMLDivElement | null) => {
			setHeaderPortalElement(node);
		}, []);

		const headerContextValue = useMemo(() => ({headerPortalElement}), [headerPortalElement]);

		const pickerHeight = useMemo(() => {
			return getExpressionPickerHeight(50, 44, 32);
		}, []);

		return (
			<ExpressionPickerHeaderContext.Provider value={headerContextValue}>
				<div ref={containerRef} style={{height: pickerHeight}}>
					<div>
						{showTabs && (
							<nav>
								<div role="tablist" aria-label={t`Expression picker categories`}>
									{categories.map((category) => (
										<button
											key={category.type}
											id={`${guildId}-${category.type}`}
											role="tab"
											type="button"
											aria-selected={selectedTab === category.type}
											onClick={() => setSelectedTab(category.type)}
										>
											{category.label}
										</button>
									))}
								</div>
							</nav>
						)}
						<div ref={headerPortalCallback} />
					</div>
					<div>{selectedCategory.renderComponent({channelId, onSelect: handleEmojiSelect, onClose: handleClose})}</div>
				</div>
			</ExpressionPickerHeaderContext.Provider>
		);
	},
);
