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

import * as QuickSwitcherActionCreators from '@app/actions/QuickSwitcherActionCreators';
import {QuickSwitcherBottomSheet} from '@app/components/bottomsheets/QuickSwitcherBottomSheet';
import {Input} from '@app/components/form/Input';
import * as Modal from '@app/components/modals/Modal';
import quickStyles from '@app/components/quick_switcher/QuickSwitcherModal.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {MentionBadge} from '@app/components/uikit/MentionBadge';
import {Scroller, type ScrollerHandle} from '@app/components/uikit/Scroller';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {useListNavigation} from '@app/hooks/useListNavigation';
import ChannelStore from '@app/stores/ChannelStore';
import LayerManager from '@app/stores/LayerManager';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import type {QuickSwitcherExecutableResult, QuickSwitcherResult} from '@app/stores/QuickSwitcherStore';
import QuickSwitcherStore from '@app/stores/QuickSwitcherStore';
import ReadStateStore from '@app/stores/ReadStateStore';
import {
	createSections,
	getChannelId,
	getResultKey,
	getViewContext,
	handleContextMenu,
	PREFIX_HINTS,
	type QuickSwitcherSection,
	renderIcon,
	useQuickSwitcherInputFocus,
	useQuickSwitcherKeyboardHandling,
} from '@app/utils/quick_switcher/QuickSwitcherModalUtils';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {QuickSwitcherResultTypes} from '@fluxer/constants/src/QuickSwitcherConstants';
import {Trans, useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useRef} from 'react';

const ResultRow = observer(
	({
		result,
		index,
		isKeyboardSelected,
		isHovered,
		onHover,
		onMouseLeave,
		onConfirm,
		innerRef,
	}: {
		result: QuickSwitcherResult;
		index: number;
		isKeyboardSelected: boolean;
		isHovered: boolean;
		onHover: (index: number) => void;
		onMouseLeave: () => void;
		onConfirm: (result: QuickSwitcherExecutableResult) => void;
		innerRef?: React.Ref<HTMLButtonElement>;
	}) => {
		if (result.type === QuickSwitcherResultTypes.HEADER) {
			return (
				<div key={getResultKey(result)} className={quickStyles.sectionHeader}>
					{result.title}
				</div>
			);
		}

		const executableResult = result as QuickSwitcherExecutableResult;
		const channelId = getChannelId(executableResult);
		const unreadCount = channelId ? ReadStateStore.getUnreadCount(channelId) : 0;
		const mentionCount = channelId ? ReadStateStore.getMentionCount(channelId) : 0;
		const hasUnread = unreadCount > 0 || mentionCount > 0;
		const isActive = isKeyboardSelected || isHovered;
		const isHighlight =
			hasUnread &&
			(executableResult.type === QuickSwitcherResultTypes.TEXT_CHANNEL ||
				executableResult.type === QuickSwitcherResultTypes.VOICE_CHANNEL ||
				executableResult.type === QuickSwitcherResultTypes.GROUP_DM);
		const isUser = executableResult.type === QuickSwitcherResultTypes.USER;
		let subtext = executableResult.subtitle ?? null;
		let guildName: string | null = null;
		let isChannel = false;

		if (
			executableResult.type === QuickSwitcherResultTypes.TEXT_CHANNEL ||
			executableResult.type === QuickSwitcherResultTypes.VOICE_CHANNEL
		) {
			isChannel = true;
			const parentCategoryId = executableResult.channel.parentId;
			const categoryChannel = parentCategoryId ? ChannelStore.getChannel(parentCategoryId) : null;
			const categoryName =
				categoryChannel?.type === ChannelTypes.GUILD_CATEGORY && categoryChannel.name ? categoryChannel.name : null;
			subtext = categoryName;
			guildName = executableResult.guild?.name ?? null;
		}

		const handleMouseEnter = () => onHover(index);
		const handleClick = (event: React.MouseEvent) => {
			event.preventDefault();
			onConfirm(executableResult);
		};

		const iconRendered = renderIcon(
			executableResult,
			isHighlight,
			quickStyles.optionIcon,
			quickStyles.optionIconHighlight,
		);

		const key = getViewContext(executableResult)
			? `${executableResult.type}-${getViewContext(executableResult)}-${executableResult.id}`
			: `${executableResult.type}-${executableResult.id}`;

		return (
			<FocusRing offset={-2}>
				<button
					type="button"
					className={clsx(quickStyles.option, isActive && quickStyles.optionActive)}
					ref={innerRef}
					onMouseEnter={handleMouseEnter}
					onMouseLeave={onMouseLeave}
					onMouseDown={(event) => event.preventDefault()}
					onClick={handleClick}
					onContextMenu={(event) => handleContextMenu(event, executableResult)}
					key={key}
				>
					<div className={quickStyles.optionContent}>
						{iconRendered.type === 'avatar' ? (
							<div className={quickStyles.avatar}>{iconRendered.content}</div>
						) : iconRendered.type === 'guild' ? (
							<div className={quickStyles.guildIcon}>{iconRendered.content}</div>
						) : (
							iconRendered.content
						)}
						<div className={clsx(quickStyles.optionText, isHighlight && quickStyles.optionHighlight)}>
							<div className={quickStyles.optionPrimary}>
								<div className={quickStyles.optionTitle}>{executableResult.title}</div>
								{mentionCount > 0 && (
									<span className={quickStyles.optionMention}>
										<MentionBadge mentionCount={mentionCount} size="small" />
									</span>
								)}
								{subtext && (
									<div
										className={clsx(
											quickStyles.optionDescription,
											isChannel && quickStyles.optionCategory,
											isUser && quickStyles.optionUserTag,
										)}
									>
										{subtext}
									</div>
								)}
							</div>
							{guildName && <div className={quickStyles.optionMeta}>{guildName}</div>}
						</div>
					</div>
				</button>
			</FocusRing>
		);
	},
);

const QuickSwitcherModalComponent: React.FC = observer(() => {
	const {t} = useLingui();
	const {isOpen, query, results, selectedIndex} = QuickSwitcherStore;
	const inputRef = useRef<HTMLInputElement>(null);
	const scrollerRef = useRef<ScrollerHandle>(null);
	const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);
	const shouldScrollToSelection = useRef(false);
	const isMobile = MobileLayoutStore.isMobileLayout();

	const {
		keyboardFocusIndex,
		hoverIndexForRender,
		handleMouseEnter: handleHoverIndex,
		handleMouseLeave,
		setSelectedIndex: setKeyboardIndex,
	} = useListNavigation({
		itemCount: results.length,
		initialIndex: selectedIndex >= 0 ? selectedIndex : 0,
		loop: true,
	});

	if (rowRefs.current.length !== results.length) {
		rowRefs.current = Array(results.length).fill(null);
	}

	useEffect(() => {
		if (results.length === 0) {
			setKeyboardIndex(-1);
			handleMouseLeave();
			return;
		}
		const clamped = selectedIndex >= 0 ? Math.min(selectedIndex, results.length - 1) : 0;
		setKeyboardIndex(clamped);
	}, [handleMouseLeave, results.length, selectedIndex, setKeyboardIndex]);

	useEffect(() => {
		handleMouseLeave();
	}, [handleMouseLeave, results.length]);

	useQuickSwitcherKeyboardHandling(isOpen, isMobile, inputRef, query);
	useQuickSwitcherInputFocus(isOpen, isMobile, undefined, inputRef);

	useEffect(() => {
		if (!isOpen || isMobile) {
			return;
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
				return;
			}

			event.preventDefault();
			shouldScrollToSelection.current = true;
			QuickSwitcherActionCreators.moveSelection(event.key === 'ArrowDown' ? 'down' : 'up');
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [isMobile, isOpen]);

	const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		QuickSwitcherActionCreators.search(event.target.value);
	}, []);

	const handleKeyDown = useCallback(async (event: React.KeyboardEvent<HTMLInputElement>) => {
		switch (event.key) {
			case 'Tab':
			case 'Enter':
				event.preventDefault();
				await QuickSwitcherActionCreators.confirmSelection();
				break;
			case 'Escape':
				event.preventDefault();
				QuickSwitcherActionCreators.hide();
				break;
			default:
				break;
		}
	}, []);

	const handleClose = useCallback(() => {
		if (LayerManager.hasType('contextmenu')) {
			return;
		}
		QuickSwitcherActionCreators.hide();
	}, []);

	const handleSelect = useCallback(
		(index: number) => {
			shouldScrollToSelection.current = false;
			handleHoverIndex(index);
		},
		[handleHoverIndex],
	);

	const handleConfirm = useCallback((result: QuickSwitcherExecutableResult) => {
		void QuickSwitcherActionCreators.switchTo(result);
	}, []);

	useEffect(() => {
		if (!shouldScrollToSelection.current || keyboardFocusIndex < 0) {
			shouldScrollToSelection.current = false;
			return;
		}
		shouldScrollToSelection.current = false;
		const node = rowRefs.current[keyboardFocusIndex];
		if (node) {
			scrollerRef.current?.scrollIntoViewNode({node: node as HTMLElement, padding: 32});
		}
	}, [keyboardFocusIndex]);

	const sections = useMemo(() => createSections(results), [results]);

	if (!isOpen) {
		return null;
	}

	if (isMobile) {
		return <QuickSwitcherBottomSheet isOpen={isOpen} onClose={QuickSwitcherActionCreators.hide} />;
	}

	return (
		<Modal.Root
			centered
			className={quickStyles.modalRoot}
			onClose={handleClose}
			initialFocusRef={inputRef}
			transitionPreset="instant"
		>
			<Modal.ScreenReaderLabel text={t`Quick Switcher`} />
			<div className={quickStyles.container}>
				<div className={quickStyles.header}>
					<Input
						ref={inputRef}
						value={query}
						onChange={handleChange}
						onKeyDown={handleKeyDown}
						placeholder={t`Search for channels, people, or communities`}
						spellCheck={false}
						className={quickStyles.inputBackground}
					/>
				</div>
				<div className={quickStyles.list}>
					<Scroller
						ref={scrollerRef}
						className={quickStyles.scrollerContainer}
						overflow="scroll"
						key="quick_switcher-desktop-scroller"
					>
						{results.length === 0 ? (
							<div className={quickStyles.emptyState}>
								<div className={quickStyles.emptyStateTitle}>{t`No matches found`}</div>
								<div className={quickStyles.emptyStateHint}>
									{t`Try a different name or use @ / # / ! / * prefixes to filter results.`}
								</div>
							</div>
						) : (
							sections.map((section: QuickSwitcherSection, sidx: number) => (
								<div key={`section-${sidx}`} className={quickStyles.section}>
									{section.header && <div className={quickStyles.sectionHeader}>{section.header.title}</div>}
									{section.rows.map(({result, index}: {result: QuickSwitcherExecutableResult; index: number}) => (
										<ResultRow
											key={getResultKey(result)}
											result={result}
											index={index}
											isKeyboardSelected={index === keyboardFocusIndex}
											isHovered={index === hoverIndexForRender}
											onHover={handleSelect}
											onMouseLeave={handleMouseLeave}
											onConfirm={handleConfirm}
											innerRef={(node) => {
												rowRefs.current[index] = node;
											}}
										/>
									))}
								</div>
							))
						)}
					</Scroller>
				</div>
				<div className={quickStyles.footer}>
					<Trans>
						Start searches with{' '}
						<Tooltip text={t(PREFIX_HINTS[0].label)} position="top">
							<span className={quickStyles.footerCode}>@</span>
						</Tooltip>{' '}
						<Tooltip text={t(PREFIX_HINTS[1].label)} position="top">
							<span className={quickStyles.footerCode}>#</span>
						</Tooltip>{' '}
						<Tooltip text={t(PREFIX_HINTS[2].label)} position="top">
							<span className={quickStyles.footerCode}>!</span>
						</Tooltip>{' '}
						<Tooltip text={t(PREFIX_HINTS[3].label)} position="top">
							<span className={quickStyles.footerCode}>*</span>
						</Tooltip>{' '}
						<Tooltip text={t(PREFIX_HINTS[4].label)} position="top">
							<span className={quickStyles.footerCode}>&gt;</span>
						</Tooltip>{' '}
						to narrow down results.
					</Trans>
				</div>
			</div>
		</Modal.Root>
	);
});

export const QuickSwitcherModal = Object.assign(QuickSwitcherModalComponent, {
	disableBackdropOnMobile: true,
});
