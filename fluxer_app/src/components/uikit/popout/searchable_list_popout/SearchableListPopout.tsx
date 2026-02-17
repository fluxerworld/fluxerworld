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

import {Input} from '@app/components/form/Input';
import styles from '@app/components/uikit/popout/searchable_list_popout/SearchableListPopout.module.css';
import {Scroller} from '@app/components/uikit/Scroller';
import {MagnifyingGlassIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {matchSorter} from 'match-sorter';
import {
	type KeyboardEvent,
	type ReactNode,
	type RefCallback,
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from 'react';

export interface SearchableListPopoutItem {
	id: string;
	ariaLabel: string;
	render: (props: {isActive: boolean; isSelected: boolean}) => ReactNode;
	searchValues: Array<string>;
	onSelect: () => void;
	isSelected?: boolean;
}

export interface SearchableListPopoutSection {
	id: string;
	heading?: ReactNode;
	items: Array<SearchableListPopoutItem>;
}

interface SearchableListPopoutProps {
	className?: string;
	defaultSearchQuery?: string;
	emptyStateClassName?: string;
	listAriaLabel: string;
	noResultsLabel: ReactNode;
	onRequestClose?: () => void;
	optionClassName?: string;
	placeholder: string;
	scrollerClassName?: string;
	searchClassName?: string;
	searchInputAriaLabel: string;
	sectionClassName?: string;
	sectionHeadingClassName?: string;
	sections: Array<SearchableListPopoutSection>;
}

interface FlattenedOption {
	id: string;
	option: SearchableListPopoutItem;
}

function getDefaultActiveIndex(options: Array<FlattenedOption>): number | null {
	if (options.length === 0) {
		return null;
	}

	const selectedIndex = options.findIndex((option) => option.option.isSelected);
	if (selectedIndex >= 0) {
		return selectedIndex;
	}

	return 0;
}

export function SearchableListPopout({
	className,
	defaultSearchQuery = '',
	emptyStateClassName,
	listAriaLabel,
	noResultsLabel,
	onRequestClose,
	optionClassName,
	placeholder,
	scrollerClassName,
	searchClassName,
	searchInputAriaLabel,
	sectionClassName,
	sectionHeadingClassName,
	sections,
}: SearchableListPopoutProps) {
	const inputRef = useRef<HTMLInputElement | null>(null);
	const optionRefs = useRef(new Map<string, HTMLButtonElement | null>());
	const [searchQuery, setSearchQuery] = useState(defaultSearchQuery);
	const [activeIndex, setActiveIndex] = useState<number | null>(null);
	const listId = useId();

	const filteredSections = useMemo(() => {
		const normalizedSearchQuery = searchQuery.trim();
		if (!normalizedSearchQuery) {
			return sections;
		}

		const nextSections: Array<SearchableListPopoutSection> = [];
		for (const section of sections) {
			const filteredItems = matchSorter(section.items, normalizedSearchQuery, {
				keys: [(item) => item.searchValues],
			});
			if (filteredItems.length > 0) {
				nextSections.push({...section, items: filteredItems});
			}
		}

		return nextSections;
	}, [searchQuery, sections]);

	const flattenedOptions = useMemo(() => {
		const options: Array<FlattenedOption> = [];
		for (const section of filteredSections) {
			for (const option of section.items) {
				options.push({
					id: option.id,
					option,
				});
			}
		}
		return options;
	}, [filteredSections]);

	const activeOption = useMemo(() => {
		if (activeIndex === null) {
			return null;
		}
		return flattenedOptions[activeIndex] ?? null;
	}, [activeIndex, flattenedOptions]);

	const activeOptionDomId = activeOption ? `${listId}-option-${activeOption.id}` : undefined;

	useEffect(() => {
		requestAnimationFrame(() => {
			inputRef.current?.focus();
			inputRef.current?.select();
		});
	}, []);

	useEffect(() => {
		setActiveIndex((currentActiveIndex) => {
			if (flattenedOptions.length === 0) {
				return null;
			}
			if (currentActiveIndex === null || currentActiveIndex >= flattenedOptions.length) {
				return getDefaultActiveIndex(flattenedOptions);
			}
			return currentActiveIndex;
		});
	}, [flattenedOptions]);

	useEffect(() => {
		if (!activeOption) {
			return;
		}

		const optionNode = optionRefs.current.get(activeOption.id);
		optionNode?.scrollIntoView({block: 'nearest'});
	}, [activeOption]);

	const setOptionRef = useCallback((id: string): RefCallback<HTMLButtonElement> => {
		return (node) => {
			optionRefs.current.set(id, node);
		};
	}, []);

	const moveActiveIndex = useCallback(
		(delta: number) => {
			if (flattenedOptions.length === 0) {
				return;
			}

			setActiveIndex((currentActiveIndex) => {
				if (currentActiveIndex === null) {
					return getDefaultActiveIndex(flattenedOptions);
				}

				const nextIndex = currentActiveIndex + delta;
				if (nextIndex < 0) {
					return flattenedOptions.length - 1;
				}
				if (nextIndex >= flattenedOptions.length) {
					return 0;
				}
				return nextIndex;
			});
		},
		[flattenedOptions],
	);

	const handleInputKeyDown = useCallback(
		(event: KeyboardEvent<HTMLInputElement>) => {
			switch (event.key) {
				case 'ArrowDown':
					event.preventDefault();
					moveActiveIndex(1);
					return;
				case 'ArrowUp':
					event.preventDefault();
					moveActiveIndex(-1);
					return;
				case 'Home':
					event.preventDefault();
					setActiveIndex(flattenedOptions.length > 0 ? 0 : null);
					return;
				case 'End':
					event.preventDefault();
					setActiveIndex(flattenedOptions.length > 0 ? flattenedOptions.length - 1 : null);
					return;
				case 'PageDown':
					event.preventDefault();
					moveActiveIndex(5);
					return;
				case 'PageUp':
					event.preventDefault();
					moveActiveIndex(-5);
					return;
				case 'Enter':
					if (!activeOption) {
						return;
					}
					event.preventDefault();
					activeOption.option.onSelect();
					return;
				case 'Escape':
					if (!onRequestClose) {
						return;
					}
					event.preventDefault();
					onRequestClose();
					return;
				default:
					return;
			}
		},
		[activeOption, flattenedOptions.length, moveActiveIndex, onRequestClose],
	);

	return (
		<div className={clsx(styles.popout, className)}>
			<div className={clsx(styles.search, searchClassName)}>
				<Input
					autoFocus
					ref={inputRef}
					type="text"
					placeholder={placeholder}
					value={searchQuery}
					onChange={(event) => {
						setSearchQuery(event.target.value);
						setActiveIndex(null);
					}}
					onKeyDown={handleInputKeyDown}
					leftIcon={<MagnifyingGlassIcon size={16} weight="bold" />}
					role="combobox"
					aria-autocomplete="list"
					aria-expanded="true"
					aria-controls={listId}
					aria-label={searchInputAriaLabel}
					aria-activedescendant={activeOptionDomId}
				/>
			</div>
			<Scroller className={clsx(styles.scroller, scrollerClassName)} key="searchable-list-popout-scroller" fade={false}>
				<div role="listbox" id={listId} aria-label={listAriaLabel} className={styles.list}>
					{filteredSections.length > 0 ? (
						filteredSections.map((section) => (
							<div className={clsx(styles.section, sectionClassName)} key={section.id}>
								{section.heading && (
									<div className={clsx(styles.sectionHeading, sectionHeadingClassName)}>{section.heading}</div>
								)}
								{section.items.map((option) => {
									const domId = `${listId}-option-${option.id}`;
									const isActive = activeOption?.id === option.id;
									const isSelected = option.isSelected ?? false;
									return (
										<button
											id={domId}
											key={option.id}
											ref={setOptionRef(option.id)}
											type="button"
											role="option"
											aria-selected={isSelected}
											aria-label={option.ariaLabel}
											className={clsx(
												styles.option,
												isActive && styles.optionActive,
												isSelected && styles.optionSelected,
												optionClassName,
											)}
											onMouseEnter={() => {
												const nextIndex = flattenedOptions.findIndex((item) => item.id === option.id);
												if (nextIndex >= 0) {
													setActiveIndex(nextIndex);
												}
											}}
											onClick={option.onSelect}
										>
											{option.render({isActive, isSelected})}
										</button>
									);
								})}
							</div>
						))
					) : (
						<div className={clsx(styles.emptyState, emptyStateClassName)}>{noResultsLabel}</div>
					)}
				</div>
			</Scroller>
		</div>
	);
}
