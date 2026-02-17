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

import {requireSudoMode} from '@fluxer/api/src/auth/services/SudoVerificationService';
import {createGuildID, createUserID} from '@fluxer/api/src/BrandedTypes';
import {DefaultUserOnly, LoginRequired, LoginRequiredAllowSuspicious} from '@fluxer/api/src/middleware/AuthMiddleware';
import {requireOAuth2ScopeForBearer} from '@fluxer/api/src/middleware/OAuth2ScopeMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {SudoModeMiddleware} from '@fluxer/api/src/middleware/SudoModeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import type {UserUpdateWithVerificationRequestData} from '@fluxer/api/src/user/services/UserAccountRequestService';
import {getCachedUserPartialResponse} from '@fluxer/api/src/user/UserCacheHelpers';
import {
	mapUserGuildSettingsToResponse,
	mapUserSettingsToResponse,
	mapUserToPrivateResponse,
} from '@fluxer/api/src/user/UserMappers';
import {UserSettingsUpdateRequest} from '@fluxer/api/src/user/UserModel';
import {Validator} from '@fluxer/api/src/Validator';
import {UserFlags} from '@fluxer/constants/src/UserConstants';
import {MissingAccessError} from '@fluxer/errors/src/domains/core/MissingAccessError';
import {UnknownUserError} from '@fluxer/errors/src/domains/user/UnknownUserError';
import {SudoVerificationSchema} from '@fluxer/schema/src/domains/auth/AuthSchemas';
import {
	GuildIdParam,
	SuccessResponse,
	TargetIdParam,
	UserIdParam,
} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {
	EmailChangeBouncedRequestNewRequest,
	EmailChangeBouncedVerifyNewRequest,
	EmailChangeRequestNewRequest,
	EmailChangeTicketRequest,
	EmailChangeVerifyNewRequest,
	EmailChangeVerifyOriginalRequest,
	EmptyBodyRequest,
	PasswordChangeCompleteRequest,
	PasswordChangeTicketRequest,
	PasswordChangeVerifyRequest,
	PreloadMessagesRequest,
	PushSubscribeRequest,
	SubscriptionIdParam,
	UserGuildSettingsUpdateRequest,
	UserNoteUpdateRequest,
	UserProfileQueryRequest,
	UserTagCheckQueryRequest,
	UserUpdateWithVerificationRequest,
} from '@fluxer/schema/src/domains/user/UserRequestSchemas';
import {
	EmailChangeRequestNewResponse,
	EmailChangeStartResponse,
	EmailChangeVerifyOriginalResponse,
	EmailTokenResponse,
	PasswordChangeStartResponse,
	PasswordChangeVerifyResponse,
	PreloadMessagesResponse,
	PushSubscribeResponse,
	PushSubscriptionsListResponse,
	UserGuildSettingsResponse,
	UserNoteResponse,
	UserNotesRecordResponse,
	UserPartialResponse,
	UserPrivateResponse,
	UserProfileFullResponse,
	UserSettingsResponse,
	UserTagCheckResponse,
} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {ms} from 'itty-time';
import {uint8ArrayToBase64} from 'uint8array-extras';

export function UserAccountController(app: HonoApp) {
	app.get(
		'/users/@me',
		RateLimitMiddleware(RateLimitConfigs.USER_SETTINGS_GET),
		requireOAuth2ScopeForBearer('identify'),
		LoginRequired,
		OpenAPI({
			operationId: 'get_current_user',
			summary: 'Get current user profile',
			responseSchema: UserPrivateResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				"Retrieves the current authenticated user's profile information, including account details and settings. OAuth2 bearer tokens require identify scope, and email is returned only when the email scope is also present. Returns full user object with private fields visible only to the authenticated user.",
		}),
		async (ctx) => {
			const userAccountRequestService = ctx.get('userAccountRequestService');
			return ctx.json(
				userAccountRequestService.getCurrentUserResponse({
					authTokenType: ctx.get('authTokenType'),
					oauthBearerScopes: ctx.get('oauthBearerScopes'),
					user: ctx.get('user'),
				}),
			);
		},
	);

	app.patch(
		'/users/@me',
		RateLimitMiddleware(RateLimitConfigs.USER_UPDATE_SELF),
		LoginRequired,
		DefaultUserOnly,
		SudoModeMiddleware,
		Validator('json', UserUpdateWithVerificationRequest),
		OpenAPI({
			operationId: 'update_current_user',
			summary: 'Update current user profile',
			responseSchema: UserPrivateResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				"Updates the authenticated user's profile information such as username, avatar, and bio. Requires sudo mode verification for security-sensitive changes. Only default users can modify their own profile.",
		}),
		async (ctx) => {
			const userAccountRequestService = ctx.get('userAccountRequestService');
			const user = ctx.get('user');
			const rawBody: UserUpdateWithVerificationRequestData = ctx.req.valid('json');
			return ctx.json(
				await userAccountRequestService.updateCurrentUser({
					ctx,
					user,
					body: rawBody,
					authSession: ctx.get('authSession'),
				}),
			);
		},
	);

	app.post(
		'/users/@me/email-change/start',
		RateLimitMiddleware(RateLimitConfigs.USER_EMAIL_CHANGE_START),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', EmptyBodyRequest),
		OpenAPI({
			operationId: 'start_email_change',
			summary: 'Start email change',
			responseSchema: EmailChangeStartResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Initiates an email change process. Generates a ticket for verifying the original email address before requesting a new email. Returns ticket for use in subsequent email change steps.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const result = await ctx.get('emailChangeService').start(user);
			return ctx.json(result);
		},
	);

	app.post(
		'/users/@me/email-change/resend-original',
		RateLimitMiddleware(RateLimitConfigs.USER_EMAIL_CHANGE_RESEND_ORIGINAL),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', EmailChangeTicketRequest),
		OpenAPI({
			operationId: 'resend_original_email_confirmation',
			summary: 'Resend original email confirmation',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				"Resends a confirmation code to the user's original email address during the email change process. Use this if the original confirmation email was not received. Requires valid email change ticket.",
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const body = ctx.req.valid('json');
			await ctx.get('emailChangeService').resendOriginal(user, body.ticket);
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/users/@me/email-change/verify-original',
		RateLimitMiddleware(RateLimitConfigs.USER_EMAIL_CHANGE_VERIFY_ORIGINAL),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', EmailChangeVerifyOriginalRequest),
		OpenAPI({
			operationId: 'verify_original_email_address',
			summary: 'Verify original email address',
			responseSchema: EmailChangeVerifyOriginalResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Verifies ownership of the original email address by validating a confirmation code sent to that address. Must be completed before requesting a new email address. Returns proof token for use in new email request.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const body = ctx.req.valid('json');
			const result = await ctx.get('emailChangeService').verifyOriginal(user, body.ticket, body.code);
			return ctx.json(result);
		},
	);

	app.post(
		'/users/@me/email-change/request-new',
		RateLimitMiddleware(RateLimitConfigs.USER_EMAIL_CHANGE_REQUEST_NEW),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', EmailChangeRequestNewRequest),
		OpenAPI({
			operationId: 'request_new_email_address',
			summary: 'Request new email address',
			responseSchema: EmailChangeRequestNewResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Requests to change email to a new address. Requires proof of original email verification. Sends confirmation code to new email address for verification.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const body = ctx.req.valid('json');
			const result = await ctx
				.get('emailChangeService')
				.requestNewEmail(user, body.ticket, body.new_email, body.original_proof);
			return ctx.json(result);
		},
	);

	app.post(
		'/users/@me/email-change/resend-new',
		RateLimitMiddleware(RateLimitConfigs.USER_EMAIL_CHANGE_RESEND_NEW),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', EmailChangeTicketRequest),
		OpenAPI({
			operationId: 'resend_new_email_confirmation',
			summary: 'Resend new email confirmation',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Resends a confirmation code to the new email address during the email change process. Use this if the new email confirmation was not received. Requires valid email change ticket.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const body = ctx.req.valid('json');
			await ctx.get('emailChangeService').resendNew(user, body.ticket);
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/users/@me/email-change/verify-new',
		RateLimitMiddleware(RateLimitConfigs.USER_EMAIL_CHANGE_VERIFY_NEW),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', EmailChangeVerifyNewRequest),
		OpenAPI({
			operationId: 'verify_new_email_address',
			summary: 'Verify new email address',
			responseSchema: EmailTokenResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Completes the email change process by verifying the new email address with a confirmation code. Returns an email token that confirms the email change. After this step, the user may need to re-authenticate.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const body = ctx.req.valid('json');
			const emailToken = await ctx
				.get('emailChangeService')
				.verifyNew(user, body.ticket, body.code, body.original_proof);
			return ctx.json({email_token: emailToken});
		},
	);

	app.post(
		'/users/@me/email-change/bounced/request-new',
		RateLimitMiddleware(RateLimitConfigs.USER_EMAIL_CHANGE_BOUNCED_REQUEST_NEW),
		LoginRequiredAllowSuspicious,
		DefaultUserOnly,
		Validator('json', EmailChangeBouncedRequestNewRequest),
		OpenAPI({
			operationId: 'request_bounced_email_replacement',
			summary: 'Request replacement email for bounced address',
			responseSchema: EmailChangeRequestNewResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Starts a dedicated bounced-email recovery flow. Sends a verification code to the replacement email without requiring verification of the old bounced email address.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const body = ctx.req.valid('json');
			const result = await ctx.get('emailChangeService').requestBouncedNewEmail(user, body.new_email);
			return ctx.json(result);
		},
	);

	app.post(
		'/users/@me/email-change/bounced/resend-new',
		RateLimitMiddleware(RateLimitConfigs.USER_EMAIL_CHANGE_BOUNCED_RESEND_NEW),
		LoginRequiredAllowSuspicious,
		DefaultUserOnly,
		Validator('json', EmailChangeTicketRequest),
		OpenAPI({
			operationId: 'resend_bounced_email_replacement_code',
			summary: 'Resend replacement email code',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Resends the verification code for the bounced-email recovery flow to the replacement email address.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const body = ctx.req.valid('json');
			await ctx.get('emailChangeService').resendBouncedNew(user, body.ticket);
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/users/@me/email-change/bounced/verify-new',
		RateLimitMiddleware(RateLimitConfigs.USER_EMAIL_CHANGE_BOUNCED_VERIFY_NEW),
		LoginRequiredAllowSuspicious,
		DefaultUserOnly,
		Validator('json', EmailChangeBouncedVerifyNewRequest),
		OpenAPI({
			operationId: 'verify_bounced_email_replacement',
			summary: 'Verify replacement email for bounced address',
			responseSchema: UserPrivateResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Completes bounced-email recovery by verifying the replacement email code, updating the account email, and clearing email-related suspicious-activity requirements.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const body = ctx.req.valid('json');
			const updatedUser = await ctx.get('emailChangeService').verifyBouncedNew(user, body.ticket, body.code);
			await ctx.get('contactChangeLogService').recordDiff({
				oldUser: user,
				newUser: updatedUser,
				reason: 'user_requested',
				actorUserId: user.id,
			});
			await ctx.get('userService').dispatchUserUpdate(updatedUser);
			return ctx.json(mapUserToPrivateResponse(updatedUser));
		},
	);

	app.post(
		'/users/@me/password-change/start',
		RateLimitMiddleware(RateLimitConfigs.USER_PASSWORD_CHANGE_START),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', EmptyBodyRequest),
		OpenAPI({
			operationId: 'start_password_change',
			summary: 'Start password change',
			responseSchema: PasswordChangeStartResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				"Initiates a password change process. Sends a verification code to the user's email address. Returns a ticket for use in subsequent password change steps.",
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const result = await ctx.get('passwordChangeService').start(user);
			return ctx.json(result);
		},
	);

	app.post(
		'/users/@me/password-change/resend',
		RateLimitMiddleware(RateLimitConfigs.USER_PASSWORD_CHANGE_RESEND),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', PasswordChangeTicketRequest),
		OpenAPI({
			operationId: 'resend_password_change_code',
			summary: 'Resend password change verification code',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Resends the verification code for a password change. Use if the original code was not received. Requires a valid password change ticket.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const body = ctx.req.valid('json');
			await ctx.get('passwordChangeService').resend(user, body.ticket);
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/users/@me/password-change/verify',
		RateLimitMiddleware(RateLimitConfigs.USER_PASSWORD_CHANGE_VERIFY),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', PasswordChangeVerifyRequest),
		OpenAPI({
			operationId: 'verify_password_change_code',
			summary: 'Verify password change code',
			responseSchema: PasswordChangeVerifyResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Verifies the email code sent during password change. Returns a proof token needed to complete the password change.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const body = ctx.req.valid('json');
			const result = await ctx.get('passwordChangeService').verify(user, body.ticket, body.code);
			return ctx.json(result);
		},
	);

	app.post(
		'/users/@me/password-change/complete',
		RateLimitMiddleware(RateLimitConfigs.USER_PASSWORD_CHANGE_COMPLETE),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', PasswordChangeCompleteRequest),
		OpenAPI({
			operationId: 'complete_password_change',
			summary: 'Complete password change',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Completes the password change after email verification. Requires the verification proof and new password. Invalidates all existing sessions.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const body = ctx.req.valid('json');
			await ctx.get('passwordChangeService').complete(user, body.ticket, body.verification_proof, body.new_password);
			const authService = ctx.get('authService');
			const authSession = ctx.get('authSession');
			await authService.terminateAllUserSessions(user.id);
			const [newToken, newAuthSession] = await authService.createAuthSession({user, request: ctx.req.raw});
			await authService.dispatchAuthSessionChange({
				userId: user.id,
				oldAuthSessionIdHash: uint8ArrayToBase64(authSession.sessionIdHash, {urlSafe: true}),
				newAuthSessionIdHash: uint8ArrayToBase64(newAuthSession.sessionIdHash, {urlSafe: true}),
				newToken,
			});
			return ctx.body(null, 204);
		},
	);

	app.get(
		'/users/check-tag',
		RateLimitMiddleware(RateLimitConfigs.USER_CHECK_TAG),
		LoginRequired,
		Validator('query', UserTagCheckQueryRequest),
		OpenAPI({
			operationId: 'check_username_tag_availability',
			summary: 'Check username tag availability',
			responseSchema: UserTagCheckResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Checks if a username and discriminator combination is available for registration. Returns whether the tag is taken by another user.',
		}),
		async (ctx) => {
			const {username, discriminator} = ctx.req.valid('query');
			const currentUser = ctx.get('user');
			const userAccountRequestService = ctx.get('userAccountRequestService');
			if (!userAccountRequestService.checkTagAvailability({currentUser, username, discriminator})) {
				return ctx.json({taken: false});
			}
			const taken = await ctx.get('userService').checkUsernameDiscriminatorAvailability({username, discriminator});
			return ctx.json({taken});
		},
	);

	app.get(
		'/users/:user_id',
		RateLimitMiddleware(RateLimitConfigs.USER_GET),
		LoginRequired,
		Validator('param', UserIdParam),
		OpenAPI({
			operationId: 'get_user_by_id',
			summary: 'Get user by ID',
			responseSchema: UserPartialResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Retrieves public user information by user ID. Returns basic profile details like username, avatar, and status. Does not include private or sensitive user data.',
		}),
		async (ctx) => {
			const userResponse = await getCachedUserPartialResponse({
				userId: createUserID(ctx.req.valid('param').user_id),
				userCacheService: ctx.get('userCacheService'),
				requestCache: ctx.get('requestCache'),
			});
			return ctx.json(userResponse);
		},
	);

	app.get(
		'/users/:target_id/profile',
		RateLimitMiddleware(RateLimitConfigs.USER_GET_PROFILE),
		LoginRequired,
		Validator('param', TargetIdParam),
		Validator('query', UserProfileQueryRequest),
		OpenAPI({
			operationId: 'get_user_profile',
			summary: 'Get user profile',
			responseSchema: UserProfileFullResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Retrieves detailed profile information for a user, including bio, custom status, and badges. Optionally includes mutual friends and mutual guilds if requested. May respect privacy settings.',
		}),
		async (ctx) => {
			const {target_id} = ctx.req.valid('param');
			const {guild_id, with_mutual_friends, with_mutual_guilds} = ctx.req.valid('query');
			const currentUserId = ctx.get('user').id;
			const targetUserId = createUserID(target_id);
			const userAccountRequestService = ctx.get('userAccountRequestService');
			return ctx.json(
				await userAccountRequestService.getUserProfile({
					currentUserId,
					targetUserId,
					guildId: guild_id ?? undefined,
					withMutualFriends: with_mutual_friends,
					withMutualGuilds: with_mutual_guilds,
					requestCache: ctx.get('requestCache'),
				}),
			);
		},
	);

	app.get(
		'/users/@me/settings',
		RateLimitMiddleware(RateLimitConfigs.USER_SETTINGS_GET),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'get_current_user_settings',
			summary: 'Get current user settings',
			responseSchema: UserSettingsResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				"Retrieves the current user's settings and preferences, including notification settings, privacy options, and display preferences. Only accessible to the authenticated user.",
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const [settings, guildIds] = await Promise.all([
				ctx.get('userService').findSettings(userId),
				ctx.get('userRepository').getUserGuildIds(userId),
			]);
			return ctx.json(mapUserSettingsToResponse({settings, memberGuildIds: guildIds}));
		},
	);

	app.patch(
		'/users/@me/settings',
		RateLimitMiddleware(RateLimitConfigs.USER_SETTINGS_UPDATE),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', UserSettingsUpdateRequest),
		OpenAPI({
			operationId: 'update_current_user_settings',
			summary: 'Update current user settings',
			responseSchema: UserSettingsResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				"Updates the current user's settings and preferences. Allows modification of notification settings, privacy options, display preferences, and other user-configurable options. Returns updated settings.",
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const [updatedSettings, guildIds] = await Promise.all([
				ctx.get('userService').updateSettings({
					userId,
					data: ctx.req.valid('json'),
				}),
				ctx.get('userRepository').getUserGuildIds(userId),
			]);
			return ctx.json(
				mapUserSettingsToResponse({
					settings: updatedSettings,
					memberGuildIds: guildIds,
				}),
			);
		},
	);

	app.get(
		'/users/@me/notes',
		RateLimitMiddleware(RateLimitConfigs.USER_NOTES_READ),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'list_current_user_notes',
			summary: 'List current user notes',
			responseSchema: UserNotesRecordResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Retrieves all notes the current user has written about other users. Returns a record of user IDs to notes. These are private notes visible only to the authenticated user.',
		}),
		async (ctx) => {
			const notes = await ctx.get('userService').getUserNotes(ctx.get('user').id);
			return ctx.json(notes);
		},
	);

	app.get(
		'/users/@me/notes/:target_id',
		RateLimitMiddleware(RateLimitConfigs.USER_NOTES_READ),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', TargetIdParam),
		OpenAPI({
			operationId: 'get_note_on_user',
			summary: 'Get note on user',
			responseSchema: UserNoteResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Retrieves a specific note the current user has written about another user. Returns the note text and metadata. These are private notes visible only to the authenticated user.',
		}),
		async (ctx) => {
			const note = await ctx.get('userService').getUserNote({
				userId: ctx.get('user').id,
				targetId: createUserID(ctx.req.valid('param').target_id),
			});
			if (!note) {
				throw new UnknownUserError();
			}
			return ctx.json(note);
		},
	);

	app.put(
		'/users/@me/notes/:target_id',
		RateLimitMiddleware(RateLimitConfigs.USER_NOTES_WRITE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', TargetIdParam),
		Validator('json', UserNoteUpdateRequest),
		OpenAPI({
			operationId: 'set_note_on_user',
			summary: 'Set note on user',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Creates or updates a private note on another user. The note is visible only to the authenticated user. Send null or empty string to delete an existing note.',
		}),
		async (ctx) => {
			const {target_id} = ctx.req.valid('param');
			const {note} = ctx.req.valid('json');
			await ctx.get('userService').setUserNote({
				userId: ctx.get('user').id,
				targetId: createUserID(target_id),
				note: note ?? null,
			});
			return ctx.body(null, 204);
		},
	);

	app.patch(
		'/users/@me/guilds/@me/settings',
		RateLimitMiddleware(RateLimitConfigs.USER_GUILD_SETTINGS_UPDATE),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', UserGuildSettingsUpdateRequest),
		OpenAPI({
			operationId: 'update_dm_notification_settings',
			summary: 'Update DM notification settings',
			responseSchema: UserGuildSettingsResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				"Updates the user's notification settings for direct messages and group DMs. Controls how DM notifications are handled.",
		}),
		async (ctx) => {
			const settings = await ctx.get('userService').updateGuildSettings({
				userId: ctx.get('user').id,
				guildId: null,
				data: ctx.req.valid('json'),
			});
			return ctx.json(mapUserGuildSettingsToResponse(settings));
		},
	);

	app.patch(
		'/users/@me/guilds/:guild_id/settings',
		RateLimitMiddleware(RateLimitConfigs.USER_GUILD_SETTINGS_UPDATE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', GuildIdParam),
		Validator('json', UserGuildSettingsUpdateRequest),
		OpenAPI({
			operationId: 'update_guild_settings_for_user',
			summary: 'Update guild settings for user',
			responseSchema: UserGuildSettingsResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				"Updates the user's settings for a specific guild, such as notification preferences and visibility settings. Guild-specific settings override default settings.",
		}),
		async (ctx) => {
			const {guild_id} = ctx.req.valid('param');
			const settings = await ctx.get('userService').updateGuildSettings({
				userId: ctx.get('user').id,
				guildId: createGuildID(guild_id),
				data: ctx.req.valid('json'),
			});
			return ctx.json(mapUserGuildSettingsToResponse(settings));
		},
	);

	app.post(
		'/users/@me/disable',
		RateLimitMiddleware(RateLimitConfigs.USER_ACCOUNT_DISABLE),
		LoginRequired,
		DefaultUserOnly,
		SudoModeMiddleware,
		Validator('json', SudoVerificationSchema),
		OpenAPI({
			operationId: 'disable_current_user_account',
			summary: 'Disable current user account',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				"Temporarily disables the current user's account. Requires sudo mode verification. The account can be re-enabled by logging in again. User data is preserved but the account will be inaccessible during the disabled period.",
		}),
		async (ctx) => {
			const userService = ctx.get('userService');
			const user = ctx.get('user');
			const body = ctx.req.valid('json');

			await requireSudoMode(ctx, user, body, ctx.get('authService'), ctx.get('authMfaService'), {
				issueSudoToken: false,
			});
			await userService.selfDisable(user.id);
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/users/@me/delete',
		RateLimitMiddleware(RateLimitConfigs.USER_ACCOUNT_DELETE),
		LoginRequired,
		DefaultUserOnly,
		SudoModeMiddleware,
		Validator('json', SudoVerificationSchema),
		OpenAPI({
			operationId: 'delete_current_user_account',
			summary: 'Delete current user account',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				"Permanently deletes the current user's account and all associated data. Requires sudo mode verification. This action is irreversible and will remove all user data, messages, and connections.",
		}),
		async (ctx) => {
			const userService = ctx.get('userService');
			const user = ctx.get('user');
			const body = ctx.req.valid('json');

			await requireSudoMode(ctx, user, body, ctx.get('authService'), ctx.get('authMfaService'));
			await userService.selfDelete(user.id);
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/users/@me/push/subscribe',
		RateLimitMiddleware(RateLimitConfigs.USER_PUSH_SUBSCRIBE),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', PushSubscribeRequest),
		OpenAPI({
			operationId: 'subscribe_to_push_notifications',
			summary: 'Subscribe to push notifications',
			responseSchema: PushSubscribeResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Registers a new push notification subscription for the current user. Takes push endpoint and encryption keys from a Web Push API subscription. Returns subscription ID for future reference.',
		}),
		async (ctx) => {
			const {endpoint, keys, user_agent} = ctx.req.valid('json');
			const subscription = await ctx.get('userService').registerPushSubscription({
				userId: ctx.get('user').id,
				endpoint,
				keys,
				userAgent: user_agent,
			});
			return ctx.json({subscription_id: subscription.subscriptionId});
		},
	);

	app.get(
		'/users/@me/push/subscriptions',
		RateLimitMiddleware(RateLimitConfigs.USER_PUSH_LIST),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'list_push_subscriptions',
			summary: 'List push subscriptions',
			responseSchema: PushSubscriptionsListResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Retrieves all push notification subscriptions for the current user, including subscription IDs and user agent information for each subscription.',
		}),
		async (ctx) => {
			const subscriptions = await ctx.get('userService').listPushSubscriptions(ctx.get('user').id);
			return ctx.json({
				subscriptions: subscriptions.map((sub) => ({
					subscription_id: sub.subscriptionId,
					user_agent: sub.userAgent,
				})),
			});
		},
	);

	app.delete(
		'/users/@me/push/subscriptions/:subscription_id',
		RateLimitMiddleware(RateLimitConfigs.USER_PUSH_UNSUBSCRIBE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', SubscriptionIdParam),
		OpenAPI({
			operationId: 'unsubscribe_from_push_notifications',
			summary: 'Unsubscribe from push notifications',
			responseSchema: SuccessResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Unregisters a push notification subscription for the current user. Push notifications will no longer be sent to this subscription endpoint.',
		}),
		async (ctx) => {
			const {subscription_id} = ctx.req.valid('param');
			await ctx.get('userService').deletePushSubscription(ctx.get('user').id, subscription_id);
			return ctx.json({success: true});
		},
	);

	app.post(
		'/users/@me/preload-messages',
		RateLimitMiddleware(RateLimitConfigs.USER_PRELOAD_MESSAGES),
		LoginRequired,
		Validator('json', PreloadMessagesRequest),
		OpenAPI({
			operationId: 'preload_messages_for_channels',
			summary: 'Preload messages for channels',
			responseSchema: PreloadMessagesResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Preloads and caches messages for multiple channels to improve performance when opening those channels. Returns preloaded message data for the specified channels.',
		}),
		async (ctx) => {
			const userAccountRequestService = ctx.get('userAccountRequestService');
			return ctx.json(
				await userAccountRequestService.preloadMessages({
					userId: ctx.get('user').id,
					channels: ctx.req.valid('json').channels,
					requestCache: ctx.get('requestCache'),
				}),
			);
		},
	);

	app.post(
		'/users/@me/channels/messages/preload',
		RateLimitMiddleware(RateLimitConfigs.USER_PRELOAD_MESSAGES),
		LoginRequired,
		Validator('json', PreloadMessagesRequest),
		OpenAPI({
			operationId: 'preload_messages_for_channels_alt',
			summary: 'Preload messages for channels (alternative)',
			responseSchema: PreloadMessagesResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Alternative endpoint to preload and cache messages for multiple channels to improve performance when opening those channels. Returns preloaded message data for the specified channels.',
		}),
		async (ctx) => {
			const userAccountRequestService = ctx.get('userAccountRequestService');
			return ctx.json(
				await userAccountRequestService.preloadMessages({
					userId: ctx.get('user').id,
					channels: ctx.req.valid('json').channels,
					requestCache: ctx.get('requestCache'),
				}),
			);
		},
	);

	app.post(
		'/users/@me/messages/delete',
		RateLimitMiddleware(RateLimitConfigs.USER_BULK_MESSAGE_DELETE),
		LoginRequired,
		DefaultUserOnly,
		SudoModeMiddleware,
		Validator('json', SudoVerificationSchema),
		OpenAPI({
			operationId: 'request_bulk_message_deletion',
			summary: 'Request bulk message deletion',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Initiates bulk deletion of all messages sent by the current user. Requires sudo mode verification. The deletion process is asynchronous and may take time to complete. User data remains intact.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const body = ctx.req.valid('json');

			await requireSudoMode(ctx, user, body, ctx.get('authService'), ctx.get('authMfaService'));
			await ctx.get('userService').requestBulkMessageDeletion({userId: user.id});
			return ctx.body(null, 204);
		},
	);

	app.delete(
		'/users/@me/messages/delete',
		RateLimitMiddleware(RateLimitConfigs.USER_BULK_MESSAGE_DELETE),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'cancel_bulk_message_deletion',
			summary: 'Cancel bulk message deletion',
			responseSchema: SuccessResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Cancels an in-progress bulk message deletion request. Can only be used if the deletion has not yet completed. Returns success status.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			await ctx.get('userService').cancelBulkMessageDeletion(user.id);
			return ctx.json({success: true});
		},
	);

	app.post(
		'/users/@me/messages/delete/test',
		RateLimitMiddleware(RateLimitConfigs.USER_BULK_MESSAGE_DELETE),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'test_bulk_message_deletion',
			summary: 'Test bulk message deletion',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Staff-only endpoint for testing bulk message deletion functionality. Creates a test deletion request with a 1-minute delay. Only accessible to users with staff privileges.',
		}),
		async (ctx) => {
			const user = ctx.get('user');

			if (!(user.flags & UserFlags.STAFF)) {
				throw new MissingAccessError();
			}

			await ctx.get('userService').requestBulkMessageDeletion({
				userId: user.id,
				delayMs: ms('1 minute'),
			});
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/users/@me/premium/reset',
		RateLimitMiddleware(RateLimitConfigs.USER_UPDATE_SELF),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'reset_current_user_premium_state',
			summary: 'Reset current user premium state',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Staff-only endpoint that clears premium status and related premium metadata for the current user account.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			if (!(user.flags & UserFlags.STAFF)) {
				throw new MissingAccessError();
			}

			await ctx.get('userService').resetCurrentUserPremiumState(user);
			return ctx.body(null, 204);
		},
	);
}
