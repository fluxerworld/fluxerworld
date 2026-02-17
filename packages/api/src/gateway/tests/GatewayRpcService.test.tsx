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

import {createChannelID, createGuildID, createUserID} from '@fluxer/api/src/BrandedTypes';
import {GatewayRpcMethodErrorCodes} from '@fluxer/api/src/infrastructure/GatewayRpcError';
import {GatewayService} from '@fluxer/api/src/infrastructure/GatewayService';
import {createGatewayRpcMethodErrorHandler} from '@fluxer/api/src/test/msw/handlers/GatewayRpcHandlers';
import {server} from '@fluxer/api/src/test/msw/server';
import {CallAlreadyExistsError} from '@fluxer/errors/src/domains/channel/CallAlreadyExistsError';
import {InvalidChannelTypeForCallError} from '@fluxer/errors/src/domains/channel/InvalidChannelTypeForCallError';
import {NoActiveCallError} from '@fluxer/errors/src/domains/channel/NoActiveCallError';
import {UnknownChannelError} from '@fluxer/errors/src/domains/channel/UnknownChannelError';
import {BadGatewayError} from '@fluxer/errors/src/domains/core/BadGatewayError';
import {GatewayTimeoutError} from '@fluxer/errors/src/domains/core/GatewayTimeoutError';
import {MissingPermissionsError} from '@fluxer/errors/src/domains/core/MissingPermissionsError';
import {ServiceUnavailableError} from '@fluxer/errors/src/domains/core/ServiceUnavailableError';
import {UnknownGuildError} from '@fluxer/errors/src/domains/guild/UnknownGuildError';
import {UserNotInVoiceError} from '@fluxer/errors/src/domains/user/UserNotInVoiceError';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('GatewayRpcService Error Handling', () => {
	const TEST_GUILD_ID = createGuildID(123456789n);
	const TEST_USER_ID = createUserID(987654321n);
	const TEST_CHANNEL_ID = createChannelID(111222333n);

	let gatewayService: GatewayService;

	beforeAll(() => {
		server.listen({onUnhandledRequest: 'error'});
	});

	afterAll(() => {
		server.close();
	});

	beforeEach(() => {
		gatewayService = new GatewayService();
	});

	afterEach(() => {
		server.resetHandlers();
		gatewayService.destroy();
	});

	it('transforms guild_not_found RPC error to UnknownGuildError', async () => {
		server.use(createGatewayRpcMethodErrorHandler('guild.get_data', GatewayRpcMethodErrorCodes.GUILD_NOT_FOUND));

		await expect(
			gatewayService.getGuildData({
				guildId: TEST_GUILD_ID,
				userId: TEST_USER_ID,
			}),
		).rejects.toThrow(UnknownGuildError);
	});

	it('transforms forbidden RPC error to MissingPermissionsError', async () => {
		server.use(createGatewayRpcMethodErrorHandler('guild.get_data', GatewayRpcMethodErrorCodes.FORBIDDEN));

		await expect(
			gatewayService.getGuildData({
				guildId: TEST_GUILD_ID,
				userId: TEST_USER_ID,
			}),
		).rejects.toThrow(MissingPermissionsError);
	});

	it('transforms guild_not_found RPC error to UnknownGuildError for non-batched calls', async () => {
		server.use(createGatewayRpcMethodErrorHandler('guild.get_counts', GatewayRpcMethodErrorCodes.GUILD_NOT_FOUND));

		await expect(gatewayService.getGuildCounts(TEST_GUILD_ID)).rejects.toThrow(UnknownGuildError);
	});

	it('transforms call_already_exists RPC error to CallAlreadyExistsError', async () => {
		server.use(createGatewayRpcMethodErrorHandler('call.create', GatewayRpcMethodErrorCodes.CALL_ALREADY_EXISTS));

		await expect(gatewayService.createCall(TEST_CHANNEL_ID, '123', 'us-east', [], [])).rejects.toThrow(
			CallAlreadyExistsError,
		);
	});

	it('transforms call_not_found RPC error to NoActiveCallError', async () => {
		server.use(createGatewayRpcMethodErrorHandler('call.delete', GatewayRpcMethodErrorCodes.CALL_NOT_FOUND));

		await expect(gatewayService.deleteCall(TEST_CHANNEL_ID)).rejects.toThrow(NoActiveCallError);
	});

	it('transforms channel_not_found RPC error to UnknownChannelError', async () => {
		server.use(createGatewayRpcMethodErrorHandler('call.get', GatewayRpcMethodErrorCodes.CHANNEL_NOT_FOUND));

		await expect(gatewayService.getCall(TEST_CHANNEL_ID)).rejects.toThrow(UnknownChannelError);
	});

	it('transforms channel_not_voice RPC error to InvalidChannelTypeForCallError', async () => {
		server.use(createGatewayRpcMethodErrorHandler('call.get', GatewayRpcMethodErrorCodes.CHANNEL_NOT_VOICE));

		await expect(gatewayService.getCall(TEST_CHANNEL_ID)).rejects.toThrow(InvalidChannelTypeForCallError);
	});

	it('transforms user_not_in_voice RPC error to UserNotInVoiceError', async () => {
		server.use(
			createGatewayRpcMethodErrorHandler('guild.update_member_voice', GatewayRpcMethodErrorCodes.USER_NOT_IN_VOICE),
		);

		await expect(
			gatewayService.updateMemberVoice({
				guildId: TEST_GUILD_ID,
				userId: TEST_USER_ID,
				mute: false,
				deaf: false,
			}),
		).rejects.toThrow(UserNotInVoiceError);
	});

	it('transforms timeout RPC error to GatewayTimeoutError', async () => {
		server.use(createGatewayRpcMethodErrorHandler('guild.get_data', GatewayRpcMethodErrorCodes.TIMEOUT));

		await expect(
			gatewayService.getGuildData({
				guildId: TEST_GUILD_ID,
				userId: TEST_USER_ID,
			}),
		).rejects.toThrow(GatewayTimeoutError);
	});

	it('does not open circuit breaker for mapped gateway business errors', async () => {
		server.use(createGatewayRpcMethodErrorHandler('guild.get_data', GatewayRpcMethodErrorCodes.GUILD_NOT_FOUND));

		for (let attempt = 0; attempt < 6; attempt += 1) {
			await expect(
				gatewayService.getGuildData({
					guildId: TEST_GUILD_ID,
					userId: TEST_USER_ID,
				}),
			).rejects.toThrow(UnknownGuildError);
		}
	});

	it('opens circuit breaker for repeated gateway internal errors', async () => {
		server.use(createGatewayRpcMethodErrorHandler('guild.get_data', GatewayRpcMethodErrorCodes.INTERNAL_ERROR));

		for (let attempt = 0; attempt < 5; attempt += 1) {
			await expect(
				gatewayService.getGuildData({
					guildId: TEST_GUILD_ID,
					userId: TEST_USER_ID,
				}),
			).rejects.toThrow(BadGatewayError);
		}

		await expect(
			gatewayService.getGuildData({
				guildId: TEST_GUILD_ID,
				userId: TEST_USER_ID,
			}),
		).rejects.toThrow(ServiceUnavailableError);
	});
});
