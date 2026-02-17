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

import {ApplicationFlags, BotFlags, BotFlagsDescriptions} from '@fluxer/constants/src/BotConstants';
import {AVATAR_MAX_SIZE} from '@fluxer/constants/src/LimitConstants';
import {
	PublicUserFlags,
	PublicUserFlagsDescriptions,
	UserAuthenticatorTypes,
	UserAuthenticatorTypesDescriptions,
} from '@fluxer/constants/src/UserConstants';
import {createBase64StringType} from '@fluxer/schema/src/primitives/FileValidators';
import {
	createBitflagInt32Type,
	createInt32EnumType,
	createNamedStringLiteralUnion,
	createStringType,
	Int32Type,
	SnowflakeStringType,
	SnowflakeType,
	withOpenApiType,
} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {DiscriminatorType, UsernameType} from '@fluxer/schema/src/primitives/UserValidators';
import {z} from 'zod';

const RedirectURIString = createStringType(1).refine((value) => {
	try {
		const u = new URL(value);
		return !!u.protocol && !!u.host;
	} catch {
		return false;
	}
}, 'Invalid URL format');

export const OAuthScopes = ['identify', 'email', 'guilds', 'bot'] as const;

export type OAuthScope = (typeof OAuthScopes)[number];

const AuthenticatorTypeEnum = withOpenApiType(
	createInt32EnumType(
		[
			[UserAuthenticatorTypes.TOTP, 'TOTP', UserAuthenticatorTypesDescriptions.TOTP],
			[UserAuthenticatorTypes.SMS, 'SMS', UserAuthenticatorTypesDescriptions.SMS],
			[UserAuthenticatorTypes.WEBAUTHN, 'WEBAUTHN', UserAuthenticatorTypesDescriptions.WEBAUTHN],
		],
		'The type of authenticator',
		'AuthenticatorType',
	),
	'AuthenticatorType',
);

const PromptType = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			['consent', 'CONSENT', 'Always prompt the user for consent'],
			['none', 'NONE', 'Do not prompt the user for consent if already authorized'],
		] as const,
		'Whether to prompt the user for consent',
	),
	'PromptType',
);

const DisableGuildSelectType = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			['true', 'TRUE', 'Disable guild selection'],
			['false', 'FALSE', 'Allow guild selection'],
		] as const,
		'Whether to disable guild selection',
	),
	'DisableGuildSelectType',
);

export const AuthorizeRequest = z.object({
	response_type: z.literal('code').optional().describe('The OAuth2 response type, must be "code"'),
	client_id: SnowflakeType.describe('The application client ID'),
	redirect_uri: RedirectURIString.optional().describe('The URI to redirect to after authorization'),
	scope: createStringType(1).describe('The space-separated list of requested scopes'),
	state: createStringType(1).optional().describe('A random string for CSRF protection'),
	prompt: PromptType.optional(),
	guild_id: SnowflakeType.optional().describe('The guild ID to pre-select for bot authorization'),
	permissions: z.string().optional().describe('The bot permissions to request'),
	disable_guild_select: DisableGuildSelectType.optional(),
});

export type AuthorizeRequest = z.infer<typeof AuthorizeRequest>;

export const AuthorizeConsentRequest = z.object({
	response_type: z.string().optional().describe('The OAuth2 response type'),
	client_id: SnowflakeType.describe('The application client ID'),
	redirect_uri: RedirectURIString.optional().describe('The URI to redirect to after authorization'),
	scope: createStringType(1).describe('The space-separated list of requested scopes'),
	state: createStringType(1).optional().describe('A random string for CSRF protection'),
	permissions: z.string().optional().describe('The bot permissions to request'),
	guild_id: SnowflakeType.optional().describe('The guild ID to add the bot to'),
});

export type AuthorizeConsentRequest = z.infer<typeof AuthorizeConsentRequest>;

export const TokenRequest = z.discriminatedUnion('grant_type', [
	z.object({
		grant_type: z.literal('authorization_code').describe('The grant type for exchanging an authorization code'),
		code: createStringType(1).describe('The authorization code received from the authorize endpoint'),
		redirect_uri: RedirectURIString.describe('The redirect URI used in the authorization request'),
		client_id: SnowflakeType.optional().describe('The application client ID'),
		client_secret: createStringType(1).optional().describe('The application client secret'),
	}),
	z.object({
		grant_type: z.literal('refresh_token').describe('The grant type for refreshing an access token'),
		refresh_token: createStringType(1).describe('The refresh token to exchange for a new access token'),
		client_id: SnowflakeType.optional().describe('The application client ID'),
		client_secret: createStringType(1).optional().describe('The application client secret'),
	}),
]);

export type TokenRequest = z.infer<typeof TokenRequest>;

export const IntrospectRequestForm = z.object({
	token: createStringType(1).describe('The token to introspect'),
	client_id: SnowflakeType.optional().describe('The application client ID'),
	client_secret: createStringType(1).optional().describe('The application client secret'),
});

export type IntrospectRequestForm = z.infer<typeof IntrospectRequestForm>;

const TokenTypeHint = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			['access_token', 'ACCESS_TOKEN', 'An OAuth2 access token'],
			['refresh_token', 'REFRESH_TOKEN', 'An OAuth2 refresh token'],
		] as const,
		'A hint about the type of token being revoked',
	),
	'TokenTypeHint',
);

export const RevokeRequestForm = z.object({
	token: createStringType(1).describe('The token to revoke'),
	token_type_hint: TokenTypeHint.optional(),
	client_id: SnowflakeType.optional().describe('The application client ID'),
	client_secret: createStringType(1).optional().describe('The application client secret'),
});

export type RevokeRequestForm = z.infer<typeof RevokeRequestForm>;

export const ApplicationBotResponse = z
	.object({
		id: SnowflakeStringType.describe('The unique identifier of the bot user'),
		username: z.string().describe('The username of the bot'),
		discriminator: z.string().describe('The discriminator of the bot'),
		avatar: z.string().nullable().optional().describe('The avatar hash of the bot'),
		banner: z.string().nullable().optional().describe('The banner hash of the bot'),
		bio: z.string().nullable().describe('The bio or description of the bot'),
		token: z.string().optional().describe('The bot token for authentication'),
		mfa_enabled: z.boolean().optional().describe('Whether the bot has MFA enabled'),
		authenticator_types: z
			.array(AuthenticatorTypeEnum)
			.max(10)
			.optional()
			.describe('The types of authenticators enabled'),
		flags: createBitflagInt32Type(BotFlags, BotFlagsDescriptions, 'The bot user flags', 'BotFlags'),
	})
	.describe('Detailed bot user metadata');

export type ApplicationBotResponse = z.infer<typeof ApplicationBotResponse>;

export const ApplicationResponse = z.object({
	id: SnowflakeStringType.describe('The unique identifier of the application'),
	name: z.string().describe('The name of the application'),
	redirect_uris: z.array(z.string()).max(20).describe('The registered redirect URIs for OAuth2'),
	bot_public: z.boolean().describe('Whether the bot can be invited by anyone'),
	bot_require_code_grant: z.boolean().describe('Whether the bot requires OAuth2 code grant'),
	client_secret: z.string().optional().describe('The client secret for OAuth2 authentication'),
	bot: ApplicationBotResponse.optional().describe('The bot user associated with the application'),
});

export type ApplicationResponse = z.infer<typeof ApplicationResponse>;

export const ApplicationListResponse = z.array(ApplicationResponse);

export type ApplicationListResponse = z.infer<typeof ApplicationListResponse>;

export const BotTokenResetResponse = z.object({
	token: z.string().describe('The new bot token'),
	bot: ApplicationBotResponse,
});

export type BotTokenResetResponse = z.infer<typeof BotTokenResetResponse>;

export const BotProfileResponse = z.object({
	id: SnowflakeStringType.describe('The unique identifier of the bot user'),
	username: z.string().describe('The username of the bot'),
	discriminator: z.string().describe('The discriminator of the bot'),
	avatar: z.string().nullable().describe('The avatar hash of the bot'),
	banner: z.string().nullable().describe('The banner hash of the bot'),
	bio: z.string().nullable().describe('The bio or description of the bot'),
});

export type BotProfileResponse = z.infer<typeof BotProfileResponse>;

export const OAuth2TokenResponse = z.object({
	access_token: z.string().describe('The access token for API authorization'),
	token_type: z.string().describe('The type of token, typically "Bearer"'),
	expires_in: Int32Type.describe('The number of seconds until the access token expires'),
	refresh_token: z.string().describe('The refresh token for obtaining new access tokens'),
	scope: z.string().describe('The space-separated list of granted scopes'),
});

export type OAuth2TokenResponse = z.infer<typeof OAuth2TokenResponse>;

export const OAuth2UserInfoResponse = z.object({
	sub: SnowflakeStringType.describe('The subject identifier of the user'),
	id: SnowflakeStringType.describe('The unique identifier of the user'),
	username: z.string().describe('The username of the user'),
	discriminator: z.string().describe('The discriminator of the user'),
	global_name: z.string().nullable().describe('The global display name of the user'),
	avatar: z.string().nullable().describe('The avatar hash of the user'),
	email: z.string().nullable().optional().describe('The email address of the user'),
	verified: z.boolean().nullable().optional().describe('Whether the user has verified their email'),
	flags: createBitflagInt32Type(
		PublicUserFlags,
		PublicUserFlagsDescriptions,
		'The user flags',
		'PublicUserFlags',
	).optional(),
});

export type OAuth2UserInfoResponse = z.infer<typeof OAuth2UserInfoResponse>;

export const OAuth2IntrospectResponse = z.object({
	active: z.boolean().describe('Whether the token is currently active'),
	scope: z.string().optional().describe('The space-separated list of scopes'),
	client_id: SnowflakeStringType.optional().describe('The client identifier for the token'),
	username: z.string().optional().describe('The username of the token owner'),
	token_type: z.string().optional().describe('The type of token'),
	exp: Int32Type.optional().describe('The expiration timestamp in seconds'),
	iat: Int32Type.optional().describe('The issued-at timestamp in seconds'),
	sub: SnowflakeStringType.optional().describe('The subject identifier (user ID)'),
});

export type OAuth2IntrospectResponse = z.infer<typeof OAuth2IntrospectResponse>;

export const OAuth2ConsentResponse = z.object({
	redirect_to: z.string().describe('The URL to redirect the user to after consent'),
});

export type OAuth2ConsentResponse = z.infer<typeof OAuth2ConsentResponse>;

export const OAuth2MeResponse = z.object({
	application: z
		.object({
			id: SnowflakeStringType.describe('The unique identifier of the application'),
			name: z.string().describe('The name of the application'),
			icon: z.string().nullable().describe('The icon hash of the application'),
			description: z.string().nullable().describe('The description of the application'),
			bot_public: z.boolean().describe('Whether the bot can be invited by anyone'),
			bot_require_code_grant: z.boolean().describe('Whether the bot requires OAuth2 code grant'),
			flags: createBitflagInt32Type(ApplicationFlags, 'The application flags', undefined, 'ApplicationFlags'),
		})
		.describe('The application associated with the token'),
	scopes: z.array(z.string()).max(50).describe('The list of granted OAuth2 scopes'),
	expires: z.string().describe('The expiration timestamp of the token'),
	user: z
		.object({
			id: SnowflakeStringType.describe('The unique identifier of the user'),
			username: z.string().describe('The username of the user'),
			discriminator: z.string().describe('The discriminator of the user'),
			global_name: z.string().nullable().describe('The global display name of the user'),
			avatar: z.string().nullable().describe('The avatar hash of the user'),
			avatar_color: Int32Type.nullable().describe('The default avatar color of the user'),
			bot: z.boolean().optional().describe('Whether the user is a bot'),
			system: z.boolean().optional().describe('Whether the user is a system user'),
			flags: createBitflagInt32Type(PublicUserFlags, PublicUserFlagsDescriptions, 'The user flags', 'PublicUserFlags'),
			email: z.string().nullable().optional().describe('The email address of the user'),
			verified: z.boolean().nullable().optional().describe('Whether the user has verified their email'),
		})
		.optional()
		.describe('The user associated with the token'),
});

export type OAuth2MeResponse = z.infer<typeof OAuth2MeResponse>;

export const ApplicationPublicResponse = z.object({
	id: SnowflakeStringType.describe('The unique identifier of the application'),
	name: z.string().describe('The name of the application'),
	icon: z.string().nullable().describe('The icon hash of the application'),
	description: z.string().nullable().describe('The description of the application'),
	redirect_uris: z.array(z.string()).max(20).describe('The registered redirect URIs for OAuth2'),
	scopes: z.array(z.string()).max(50).describe('The available OAuth2 scopes'),
	bot_public: z.boolean().describe('Whether the bot can be invited by anyone'),
	bot: ApplicationBotResponse.nullable().describe('The bot user associated with the application'),
});

export type ApplicationPublicResponse = z.infer<typeof ApplicationPublicResponse>;

export const ApplicationsMeResponse = z.object({
	id: SnowflakeStringType.describe('The unique identifier of the application'),
	name: z.string().describe('The name of the application'),
	icon: z.string().nullable().describe('The icon hash of the application'),
	description: z.string().nullable().describe('The description of the application'),
	bot_public: z.boolean().describe('Whether the bot can be invited by anyone'),
	bot_require_code_grant: z.boolean().describe('Whether the bot requires OAuth2 code grant'),
	flags: createBitflagInt32Type(ApplicationFlags, 'The application flags', undefined, 'ApplicationFlags'),
	bot: ApplicationBotResponse.optional().describe('The bot user associated with the application'),
});

export type ApplicationsMeResponse = z.infer<typeof ApplicationsMeResponse>;

export const OAuth2AuthorizationResponse = z.object({
	application: z
		.object({
			id: SnowflakeStringType.describe('The unique identifier of the application'),
			name: z.string().describe('The name of the application'),
			icon: z.string().nullable().describe('The icon hash of the application'),
			description: z.string().nullable().describe('The description of the application'),
			bot_public: z.boolean().describe('Whether the bot can be invited by anyone'),
		})
		.describe('The application that was authorized'),
	scopes: z.array(z.string()).max(50).describe('The list of granted OAuth2 scopes'),
	authorized_at: z.string().describe('The timestamp when the authorization was granted'),
});

export type OAuth2AuthorizationResponse = z.infer<typeof OAuth2AuthorizationResponse>;

export const OAuth2AuthorizationsListResponse = z.array(OAuth2AuthorizationResponse);

export type OAuth2AuthorizationsListResponse = z.infer<typeof OAuth2AuthorizationsListResponse>;

function isLoopbackHost(hostname: string) {
	const lowercaseHost = hostname.toLowerCase();
	return (
		lowercaseHost === 'localhost' ||
		lowercaseHost === '127.0.0.1' ||
		lowercaseHost === '[::1]' ||
		lowercaseHost.endsWith('.localhost')
	);
}

function isValidRedirectURI(value: string, allowAnyHttp: boolean) {
	try {
		const url = new URL(value);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			return false;
		}

		if (!allowAnyHttp && url.protocol === 'http:' && !isLoopbackHost(url.hostname)) {
			return false;
		}

		return !!url.host;
	} catch {
		return false;
	}
}

const createRedirectURIType = (allowAnyHttp: boolean, message: string) =>
	createStringType(1).refine((value) => isValidRedirectURI(value, allowAnyHttp), message);

export const OAuth2RedirectURICreateType = createRedirectURIType(
	false,
	'Redirect URIs must use HTTPS, or HTTP for localhost only',
);
export const OAuth2RedirectURIUpdateType = createRedirectURIType(true, 'Redirect URIs must use HTTP or HTTPS');

export const ApplicationCreateRequest = z.object({
	name: createStringType(1, 100).describe('The name of the application'),
	redirect_uris: z
		.array(OAuth2RedirectURICreateType)
		.max(10, 'Maximum of 10 redirect URIs allowed')
		.optional()
		.nullable()
		.transform((value) => value ?? [])
		.describe('The redirect URIs for OAuth2 flows'),
	bot_public: z.boolean().optional().describe('Whether the bot can be invited by anyone'),
	bot_require_code_grant: z.boolean().optional().describe('Whether the bot requires OAuth2 code grant'),
});

export type ApplicationCreateRequest = z.infer<typeof ApplicationCreateRequest>;

export const ApplicationUpdateRequest = z.object({
	name: createStringType(1, 100).optional().describe('The name of the application'),
	redirect_uris: z
		.array(OAuth2RedirectURIUpdateType)
		.max(10, 'Maximum of 10 redirect URIs allowed')
		.optional()
		.nullable()
		.transform((value) => (value === undefined ? undefined : (value ?? [])))
		.describe('The redirect URIs for OAuth2 flows'),
	bot_public: z.boolean().optional().describe('Whether the bot can be invited by anyone'),
	bot_require_code_grant: z.boolean().optional().describe('Whether the bot requires OAuth2 code grant'),
});

export type ApplicationUpdateRequest = z.infer<typeof ApplicationUpdateRequest>;

export const BotProfileUpdateRequest = z.object({
	username: UsernameType.optional().describe('The username of the bot'),
	discriminator: DiscriminatorType.optional().describe('The discriminator of the bot'),
	avatar: createBase64StringType(1, Math.ceil(AVATAR_MAX_SIZE * (4 / 3)))
		.nullish()
		.describe('The avatar image as base64'),
	banner: createBase64StringType(1, Math.ceil(AVATAR_MAX_SIZE * (4 / 3)))
		.nullish()
		.describe('The banner image as base64'),
	bio: createStringType(0, 1024).nullish().describe('The bio or description of the bot'),
	bot_flags: createBitflagInt32Type(BotFlags, BotFlagsDescriptions, 'The bot user flags', 'BotFlags').optional(),
});

export type BotProfileUpdateRequest = z.infer<typeof BotProfileUpdateRequest>;
