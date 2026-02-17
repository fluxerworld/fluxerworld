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

import {createStringType, Int32Type, SnowflakeType} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

export const FEDERATION_SCOPES = {
	identify: 'Read your user profile',
	guilds: 'Access guilds you are a member of',
	'guilds.join': 'Join guilds on your behalf',
	'messages.read': 'Read messages in guilds',
	'messages.write': 'Send messages in guilds',
	voice: 'Connect to voice channels',
} as const;

export type FederationScopeKey = keyof typeof FEDERATION_SCOPES;

export const FederationScope = z.enum([
	'identify',
	'guilds',
	'guilds.join',
	'messages.read',
	'messages.write',
	'voice',
]);

export type FederationScope = z.infer<typeof FederationScope>;

const RedirectURIString = createStringType(1).refine((value) => {
	try {
		const u = new URL(value);
		return !!u.protocol && !!u.host;
	} catch {
		return false;
	}
}, 'Invalid URL format');

export const FederationOAuth2AuthorizeRequest = z.object({
	response_type: z.literal('code').describe('The OAuth2 response type, must be "code"'),
	client_id: SnowflakeType.describe('The application client ID'),
	redirect_uri: RedirectURIString.describe('The URI to redirect to after authorization'),
	scope: createStringType(1).describe('The space-separated list of requested scopes'),
	state: createStringType(1).optional().describe('A random string for CSRF protection'),
	code_challenge: createStringType(1).optional().describe('The PKCE code challenge'),
	code_challenge_method: z.literal('S256').optional().describe('The PKCE code challenge method'),
});

export type FederationOAuth2AuthorizeRequest = z.infer<typeof FederationOAuth2AuthorizeRequest>;

export const FederationOAuth2TokenRequest = z.discriminatedUnion('grant_type', [
	z.object({
		grant_type: z.literal('authorization_code').describe('The grant type for exchanging an authorization code'),
		code: createStringType(1).describe('The authorization code received from the authorize endpoint'),
		redirect_uri: RedirectURIString.describe('The redirect URI used in the authorization request'),
		client_id: SnowflakeType.describe('The application client ID'),
		client_secret: createStringType(1).optional().describe('The application client secret'),
		code_verifier: createStringType(1).optional().describe('The PKCE code verifier'),
	}),
	z.object({
		grant_type: z.literal('refresh_token').describe('The grant type for refreshing an access token'),
		refresh_token: createStringType(1).describe('The refresh token to exchange for a new access token'),
		client_id: SnowflakeType.describe('The application client ID'),
		client_secret: createStringType(1).optional().describe('The application client secret'),
	}),
]);

export type FederationOAuth2TokenRequest = z.infer<typeof FederationOAuth2TokenRequest>;

export const FederationOAuth2TokenResponse = z.object({
	access_token: z.string().describe('The access token for API authorization'),
	token_type: z.literal('Bearer').describe('The type of token, always "Bearer"'),
	expires_in: Int32Type.describe('The number of seconds until the access token expires'),
	refresh_token: z.string().describe('The refresh token for obtaining new access tokens'),
	scope: z.string().describe('The space-separated list of granted scopes'),
});

export type FederationOAuth2TokenResponse = z.infer<typeof FederationOAuth2TokenResponse>;
