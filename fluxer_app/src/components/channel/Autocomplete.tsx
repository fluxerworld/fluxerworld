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

import type {Gif} from '@app/actions/GifActionCreators';
import styles from '@app/components/channel/Autocomplete.module.css';
import {AutocompleteChannel} from '@app/components/channel/AutocompleteChannel';
import {AutocompleteCommand} from '@app/components/channel/AutocompleteCommand';
import {AutocompleteEmoji} from '@app/components/channel/AutocompleteEmoji';
import {AutocompleteGif} from '@app/components/channel/AutocompleteGif';
import {AutocompleteMeme} from '@app/components/channel/AutocompleteMeme';
import {AutocompleteMention} from '@app/components/channel/AutocompleteMention';
import {AutocompleteSticker} from '@app/components/channel/AutocompleteSticker';
import {Scroller, type ScrollerHandle} from '@app/components/uikit/Scroller';
import type {Command} from '@app/hooks/useCommands';
import {useListNavigation} from '@app/hooks/useListNavigation';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {FavoriteMemeRecord} from '@app/records/FavoriteMemeRecord';
import type {GuildMemberRecord} from '@app/records/GuildMemberRecord';
import type {GuildRoleRecord} from '@app/records/GuildRoleRecord';
import type {GuildStickerRecord} from '@app/records/GuildStickerRecord';
import type {UserRecord} from '@app/records/UserRecord';
import type {FlatEmoji} from '@app/types/EmojiTypes';
import {autoUpdate, FloatingPortal, flip, offset, size, useFloating} from '@floating-ui/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';

type ScrollerWithScrollableElement = ScrollerHandle & {
	getScrollableElement?: () => HTMLElement | null;
};

export type AutocompleteOption =
	| {type: 'mention'; kind: 'member'; member: GuildMemberRecord}
	| {type: 'mention'; kind: 'user'; user: UserRecord}
	| {type: 'mention'; kind: 'role'; role: GuildRoleRecord}
	| {type: 'mention'; kind: '@everyone' | '@here'}
	| {type: 'channel'; channel: ChannelRecord}
	| {type: 'emoji'; emoji: FlatEmoji}
	| {type: 'command'; command: Command}
	| {type: 'meme'; meme: FavoriteMemeRecord}
	| {type: 'gif'; gif: Gif}
	| {type: 'sticker'; sticker: GuildStickerRecord};

export type AutocompleteType = 'mention' | 'channel' | 'emoji' | 'command' | 'meme' | 'gif' | 'sticker';

export const isMentionMember = (
	o: AutocompleteOption,
): o is {type: 'mention'; kind: 'member'; member: GuildMemberRecord} => o.type === 'mention' && o.kind === 'member';
export const isMentionUser = (o: AutocompleteOption): o is {type: 'mention'; kind: 'user'; user: UserRecord} =>
	o.type === 'mention' && o.kind === 'user';
export const isMentionRole = (o: AutocompleteOption): o is {type: 'mention'; kind: 'role'; role: GuildRoleRecord} =>
	o.type === 'mention' && o.kind === 'role';
export const isSpecialMention = (o: AutocompleteOption): o is {type: 'mention'; kind: '@everyone' | '@here'} =>
	o.type === 'mention' && (o.kind === '@everyone' || o.kind === '@here');
export const isChannel = (o: AutocompleteOption): o is {type: 'channel'; channel: ChannelRecord} =>
	o.type === 'channel';
export const isEmoji = (o: AutocompleteOption): o is {type: 'emoji'; emoji: FlatEmoji} => o.type === 'emoji';
export const isCommand = (o: AutocompleteOption): o is {type: 'command'; command: Command} => o.type === 'command';
export const isMeme = (o: AutocompleteOption): o is {type: 'meme'; meme: FavoriteMemeRecord} => o.type === 'meme';
export const isGif = (o: AutocompleteOption): o is {type: 'gif'; gif: Gif} => o.type === 'gif';
export const isSticker = (o: AutocompleteOption): o is {type: 'sticker'; sticker: GuildStickerRecord} =>
	o.type === 'sticker';

export const Autocomplete = observer(
	({
		type,
		onSelect,
		selectedIndex: externalSelectedIndex,
		options,
		setSelectedIndex: externalSetSelectedIndex,
		referenceElement,
		zIndex,
		attached = false,
	}: {
		type: AutocompleteType;
		onSelect: (option: AutocompleteOption) => void;
		selectedIndex?: number;
		options: Array<AutocompleteOption>;
		setSelectedIndex?: React.Dispatch<React.SetStateAction<number>>;
		referenceElement?: HTMLElement | null;
		zIndex?: number;
		query?: string;
		attached?: boolean;
	}) => {
		const {
			keyboardFocusIndex: internalKeyboardFocusIndex,
			hoverIndexForRender,
			handleKeyboardNavigation,
			handleMouseEnter,
			handleMouseLeave,
			reset,
		} = useListNavigation({
			itemCount: options.length,
			initialIndex: 0,
			loop: true,
		});

		const keyboardFocusIndex = externalSelectedIndex ?? internalKeyboardFocusIndex;

		const [referenceState, setReferenceState] = useState<HTMLElement | null>(referenceElement ?? null);

		useEffect(() => {
			setReferenceState(referenceElement ?? null);
		}, [referenceElement]);

		const {refs, floatingStyles} = useFloating({
			placement: 'top-start',
			open: true,
			whileElementsMounted: autoUpdate,
			elements: {reference: referenceState},
			middleware: [
				offset(attached ? 0 : 8),
				flip({padding: 16}),
				size({
					apply({rects, elements}) {
						Object.assign(elements.floating.style, {
							width: `${rects.reference.width}px`,
						});
					},
					padding: 16,
				}),
			],
		});

		const scrollerRef = useRef<ScrollerHandle>(null);
		const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);

		if (rowRefs.current.length !== options.length) {
			rowRefs.current = Array(options.length).fill(null);
		}

		useEffect(() => {
			reset();
		}, [options.length, reset]);

		const handleKeyDown = useCallback(
			(event: React.KeyboardEvent) => {
				switch (event.key) {
					case 'ArrowDown': {
						event.preventDefault();
						handleKeyboardNavigation('down');
						if (externalSetSelectedIndex) {
							externalSetSelectedIndex((prev) => (prev + 1 >= options.length ? 0 : prev + 1));
						}
						break;
					}
					case 'Home': {
						event.preventDefault();
						handleKeyboardNavigation('home');
						if (externalSetSelectedIndex) {
							externalSetSelectedIndex(0);
						}
						break;
					}
					case 'End': {
						event.preventDefault();
						handleKeyboardNavigation('end');
						if (externalSetSelectedIndex) {
							externalSetSelectedIndex(Math.max(0, options.length - 1));
						}
						break;
					}
					case 'ArrowUp': {
						event.preventDefault();
						handleKeyboardNavigation('up');
						if (externalSetSelectedIndex) {
							externalSetSelectedIndex((prev) => (prev - 1 < 0 ? options.length - 1 : prev - 1));
						}
						break;
					}
					case 'Tab':
					case 'Enter': {
						event.preventDefault();
						if (keyboardFocusIndex >= 0 && keyboardFocusIndex < options.length) {
							onSelect(options[keyboardFocusIndex]);
						}
						break;
					}
					default:
						break;
				}
			},
			[externalSetSelectedIndex, handleKeyboardNavigation, keyboardFocusIndex, onSelect, options],
		);

		function scrollChildIntoView(node: HTMLElement | null, margin = 32) {
			if (!node) return;
			const scroller = scrollerRef.current as ScrollerWithScrollableElement | null;

			if (scroller && typeof scroller.scrollIntoViewNode === 'function') {
				scroller.scrollIntoViewNode({node, padding: margin});
				return;
			}

			const scrollerEl =
				scroller?.getScrollableElement?.() ||
				node.closest('[data-scrollable], .overflow-y-auto, .overflow-y-scroll') ||
				node.parentElement;

			if (scrollerEl && scrollerEl instanceof HTMLElement) {
				const sRect = scrollerEl.getBoundingClientRect();
				const nRect = node.getBoundingClientRect();

				const outOfViewTop = nRect.top < sRect.top + margin;
				const outOfViewBottom = nRect.bottom > sRect.bottom - margin;

				if (outOfViewTop) {
					scrollerEl.scrollTop -= sRect.top + margin - nRect.top;
				} else if (outOfViewBottom) {
					scrollerEl.scrollTop += nRect.bottom - (sRect.bottom - margin);
				}
				return;
			}

			node.scrollIntoView({block: 'nearest'});
		}

		useLayoutEffect(() => {
			const node = rowRefs.current[keyboardFocusIndex] ?? null;
			if (!node) return;

			const raf = requestAnimationFrame(() => scrollChildIntoView(node, 32));
			return () => cancelAnimationFrame(raf);
		}, [keyboardFocusIndex, options.length]);

		return (
			<FloatingPortal>
				<div
					ref={refs.setFloating}
					style={{...floatingStyles, zIndex: zIndex ?? undefined}}
					className={`${styles.container} ${attached ? styles.containerAttached : styles.containerDetached}`}
					onKeyDown={handleKeyDown}
					role="listbox"
				>
					{type === 'gif' ? (
						<AutocompleteGif
							onSelect={onSelect}
							keyboardFocusIndex={keyboardFocusIndex}
							hoverIndex={hoverIndexForRender}
							options={options}
							onMouseEnter={handleMouseEnter}
							onMouseLeave={handleMouseLeave}
							rowRefs={rowRefs}
						/>
					) : (
						<Scroller ref={scrollerRef} className={styles.scroller} key="autocomplete-scroller">
							{type === 'mention' ? (
								<AutocompleteMention
									onSelect={onSelect}
									keyboardFocusIndex={keyboardFocusIndex}
									hoverIndex={hoverIndexForRender}
									options={options}
									onMouseEnter={handleMouseEnter}
									onMouseLeave={handleMouseLeave}
									rowRefs={rowRefs}
								/>
							) : type === 'channel' ? (
								<AutocompleteChannel
									onSelect={onSelect}
									keyboardFocusIndex={keyboardFocusIndex}
									hoverIndex={hoverIndexForRender}
									options={options}
									onMouseEnter={handleMouseEnter}
									onMouseLeave={handleMouseLeave}
									rowRefs={rowRefs}
								/>
							) : type === 'command' ? (
								<AutocompleteCommand
									onSelect={onSelect}
									keyboardFocusIndex={keyboardFocusIndex}
									hoverIndex={hoverIndexForRender}
									options={options}
									onMouseEnter={handleMouseEnter}
									onMouseLeave={handleMouseLeave}
									rowRefs={rowRefs}
								/>
							) : type === 'meme' ? (
								<AutocompleteMeme
									onSelect={onSelect}
									keyboardFocusIndex={keyboardFocusIndex}
									hoverIndex={hoverIndexForRender}
									options={options}
									onMouseEnter={handleMouseEnter}
									onMouseLeave={handleMouseLeave}
									rowRefs={rowRefs}
								/>
							) : type === 'sticker' ? (
								<AutocompleteSticker
									onSelect={onSelect}
									keyboardFocusIndex={keyboardFocusIndex}
									hoverIndex={hoverIndexForRender}
									options={options}
									onMouseEnter={handleMouseEnter}
									onMouseLeave={handleMouseLeave}
									rowRefs={rowRefs}
								/>
							) : (
								<AutocompleteEmoji
									onSelect={onSelect}
									keyboardFocusIndex={keyboardFocusIndex}
									hoverIndex={hoverIndexForRender}
									options={options}
									onMouseEnter={handleMouseEnter}
									onMouseLeave={handleMouseLeave}
									rowRefs={rowRefs}
								/>
							)}
						</Scroller>
					)}
				</div>
			</FloatingPortal>
		);
	},
);
