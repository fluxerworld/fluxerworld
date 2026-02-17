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
import {modal} from '@app/actions/ModalActionCreators';
import styles from '@app/components/bottomsheets/CreateDMBottomSheet.module.css';
import {FriendSelector} from '@app/components/common/FriendSelector';
import {DuplicateGroupConfirmModal} from '@app/components/modals/DuplicateGroupConfirmModal';
import {BottomSheet} from '@app/components/uikit/bottom_sheet/BottomSheet';
import {Button} from '@app/components/uikit/button/Button';
import {Scroller} from '@app/components/uikit/Scroller';
import {useCreateDMModalLogic} from '@app/utils/modals/CreateDMModalUtils';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';

interface CreateDMBottomSheetProps {
	isOpen: boolean;
	onClose: () => void;
}

type ScrollContentStyle = React.CSSProperties & {
	'--create-dm-scroll-padding-bottom'?: string;
};

export const CreateDMBottomSheet = observer(({isOpen, onClose}: CreateDMBottomSheetProps) => {
	const {t} = useLingui();
	const modalLogic = useCreateDMModalLogic({autoCloseOnCreate: false, resetKey: isOpen});
	const snapPoints = useMemo(() => [0, 1], []);
	const footerRef = useRef<HTMLDivElement>(null);
	const [footerHeight, setFooterHeight] = useState(0);

	useLayoutEffect(() => {
		if (!isOpen) {
			setFooterHeight(0);
			return undefined;
		}

		const element = footerRef.current;
		if (!element) {
			return undefined;
		}

		const updateHeight = () => setFooterHeight(element.offsetHeight);
		updateHeight();

		const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateHeight) : null;
		if (resizeObserver) {
			resizeObserver.observe(element);
		}

		const handleResize = () => updateHeight();
		window.addEventListener('resize', handleResize);

		return () => {
			resizeObserver?.disconnect();
			window.removeEventListener('resize', handleResize);
		};
	}, [isOpen]);

	const scrollContentStyle = useMemo<ScrollContentStyle>(() => {
		if (footerHeight === 0) {
			return {};
		}
		return {'--create-dm-scroll-padding-bottom': `calc(${footerHeight}px + 16px)`};
	}, [footerHeight]);

	const handleCreate = useCallback(async () => {
		const result = await modalLogic.handleCreate();
		if (result && result.duplicates.length > 0) {
			ModalActionCreators.push(
				modal(() => (
					<DuplicateGroupConfirmModal
						channels={result.duplicates}
						onConfirm={() => modalLogic.handleCreateChannel(result.selectionSnapshot)}
					/>
				)),
			);
			return;
		}

		onClose();
	}, [modalLogic, onClose]);

	return (
		<BottomSheet isOpen={isOpen} onClose={onClose} snapPoints={snapPoints} title={t`Select Friends`} disablePadding>
			<div className={styles.container}>
				<Scroller key="create-dm-scroller" className={styles.scroller} fade={false}>
					<div className={styles.content} style={scrollContentStyle}>
						<p className={styles.description}>
							{modalLogic.selectedUserIds.length === 0 ? (
								<Trans>You can add up to {modalLogic.maxSelections} friends</Trans>
							) : (
								<Trans>
									You can add {Math.max(0, modalLogic.maxSelections - modalLogic.selectedUserIds.length)} more friends
								</Trans>
							)}
						</p>
						<div className={styles.friendSelector}>
							<FriendSelector
								selectedUserIds={modalLogic.selectedUserIds}
								onToggle={modalLogic.handleToggle}
								maxSelections={modalLogic.maxSelections}
								searchQuery={modalLogic.searchQuery}
								onSearchQueryChange={modalLogic.setSearchQuery}
							/>
						</div>
					</div>
				</Scroller>

				<div className={styles.footer} ref={footerRef}>
					<Button variant="secondary" className={styles.cancelButton} onClick={onClose}>
						<Trans>Cancel</Trans>
					</Button>
					<Button
						variant="primary"
						className={styles.createButton}
						onClick={handleCreate}
						disabled={modalLogic.isCreating}
						submitting={modalLogic.isCreating}
					>
						{modalLogic.buttonText}
					</Button>
				</div>
			</div>
		</BottomSheet>
	);
});
