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

import type {UserID} from '@fluxer/api/src/BrandedTypes';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import type {LimitConfigService} from '@fluxer/api/src/limits/LimitConfigService';
import {resolveLimitSafe} from '@fluxer/api/src/limits/LimitConfigUtils';
import {createLimitMatchContext} from '@fluxer/api/src/limits/LimitMatchContextBuilder';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {Relationship} from '@fluxer/api/src/models/Relationship';
import type {User} from '@fluxer/api/src/models/User';
import type {IUserAccountRepository} from '@fluxer/api/src/user/repositories/IUserAccountRepository';
import type {IUserRelationshipRepository} from '@fluxer/api/src/user/repositories/IUserRelationshipRepository';
import {getCachedUserPartialResponse} from '@fluxer/api/src/user/UserCacheHelpers';
import {mapRelationshipToResponse} from '@fluxer/api/src/user/UserMappers';
import type {UserPermissionUtils} from '@fluxer/api/src/utils/UserPermissionUtils';
import type {LimitKey} from '@fluxer/constants/src/LimitConfigMetadata';
import {MAX_RELATIONSHIPS} from '@fluxer/constants/src/LimitConstants';
import {RelationshipTypes, UserFlags} from '@fluxer/constants/src/UserConstants';
import {BotsCannotSendFriendRequestsError} from '@fluxer/errors/src/domains/oauth/BotsCannotSendFriendRequestsError';
import {AlreadyFriendsError} from '@fluxer/errors/src/domains/user/AlreadyFriendsError';
import {CannotSendFriendRequestToBlockedUserError} from '@fluxer/errors/src/domains/user/CannotSendFriendRequestToBlockedUserError';
import {CannotSendFriendRequestToSelfError} from '@fluxer/errors/src/domains/user/CannotSendFriendRequestToSelfError';
import {FriendRequestBlockedError} from '@fluxer/errors/src/domains/user/FriendRequestBlockedError';
import {InvalidDiscriminatorError} from '@fluxer/errors/src/domains/user/InvalidDiscriminatorError';
import {MaxRelationshipsError} from '@fluxer/errors/src/domains/user/MaxRelationshipsError';
import {NoUsersWithFluxertagError} from '@fluxer/errors/src/domains/user/NoUsersWithFluxertagError';
import {UnclaimedAccountCannotAcceptFriendRequestsError} from '@fluxer/errors/src/domains/user/UnclaimedAccountCannotAcceptFriendRequestsError';
import {UnclaimedAccountCannotSendFriendRequestsError} from '@fluxer/errors/src/domains/user/UnclaimedAccountCannotSendFriendRequestsError';
import {UnknownUserError} from '@fluxer/errors/src/domains/user/UnknownUserError';
import type {FriendRequestByTagRequest} from '@fluxer/schema/src/domains/user/UserRequestSchemas';

export class UserRelationshipService {
	constructor(
		private userAccountRepository: IUserAccountRepository,
		private userRelationshipRepository: IUserRelationshipRepository,
		private gatewayService: IGatewayService,
		private userPermissionUtils: UserPermissionUtils,
		private readonly limitConfigService: LimitConfigService,
	) {}

	async getRelationships(userId: UserID): Promise<Array<Relationship>> {
		return await this.userRelationshipRepository.listRelationships(userId);
	}

	async sendFriendRequestByTag({
		userId,
		data,
		userCacheService,
		requestCache,
	}: {
		userId: UserID;
		data: FriendRequestByTagRequest;
		userCacheService: UserCacheService;
		requestCache: RequestCache;
	}): Promise<Relationship> {
		const {username, discriminator} = data;
		const discrimValue = discriminator;
		if (!Number.isInteger(discrimValue) || discrimValue < 0 || discrimValue > 9999) {
			throw new InvalidDiscriminatorError();
		}
		const targetUser = await this.userAccountRepository.findByUsernameDiscriminator(username, discrimValue);
		if (!targetUser) {
			throw new NoUsersWithFluxertagError();
		}
		if (this.isDeletedUser(targetUser)) {
			throw new FriendRequestBlockedError();
		}
		const existingRelationship = await this.userRelationshipRepository.getRelationship(
			userId,
			targetUser.id,
			RelationshipTypes.FRIEND,
		);
		if (existingRelationship) {
			throw new AlreadyFriendsError();
		}
		return this.sendFriendRequest({userId, targetId: targetUser.id, userCacheService, requestCache});
	}

	async sendFriendRequest({
		userId,
		targetId,
		userCacheService,
		requestCache,
	}: {
		userId: UserID;
		targetId: UserID;
		userCacheService: UserCacheService;
		requestCache: RequestCache;
	}): Promise<Relationship> {
		const targetUser = await this.validateFriendRequest({userId, targetId});
		const pendingIncoming = await this.userRelationshipRepository.getRelationship(
			targetId,
			userId,
			RelationshipTypes.OUTGOING_REQUEST,
		);
		if (pendingIncoming) {
			return this.acceptFriendRequest({userId, targetId, userCacheService, requestCache});
		}
		const existingFriendship = await this.userRelationshipRepository.getRelationship(
			userId,
			targetId,
			RelationshipTypes.FRIEND,
		);
		const existingOutgoingRequest = await this.userRelationshipRepository.getRelationship(
			userId,
			targetId,
			RelationshipTypes.OUTGOING_REQUEST,
		);
		if (existingFriendship || existingOutgoingRequest) {
			const relationships = await this.userRelationshipRepository.listRelationships(userId);
			const relationship = relationships.find((r) => r.targetUserId === targetId);
			if (relationship) {
				return relationship;
			}
		}
		await this.validateRelationshipCounts({userId, targetId});
		const requestRelationship = await this.createFriendRequest({userId, targetId, userCacheService, requestCache});

		const targetIsFriendlyBot =
			targetUser.isBot && (targetUser.flags & UserFlags.FRIENDLY_BOT) === UserFlags.FRIENDLY_BOT;
		const manualApprovalFlag = UserFlags.FRIENDLY_BOT_MANUAL_APPROVAL;
		const manualApprovalRequired = targetUser.isBot && (targetUser.flags & manualApprovalFlag) === manualApprovalFlag;

		if (targetIsFriendlyBot && !manualApprovalRequired) {
			const finalFriendship = await this.acceptFriendRequest({
				userId: targetId,
				targetId: userId,
				userCacheService,
				requestCache,
			});
			return finalFriendship;
		}

		return requestRelationship;
	}

	async acceptFriendRequest({
		userId,
		targetId,
		userCacheService,
		requestCache,
	}: {
		userId: UserID;
		targetId: UserID;
		userCacheService: UserCacheService;
		requestCache: RequestCache;
	}): Promise<Relationship> {
		const user = await this.userAccountRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}
		if (this.isDeletedUser(user)) {
			throw new FriendRequestBlockedError();
		}
		if (user?.isUnclaimedAccount()) {
			throw new UnclaimedAccountCannotAcceptFriendRequestsError();
		}
		const requesterUser = await this.userAccountRepository.findUnique(targetId);
		if (!requesterUser) {
			throw new UnknownUserError();
		}
		if (this.isDeletedUser(requesterUser)) {
			throw new FriendRequestBlockedError();
		}

		const incomingRequest = await this.userRelationshipRepository.getRelationship(
			userId,
			targetId,
			RelationshipTypes.INCOMING_REQUEST,
		);
		if (!incomingRequest) {
			throw new UnknownUserError();
		}
		await this.validateRelationshipCounts({userId, targetId});

		await this.userRelationshipRepository.deleteRelationship(userId, targetId, RelationshipTypes.INCOMING_REQUEST);
		await this.userRelationshipRepository.deleteRelationship(targetId, userId, RelationshipTypes.OUTGOING_REQUEST);

		const now = new Date();
		const userRelationship = await this.userRelationshipRepository.upsertRelationship({
			source_user_id: userId,
			target_user_id: targetId,
			type: RelationshipTypes.FRIEND,
			nickname: null,
			since: now,
			version: 1,
		});
		const targetRelationship = await this.userRelationshipRepository.upsertRelationship({
			source_user_id: targetId,
			target_user_id: userId,
			type: RelationshipTypes.FRIEND,
			nickname: null,
			since: now,
			version: 1,
		});
		await this.dispatchRelationshipUpdate({
			userId,
			relationship: userRelationship,
			userCacheService,
			requestCache,
		});
		await this.dispatchRelationshipUpdate({
			userId: targetId,
			relationship: targetRelationship,
			userCacheService,
			requestCache,
		});

		return userRelationship;
	}

	async blockUser({
		userId,
		targetId,
		userCacheService,
		requestCache,
	}: {
		userId: UserID;
		targetId: UserID;
		userCacheService: UserCacheService;
		requestCache: RequestCache;
	}): Promise<Relationship> {
		const targetUser = await this.userAccountRepository.findUnique(targetId);
		if (!targetUser) {
			throw new UnknownUserError();
		}

		const existingBlocked = await this.userRelationshipRepository.getRelationship(
			userId,
			targetId,
			RelationshipTypes.BLOCKED,
		);
		if (existingBlocked) {
			return existingBlocked;
		}

		const existingFriend = await this.userRelationshipRepository.getRelationship(
			userId,
			targetId,
			RelationshipTypes.FRIEND,
		);
		const existingIncomingRequest = await this.userRelationshipRepository.getRelationship(
			userId,
			targetId,
			RelationshipTypes.INCOMING_REQUEST,
		);
		const existingOutgoingRequest = await this.userRelationshipRepository.getRelationship(
			userId,
			targetId,
			RelationshipTypes.OUTGOING_REQUEST,
		);

		if (existingFriend) {
			await this.userRelationshipRepository.deleteRelationship(userId, targetId, RelationshipTypes.FRIEND);
			await this.userRelationshipRepository.deleteRelationship(targetId, userId, RelationshipTypes.FRIEND);
			await this.dispatchRelationshipRemove({userId: targetId, targetId: userId.toString()});
		} else if (existingOutgoingRequest) {
			await this.userRelationshipRepository.deleteRelationship(userId, targetId, RelationshipTypes.OUTGOING_REQUEST);
			await this.userRelationshipRepository.deleteRelationship(targetId, userId, RelationshipTypes.INCOMING_REQUEST);
			await this.dispatchRelationshipRemove({userId: targetId, targetId: userId.toString()});
		} else if (existingIncomingRequest) {
			await this.userRelationshipRepository.deleteRelationship(userId, targetId, RelationshipTypes.INCOMING_REQUEST);
		}

		const now = new Date();
		const blockRelationship = await this.userRelationshipRepository.upsertRelationship({
			source_user_id: userId,
			target_user_id: targetId,
			type: RelationshipTypes.BLOCKED,
			nickname: null,
			since: now,
			version: 1,
		});

		await this.dispatchRelationshipCreate({
			userId,
			relationship: blockRelationship,
			userCacheService,
			requestCache,
		});

		return blockRelationship;
	}

	async removeRelationship({userId, targetId}: {userId: UserID; targetId: UserID}): Promise<void> {
		const [friend, incoming, outgoing, blocked] = await Promise.all([
			this.userRelationshipRepository.getRelationship(userId, targetId, RelationshipTypes.FRIEND),
			this.userRelationshipRepository.getRelationship(userId, targetId, RelationshipTypes.INCOMING_REQUEST),
			this.userRelationshipRepository.getRelationship(userId, targetId, RelationshipTypes.OUTGOING_REQUEST),
			this.userRelationshipRepository.getRelationship(userId, targetId, RelationshipTypes.BLOCKED),
		]);

		const existingRelationship = friend || incoming || outgoing || blocked;
		if (!existingRelationship) throw new UnknownUserError();
		const relationshipType = existingRelationship.type;
		if (relationshipType === RelationshipTypes.INCOMING_REQUEST || relationshipType === RelationshipTypes.BLOCKED) {
			await this.userRelationshipRepository.deleteRelationship(userId, targetId, relationshipType);
			await this.dispatchRelationshipRemove({
				userId,
				targetId: targetId.toString(),
			});
			return;
		}
		if (relationshipType === RelationshipTypes.OUTGOING_REQUEST) {
			await this.userRelationshipRepository.deleteRelationship(userId, targetId, RelationshipTypes.OUTGOING_REQUEST);
			await this.userRelationshipRepository.deleteRelationship(targetId, userId, RelationshipTypes.INCOMING_REQUEST);
			await this.dispatchRelationshipRemove({userId, targetId: targetId.toString()});
			await this.dispatchRelationshipRemove({userId: targetId, targetId: userId.toString()});
			return;
		}
		if (relationshipType === RelationshipTypes.FRIEND) {
			await this.userRelationshipRepository.deleteRelationship(userId, targetId, RelationshipTypes.FRIEND);
			await this.userRelationshipRepository.deleteRelationship(targetId, userId, RelationshipTypes.FRIEND);
			await this.dispatchRelationshipRemove({userId, targetId: targetId.toString()});
			await this.dispatchRelationshipRemove({userId: targetId, targetId: userId.toString()});
			return;
		}
		await this.userRelationshipRepository.deleteRelationship(userId, targetId, relationshipType);
		await this.dispatchRelationshipRemove({userId, targetId: targetId.toString()});
	}

	async updateFriendNickname({
		userId,
		targetId,
		nickname,
		userCacheService,
		requestCache,
	}: {
		userId: UserID;
		targetId: UserID;
		nickname: string | null;
		userCacheService: UserCacheService;
		requestCache: RequestCache;
	}): Promise<Relationship> {
		const relationship = await this.userRelationshipRepository.getRelationship(
			userId,
			targetId,
			RelationshipTypes.FRIEND,
		);
		if (!relationship) {
			throw new UnknownUserError();
		}

		const updatedRelationship = await this.userRelationshipRepository.upsertRelationship({
			source_user_id: userId,
			target_user_id: targetId,
			type: RelationshipTypes.FRIEND,
			nickname,
			since: relationship.since ?? new Date(),
			version: 1,
		});

		await this.dispatchRelationshipUpdate({
			userId,
			relationship: updatedRelationship,
			userCacheService,
			requestCache,
		});

		return updatedRelationship;
	}

	private async validateFriendRequest({userId, targetId}: {userId: UserID; targetId: UserID}): Promise<User> {
		if (userId === targetId) {
			throw new CannotSendFriendRequestToSelfError();
		}

		const requesterUser = await this.userAccountRepository.findUnique(userId);
		if (!requesterUser) {
			throw new UnknownUserError();
		}
		if (this.isDeletedUser(requesterUser)) {
			throw new FriendRequestBlockedError();
		}
		if (requesterUser?.isUnclaimedAccount()) {
			throw new UnclaimedAccountCannotSendFriendRequestsError();
		}
		if (requesterUser?.isBot) {
			throw new BotsCannotSendFriendRequestsError();
		}

		const targetUser = await this.userAccountRepository.findUnique(targetId);
		if (!targetUser) throw new UnknownUserError();
		if (this.isDeletedUser(targetUser)) {
			throw new FriendRequestBlockedError();
		}

		const targetIsFriendlyBot =
			targetUser.isBot && (targetUser.flags & UserFlags.FRIENDLY_BOT) === UserFlags.FRIENDLY_BOT;
		if (targetUser.isBot && !targetIsFriendlyBot) {
			throw new FriendRequestBlockedError();
		}
		if (targetUser.flags & UserFlags.APP_STORE_REVIEWER) {
			throw new FriendRequestBlockedError();
		}
		const requesterBlockedTarget = await this.userRelationshipRepository.getRelationship(
			userId,
			targetId,
			RelationshipTypes.BLOCKED,
		);
		if (requesterBlockedTarget) {
			throw new CannotSendFriendRequestToBlockedUserError();
		}
		const targetBlockedRequester = await this.userRelationshipRepository.getRelationship(
			targetId,
			userId,
			RelationshipTypes.BLOCKED,
		);
		if (targetBlockedRequester) {
			throw new FriendRequestBlockedError();
		}
		await this.userPermissionUtils.validateFriendSourcePermissions({userId, targetId});

		return targetUser;
	}

	private async validateRelationshipCounts({userId, targetId}: {userId: UserID; targetId: UserID}): Promise<void> {
		const user = await this.userAccountRepository.findUnique(userId);
		const targetUser = await this.userAccountRepository.findUnique(targetId);

		if (!user?.isBot) {
			const userLimit = this.resolveLimitForUser(user ?? null, 'max_relationships', MAX_RELATIONSHIPS);
			const hasReachedLimit = await this.userRelationshipRepository.hasReachedRelationshipLimit(userId, userLimit);
			if (hasReachedLimit) {
				throw new MaxRelationshipsError(userLimit);
			}
		}

		if (!targetUser?.isBot) {
			const targetLimit = this.resolveLimitForUser(targetUser ?? null, 'max_relationships', MAX_RELATIONSHIPS);
			const hasReachedLimit = await this.userRelationshipRepository.hasReachedRelationshipLimit(targetId, targetLimit);
			if (hasReachedLimit) {
				throw new MaxRelationshipsError(targetLimit);
			}
		}
	}

	private async createFriendRequest({
		userId,
		targetId,
		userCacheService,
		requestCache,
	}: {
		userId: UserID;
		targetId: UserID;
		userCacheService: UserCacheService;
		requestCache: RequestCache;
	}): Promise<Relationship> {
		const now = new Date();
		const userRelationship = await this.userRelationshipRepository.upsertRelationship({
			source_user_id: userId,
			target_user_id: targetId,
			type: RelationshipTypes.OUTGOING_REQUEST,
			nickname: null,
			since: now,
			version: 1,
		});
		const targetRelationship = await this.userRelationshipRepository.upsertRelationship({
			source_user_id: targetId,
			target_user_id: userId,
			type: RelationshipTypes.INCOMING_REQUEST,
			nickname: null,
			since: now,
			version: 1,
		});
		await this.dispatchRelationshipCreate({userId, relationship: userRelationship, userCacheService, requestCache});
		await this.dispatchRelationshipCreate({
			userId: targetId,
			relationship: targetRelationship,
			userCacheService,
			requestCache,
		});
		return userRelationship;
	}

	async dispatchRelationshipCreate({
		userId,
		relationship,
		userCacheService,
		requestCache,
	}: {
		userId: UserID;
		relationship: Relationship;
		userCacheService: UserCacheService;
		requestCache: RequestCache;
	}): Promise<void> {
		const userPartialResolver = (userId: UserID) =>
			getCachedUserPartialResponse({userId, userCacheService, requestCache});
		await this.gatewayService.dispatchPresence({
			userId,
			event: 'RELATIONSHIP_ADD',
			data: await mapRelationshipToResponse({relationship, userPartialResolver}),
		});
	}

	async dispatchRelationshipUpdate({
		userId,
		relationship,
		userCacheService,
		requestCache,
	}: {
		userId: UserID;
		relationship: Relationship;
		userCacheService: UserCacheService;
		requestCache: RequestCache;
	}): Promise<void> {
		const userPartialResolver = (userId: UserID) =>
			getCachedUserPartialResponse({userId, userCacheService, requestCache});
		await this.gatewayService.dispatchPresence({
			userId,
			event: 'RELATIONSHIP_UPDATE',
			data: await mapRelationshipToResponse({relationship, userPartialResolver}),
		});
	}

	async dispatchRelationshipRemove({userId, targetId}: {userId: UserID; targetId: string}): Promise<void> {
		await this.gatewayService.dispatchPresence({
			userId,
			event: 'RELATIONSHIP_REMOVE',
			data: {id: targetId},
		});
	}

	private resolveLimitForUser(user: User | null, key: LimitKey, fallback: number): number {
		const ctx = createLimitMatchContext({user});
		return resolveLimitSafe(this.limitConfigService.getConfigSnapshot(), ctx, key, fallback);
	}

	private isDeletedUser(user: User | null | undefined): boolean {
		if (!user) {
			return false;
		}

		return (user.flags & UserFlags.DELETED) === UserFlags.DELETED;
	}
}
