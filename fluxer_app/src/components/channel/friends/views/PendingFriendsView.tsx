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

import {EmptyStateView} from '@app/components/channel/friends/EmptyStateView';
import {FriendListItem} from '@app/components/channel/friends/FriendListItem';
import {ListSection} from '@app/components/channel/friends/ListSection';
import styles from '@app/components/channel/friends/views/PendingFriendsView.module.css';
import {Scroller} from '@app/components/uikit/Scroller';
import type {RelationshipRecord} from '@app/records/RelationshipRecord';
import UserStore from '@app/stores/UserStore';
import * as NicknameUtils from '@app/utils/NicknameUtils';
import {RelationshipTypes} from '@fluxer/constants/src/UserConstants';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';

interface PendingFriendsViewProps {
	relationships: Record<string, RelationshipRecord>;
	openProfile: (userId: string) => void;
	searchQuery: string;
}

export const PendingFriendsView: React.FC<PendingFriendsViewProps> = observer(
	({relationships, openProfile, searchQuery}) => {
		const {t} = useLingui();

		const allRelationships = Object.values(relationships);
		const incomingRequests = allRelationships.filter(
			(relation) => relation.type === RelationshipTypes.INCOMING_REQUEST,
		);
		const outgoingRequests = allRelationships.filter(
			(relation) => relation.type === RelationshipTypes.OUTGOING_REQUEST,
		);

		const pendingCount = incomingRequests.length + outgoingRequests.length;

		const normalizedQuery = searchQuery.trim().toLowerCase();
		const hasSearch = normalizedQuery.length > 0;

		const matchesSearch = (userId: string) => {
			if (!hasSearch) {
				return true;
			}
			const user = UserStore.getUser(userId);
			const nickname = user ? NicknameUtils.getNickname(user) : '';
			const username = user?.username ?? '';
			return `${nickname} ${username}`.toLowerCase().includes(normalizedQuery);
		};

		const sortByDisplayName = (requests: Array<RelationshipRecord>) =>
			[...requests].sort((a, b) => {
				const userA = UserStore.getUser(a.id);
				const userB = UserStore.getUser(b.id);
				if (!userA || !userB) return 0;
				return NicknameUtils.getNickname(userA).localeCompare(NicknameUtils.getNickname(userB));
			});

		const visibleIncoming = sortByDisplayName(
			hasSearch ? incomingRequests.filter((request) => matchesSearch(request.id)) : incomingRequests,
		);
		const visibleOutgoing = sortByDisplayName(
			hasSearch ? outgoingRequests.filter((request) => matchesSearch(request.id)) : outgoingRequests,
		);

		if (pendingCount === 0) {
			return (
				<EmptyStateView title={t`No Pending Requests`} subtitle={t`Hello? McFly? Anybody trying to add you yet?`} />
			);
		}

		if (hasSearch && visibleIncoming.length === 0 && visibleOutgoing.length === 0) {
			return (
				<EmptyStateView
					title={t`No pending requests match your search`}
					subtitle={t`Try another name or check your spelling.`}
				/>
			);
		}

		return (
			<Scroller className={styles.scroller} key="pending-friends-view-scroller">
				<div className={styles.pendingViewContainer}>
					{visibleIncoming.length > 0 && (
						<ListSection title={t`Incoming Friend Requests`} count={visibleIncoming.length} marginBottom={true}>
							{visibleIncoming.map((request) => (
								<FriendListItem
									key={request.id}
									userId={request.id}
									relationshipType={RelationshipTypes.INCOMING_REQUEST}
									openProfile={openProfile}
								/>
							))}
						</ListSection>
					)}

					{visibleOutgoing.length > 0 && (
						<ListSection title={t`Outgoing Friend Requests`} count={visibleOutgoing.length}>
							{visibleOutgoing.map((request) => (
								<FriendListItem
									key={request.id}
									userId={request.id}
									relationshipType={RelationshipTypes.OUTGOING_REQUEST}
									openProfile={openProfile}
								/>
							))}
						</ListSection>
					)}
				</div>
			</Scroller>
		);
	},
);
