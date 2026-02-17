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

import {AddFriendForm} from '@app/components/channel/direct_message/AddFriendForm';
import {MobileFriendRequestItem} from '@app/components/channel/friends/MobileFriendRequestItem';
import styles from '@app/components/modals/AddFriendSheet.module.css';
import {BottomSheet} from '@app/components/uikit/bottom_sheet/BottomSheet';
import {Scroller} from '@app/components/uikit/Scroller';
import RelationshipStore from '@app/stores/RelationshipStore';
import {RelationshipTypes} from '@fluxer/constants/src/UserConstants';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import React from 'react';

interface AddFriendSheetProps {
	isOpen: boolean;
	onClose: () => void;
}

export const AddFriendSheet: React.FC<AddFriendSheetProps> = observer(({isOpen, onClose}) => {
	const {t} = useLingui();
	const relationships = RelationshipStore.getRelationships();
	const incomingRequests = relationships.filter((relation) => relation.type === RelationshipTypes.INCOMING_REQUEST);
	const outgoingRequests = relationships.filter((relation) => relation.type === RelationshipTypes.OUTGOING_REQUEST);

	const hasPendingRequests = incomingRequests.length > 0 || outgoingRequests.length > 0;

	return (
		<BottomSheet
			isOpen={isOpen}
			onClose={onClose}
			snapPoints={[0, 1]}
			initialSnap={1}
			title={t`Add Friend`}
			disablePadding
		>
			<div className={styles.container}>
				<Scroller className={styles.scroller} key="add-friend-sheet-scroller">
					<div className={styles.content}>
						<AddFriendForm />

						{hasPendingRequests && (
							<div className={styles.requestsSection}>
								{incomingRequests.length > 0 && (
									<div className={styles.requestsGroup}>
										<div className={styles.requestsHeader}>
											{t`Incoming friend requests`} — {incomingRequests.length}
										</div>
										<div className={styles.requestsList}>
											{incomingRequests.map((request, index) => (
												<React.Fragment key={request.id}>
													<MobileFriendRequestItem
														userId={request.id}
														relationshipType={RelationshipTypes.INCOMING_REQUEST}
													/>
													{index < incomingRequests.length - 1 && <div className={styles.requestDivider} />}
												</React.Fragment>
											))}
										</div>
									</div>
								)}

								{outgoingRequests.length > 0 && (
									<div className={styles.requestsGroup}>
										<div className={styles.requestsHeader}>
											{t`Outgoing friend requests`} — {outgoingRequests.length}
										</div>
										<div className={styles.requestsList}>
											{outgoingRequests.map((request, index) => (
												<React.Fragment key={request.id}>
													<MobileFriendRequestItem
														userId={request.id}
														relationshipType={RelationshipTypes.OUTGOING_REQUEST}
													/>
													{index < outgoingRequests.length - 1 && <div className={styles.requestDivider} />}
												</React.Fragment>
											))}
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				</Scroller>
			</div>
		</BottomSheet>
	);
});
