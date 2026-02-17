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

import * as ConnectionActionCreators from '@app/actions/ConnectionActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import {BlueskyIcon} from '@app/components/icons/BlueskyIcon';
import {UnverifiedConnectionIcon} from '@app/components/icons/UnverifiedConnectionIcon';
import {VerifiedConnectionIcon} from '@app/components/icons/VerifiedConnectionIcon';
import {computeVerticalDropPosition} from '@app/components/layout/dnd/DndDropPosition';
import type {ConnectionDragItem} from '@app/components/layout/types/DndTypes';
import {DND_TYPES} from '@app/components/layout/types/DndTypes';
import {AddConnectionModal} from '@app/components/modals/AddConnectionModal';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {EditConnectionModal} from '@app/components/modals/EditConnectionModal';
import {
	SettingsTabContainer,
	SettingsTabHeader,
	SettingsTabSection,
} from '@app/components/modals/shared/SettingsTabLayout';
import {StatusSlate} from '@app/components/modals/shared/StatusSlate';
import styles from '@app/components/modals/tabs/LinkedAccountsTab.module.css';
import {Spinner} from '@app/components/uikit/Spinner';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {useMergeRefs} from '@app/hooks/useMergeRefs';
import type {ConnectionRecord} from '@app/records/ConnectionRecord';
import UserConnectionStore from '@app/stores/UserConnectionStore';
import {type ConnectionType, ConnectionTypes} from '@fluxer/constants/src/ConnectionConstants';
import {Trans, useLingui} from '@lingui/react/macro';
import {DotsSixVerticalIcon, GlobeSimpleIcon, PencilSimpleIcon, TrashIcon, UserListIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {ConnectableElement} from 'react-dnd';
import {DndProvider, useDrag, useDrop} from 'react-dnd';
import {getEmptyImage, HTML5Backend} from 'react-dnd-html5-backend';

interface ConnectionCardProps {
	connection: ConnectionRecord;
	index: number;
	onDelete: () => void;
	onEdit: () => void;
	onMoveConnection: (dragIndex: number, hoverIndex: number) => void;
	onDropConnection: () => void;
}

const ConnectionCard: React.FC<ConnectionCardProps> = observer(
	({connection, index, onDelete, onEdit, onMoveConnection, onDropConnection}) => {
		const {t} = useLingui();
		const [dropIndicator, setDropIndicator] = useState<'top' | 'bottom' | null>(null);
		const cardRef = useRef<HTMLDivElement>(null);

		const dragItemData = useMemo<ConnectionDragItem>(
			() => ({
				type: DND_TYPES.CONNECTION,
				id: connection.id,
				index,
			}),
			[connection.id, index],
		);

		const [{isDragging}, dragRef, preview] = useDrag(
			() => ({
				type: DND_TYPES.CONNECTION,
				item: () => dragItemData,
				collect: (monitor) => ({isDragging: monitor.isDragging()}),
				end: () => setDropIndicator(null),
			}),
			[dragItemData],
		);

		const [{isOver}, dropRef] = useDrop(
			() => ({
				accept: DND_TYPES.CONNECTION,
				hover: (item: ConnectionDragItem, monitor) => {
					if (item.id === connection.id) {
						setDropIndicator(null);
						return;
					}
					const node = cardRef.current;
					if (!node) return;
					const clientOffset = monitor.getClientOffset();
					if (!clientOffset) return;
					const boundingRect = node.getBoundingClientRect();
					const dropPos = computeVerticalDropPosition(clientOffset, boundingRect);

					setDropIndicator(dropPos === 'before' ? 'top' : 'bottom');

					const hoverIndex = index;
					const dragIndex = item.index;
					if (dragIndex === hoverIndex) return;

					onMoveConnection(dragIndex, hoverIndex);
					item.index = hoverIndex;
				},
				drop: () => {
					setDropIndicator(null);
					onDropConnection();
				},
				collect: (monitor) => ({
					isOver: monitor.isOver({shallow: true}),
				}),
			}),
			[connection.id, index, onMoveConnection, onDropConnection],
		);

		useEffect(() => {
			preview(getEmptyImage(), {captureDraggingState: true});
		}, [preview]);

		useEffect(() => {
			if (!isOver) {
				setDropIndicator(null);
			}
		}, [isOver]);

		const dragConnectorRef = useCallback(
			(node: ConnectableElement | null) => {
				dragRef(node);
			},
			[dragRef],
		);
		const dropConnectorRef = useCallback(
			(node: ConnectableElement | null) => {
				dropRef(node);
			},
			[dropRef],
		);
		const mergedRef = useMergeRefs([dropConnectorRef, cardRef]);

		const icon =
			connection.type === ConnectionTypes.BLUESKY ? (
				<BlueskyIcon size={20} />
			) : (
				<GlobeSimpleIcon size={20} className={styles.domainIcon} />
			);

		return (
			<div
				ref={mergedRef}
				className={clsx(
					styles.card,
					isDragging && styles.cardDragging,
					dropIndicator === 'top' && styles.dropIndicatorTop,
					dropIndicator === 'bottom' && styles.dropIndicatorBottom,
				)}
			>
				<div ref={dragConnectorRef} className={styles.cardDragHandle}>
					<DotsSixVerticalIcon size={20} weight="bold" />
				</div>
				<Tooltip text={connection.type === ConnectionTypes.BLUESKY ? t`Bluesky` : t`Domain`}>
					<div className={styles.cardIconSquircle}>{icon}</div>
				</Tooltip>
				<div className={styles.cardInfo}>
					<div className={styles.cardNameRow}>
						<span className={styles.cardName}>{connection.name}</span>
						<Tooltip
							text={
								connection.verified ? t`This connection has been verified.` : t`This connection has not been verified.`
							}
						>
							<div className={styles.verificationBadge}>
								{connection.verified ? <VerifiedConnectionIcon size={16} /> : <UnverifiedConnectionIcon size={16} />}
							</div>
						</Tooltip>
					</div>
				</div>
				<div className={styles.cardActions}>
					<Tooltip text={t`Edit`}>
						<button type="button" className={styles.actionButton} onClick={onEdit} aria-label={t`Edit`}>
							<PencilSimpleIcon size={16} />
						</button>
					</Tooltip>
					<Tooltip text={t`Remove`}>
						<button type="button" className={styles.actionButton} onClick={onDelete} aria-label={t`Remove`}>
							<TrashIcon size={16} />
						</button>
					</Tooltip>
				</div>
			</div>
		);
	},
);

const LinkedAccountsTab: React.FC = observer(() => {
	const {t, i18n} = useLingui();
	const [loaded, setLoaded] = useState(false);
	const [localOrder, setLocalOrder] = useState<ReadonlyArray<ConnectionRecord> | null>(null);

	useEffect(() => {
		if (!loaded) {
			ConnectionActionCreators.fetchConnections().finally(() => setLoaded(true));
		}
	}, [loaded]);

	useEffect(() => {
		function handleVisibilityChange() {
			if (document.visibilityState === 'visible') {
				ConnectionActionCreators.fetchConnections();
			}
		}
		document.addEventListener('visibilitychange', handleVisibilityChange);
		return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
	}, []);

	const storeConnections = UserConnectionStore.getConnections();
	const connections = localOrder ?? storeConnections;

	const handleMoveConnection = useCallback(
		(dragIndex: number, hoverIndex: number) => {
			const current = localOrder ? [...localOrder] : [...storeConnections];
			const dragged = current[dragIndex];
			current.splice(dragIndex, 1);
			current.splice(hoverIndex, 0, dragged);
			setLocalOrder(current);
		},
		[localOrder, storeConnections],
	);

	const handleDropConnection = useCallback(async () => {
		if (!localOrder) return;
		const connectionIds = localOrder.map((c) => c.id);
		setLocalOrder(null);
		await ConnectionActionCreators.reorderConnections(i18n, connectionIds);
	}, [i18n, localOrder]);

	const handleDelete = useCallback(
		(connection: ConnectionRecord) => {
			ModalActionCreators.push(
				modal(() => (
					<ConfirmModal
						title={t`Remove Connection`}
						description={t`Are you sure you want to remove this connection? This action cannot be undone.`}
						primaryText={t`Remove`}
						primaryVariant="danger-primary"
						onPrimary={async () => {
							await ConnectionActionCreators.deleteConnection(i18n, connection.type, connection.id);
						}}
					/>
				)),
			);
		},
		[i18n, t],
	);

	const handleEdit = useCallback((connection: ConnectionRecord) => {
		ModalActionCreators.push(modal(() => <EditConnectionModal connection={connection} />));
	}, []);

	const handleAddConnection = useCallback((connectionType: ConnectionType) => {
		ModalActionCreators.push(modal(() => <AddConnectionModal defaultType={connectionType} />));
	}, []);

	if (!loaded) {
		return (
			<div className={styles.spinnerWrapper}>
				<Spinner />
			</div>
		);
	}

	return (
		<SettingsTabContainer>
			<SettingsTabHeader
				title={t`Connections`}
				description={
					<Trans>
						Link external accounts and domains to your Fluxer profile. Verified connections will be displayed on your
						profile for others to see.
					</Trans>
				}
			/>

			<SettingsTabSection>
				<div className={styles.platformRow}>
					<Tooltip text={t`Bluesky`}>
						<button
							type="button"
							className={styles.platformIconButton}
							onClick={() => handleAddConnection(ConnectionTypes.BLUESKY)}
							aria-label={t`Add Bluesky connection`}
						>
							<BlueskyIcon size={28} />
						</button>
					</Tooltip>
					<Tooltip text={t`Domain`}>
						<button
							type="button"
							className={styles.platformIconButton}
							onClick={() => handleAddConnection(ConnectionTypes.DOMAIN)}
							aria-label={t`Add domain connection`}
						>
							<GlobeSimpleIcon size={28} className={styles.domainIcon} />
						</button>
					</Tooltip>
				</div>

				{connections.length === 0 ? (
					<div className={styles.emptyState}>
						<StatusSlate
							Icon={UserListIcon}
							title={<Trans>No connections yet</Trans>}
							description={
								<Trans>Link your Bluesky account or verify domain ownership to display them on your profile.</Trans>
							}
						/>
					</div>
				) : (
					<DndProvider backend={HTML5Backend}>
						<div className={styles.connectionsList}>
							{connections.map((connection, index) => (
								<ConnectionCard
									key={connection.id}
									connection={connection}
									index={index}
									onDelete={() => handleDelete(connection)}
									onEdit={() => handleEdit(connection)}
									onMoveConnection={handleMoveConnection}
									onDropConnection={handleDropConnection}
								/>
							))}
						</div>
					</DndProvider>
				)}
			</SettingsTabSection>
		</SettingsTabContainer>
	);
});

export default LinkedAccountsTab;
