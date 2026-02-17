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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {Input} from '@app/components/form/Input';
import styles from '@app/components/modals/DiscoveryModal.module.css';
import {DiscoveryGuildCard} from '@app/components/modals/discovery/DiscoveryGuildCard';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import {Spinner} from '@app/components/uikit/Spinner';
import foodPatternUrl from '@app/images/i-like-food.svg';
import DiscoveryStore from '@app/stores/DiscoveryStore';
import {useLingui} from '@lingui/react/macro';
import {MagnifyingGlassIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useRef} from 'react';

export const DiscoveryModal = observer(function DiscoveryModal() {
	const {t} = useLingui();
	const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		void DiscoveryStore.loadCategories();
		void DiscoveryStore.search({offset: 0});
		return () => {
			if (searchTimerRef.current) {
				clearTimeout(searchTimerRef.current);
			}
		};
	}, []);

	const handleSearchChange = useCallback((value: string) => {
		if (searchTimerRef.current) {
			clearTimeout(searchTimerRef.current);
		}
		searchTimerRef.current = setTimeout(() => {
			void DiscoveryStore.search({query: value, offset: 0});
		}, 300);
	}, []);

	const handleCategoryClick = useCallback((categoryId: number | null) => {
		void DiscoveryStore.search({category: categoryId, offset: 0});
	}, []);

	const handleLoadMore = useCallback(() => {
		void DiscoveryStore.search({offset: DiscoveryStore.guilds.length});
	}, []);

	const handleClose = useCallback(() => {
		DiscoveryStore.reset();
		ModalActionCreators.pop();
	}, []);

	const hasMore = DiscoveryStore.guilds.length < DiscoveryStore.total;

	return (
		<Modal.Root size="fullscreen" onClose={handleClose}>
			<Modal.ScreenReaderLabel text={t`Explore Communities`} />
			<Modal.InsetCloseButton onClick={handleClose} />

			<div className={styles.hero}>
				<div className={styles.heroBackground} aria-hidden>
					<div className={styles.heroPattern} style={{backgroundImage: `url(${foodPatternUrl})`}} />
				</div>
				<div className={styles.heroContent}>
					<h1 className={styles.heroTitle}>{t`Explore Communities`}</h1>
					<div className={styles.heroControls}>
						<Input
							className={styles.searchInput}
							placeholder={t`Search communities...`}
							defaultValue={DiscoveryStore.query}
							onChange={(e) => handleSearchChange(e.target.value)}
							leftIcon={<MagnifyingGlassIcon size={16} weight="bold" />}
						/>
						<div className={styles.categories}>
							<button
								type="button"
								className={DiscoveryStore.category === null ? styles.categoryChipActive : styles.categoryChip}
								onClick={() => handleCategoryClick(null)}
							>
								{t`All`}
							</button>
							{DiscoveryStore.categories.map((cat) => (
								<button
									key={cat.id}
									type="button"
									className={DiscoveryStore.category === cat.id ? styles.categoryChipActive : styles.categoryChip}
									onClick={() => handleCategoryClick(cat.id)}
								>
									{cat.name}
								</button>
							))}
						</div>
					</div>
				</div>
			</div>

			<Modal.Content>
				{DiscoveryStore.loading && DiscoveryStore.guilds.length === 0 ? (
					<div className={styles.loadingState}>
						<Spinner />
					</div>
				) : (
					DiscoveryStore.guilds.length > 0 && (
						<>
							<div className={styles.grid}>
								{DiscoveryStore.guilds.map((guild) => (
									<DiscoveryGuildCard key={guild.id} guild={guild} />
								))}
							</div>
							{hasMore && (
								<div className={styles.loadMore}>
									<Button variant="secondary" onClick={handleLoadMore} disabled={DiscoveryStore.loading}>
										{DiscoveryStore.loading ? t`Loading...` : t`Load More`}
									</Button>
								</div>
							)}
						</>
					)
				)}
			</Modal.Content>
		</Modal.Root>
	);
});
