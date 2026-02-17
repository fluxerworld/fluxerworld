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

import type {KeyObject} from 'node:crypto';
import crypto from 'node:crypto';
import type {UserID} from '@fluxer/api/src/BrandedTypes';
import type {GatewayDispatchEvent} from '@fluxer/api/src/constants/Gateway';
import type {UserRow} from '@fluxer/api/src/database/types/UserTypes';
import {getMetricsService} from '@fluxer/api/src/infrastructure/MetricsService';
import {Logger} from '@fluxer/api/src/Logger';
import type {User} from '@fluxer/api/src/models/User';
import {mapUserToPrivateResponse} from '@fluxer/api/src/user/UserMappers';
import {SuspiciousActivityFlags} from '@fluxer/constants/src/UserConstants';

export interface ISendGridUserRepository {
	findByEmail(email: string): Promise<User | null>;
	patchUpsert(userId: UserID, patch: Partial<UserRow>, currentRow: UserRow): Promise<User | null>;
}

export interface ISendGridGatewayService {
	dispatchPresence(params: {userId: UserID; event: GatewayDispatchEvent; data: unknown}): Promise<void>;
}

type SendGridEventType =
	| 'bounce'
	| 'dropped'
	| 'delivered'
	| 'processed'
	| 'deferred'
	| 'open'
	| 'click'
	| 'spamreport'
	| 'unsubscribe'
	| 'group_unsubscribe'
	| 'group_resubscribe'
	| string;

export interface SendGridEvent {
	email: string;
	event: SendGridEventType;
	timestamp?: number;
	sg_event_id?: string;
	sg_message_id?: string;
	reason?: string;
	status?: string;
	type?: 'bounce' | 'blocked' | string;
	bounce_classification?: string;
}

export class SendGridWebhookService {
	constructor(
		private readonly userRepository: ISendGridUserRepository,
		private readonly gatewayService: ISendGridGatewayService,
	) {}

	verifySignature(payload: string, signature: string, timestamp: string, publicKey: string): boolean {
		try {
			const keyObject = this.resolvePublicKey(publicKey);
			const signatureBytes = decodeSignature(signature);
			const signedPayload = timestamp + payload;

			const verifier = crypto.createVerify('sha256');
			verifier.update(signedPayload);
			verifier.end();

			return verifier.verify(keyObject, signatureBytes);
		} catch (error) {
			Logger.error({error}, 'Error verifying SendGrid webhook signature');
			return false;
		}
	}

	async handleWebhook(params: {
		body: string;
		signature?: string;
		timestamp?: string;
		secret?: string | null;
	}): Promise<{status: number; body: string | null}> {
		const {body, signature, timestamp, secret} = params;

		if (secret) {
			if (!signature || !timestamp) {
				getMetricsService().counter({name: 'fluxer.sendgrid.webhooks.rejected', value: 1});
				Logger.warn('SendGrid webhook missing signature headers');
				return {status: 401, body: 'Missing signature headers'};
			}

			const isValid = this.verifySignature(body, signature, timestamp, secret);
			if (!isValid) {
				getMetricsService().counter({name: 'fluxer.sendgrid.webhooks.rejected', value: 1});
				Logger.warn('SendGrid webhook signature verification failed');
				return {status: 401, body: 'Invalid signature'};
			}
		}

		let events: Array<SendGridEvent>;
		try {
			const parsed = JSON.parse(body) as SendGridEvent | Array<SendGridEvent>;
			events = Array.isArray(parsed) ? parsed : [parsed];
		} catch (parseError) {
			getMetricsService().counter({name: 'fluxer.sendgrid.webhooks.invalid_json', value: 1});
			Logger.error({parseError, body: body.slice(0, 1000)}, 'Failed to parse SendGrid webhook JSON body');
			return {status: 400, body: 'Invalid JSON'};
		}

		await this.processEvents(events);
		getMetricsService().counter({
			name: 'fluxer.sendgrid.webhooks.processed',
			value: 1,
			dimensions: {
				event_count: events.length.toString(),
			},
		});

		return {status: 200, body: null};
	}

	async processEvents(events: Array<SendGridEvent>): Promise<void> {
		for (const event of events) {
			try {
				await this.processEvent(event);
			} catch (error) {
				Logger.error({error, event}, 'Error processing SendGrid webhook event');
			}
		}
	}

	private async processEvent(event: SendGridEvent): Promise<void> {
		if (event.event !== 'bounce' && event.event !== 'dropped') {
			Logger.debug({event: event.event, email: event.email}, 'SendGrid event received (ignored)');
			return;
		}

		if (event.event === 'bounce') {
			if (event.type === 'blocked') {
				Logger.info(
					{email: event.email, reason: event.reason, type: event.type},
					'SendGrid soft bounce (blocked) received',
				);
				return;
			}

			if (event.type === 'bounce') {
				await this.handleHardBounce(event);
				return;
			}
		}

		if (event.event === 'dropped') {
			const reason = event.reason?.toLowerCase() || '';
			if (reason.includes('bounced') || reason.includes('invalid')) {
				await this.handleHardBounce(event);
				return;
			}
		}
	}

	private async handleHardBounce(event: SendGridEvent): Promise<void> {
		Logger.warn(
			{
				email: event.email,
				event: event.event,
				reason: event.reason,
				bounce_classification: event.bounce_classification,
				sg_event_id: event.sg_event_id,
			},
			'Processing hard bounce - marking email as invalid',
		);

		const user = await this.userRepository.findByEmail(event.email);
		if (!user) {
			Logger.warn({email: event.email}, 'User not found for bounced email');
			return;
		}

		if (user.emailBounced) {
			Logger.debug({userId: user.id, email: event.email}, 'Email already marked as bounced');
			return;
		}

		const currentFlags = user.suspiciousActivityFlags || 0;
		const newFlags = currentFlags | SuspiciousActivityFlags.REQUIRE_REVERIFIED_EMAIL;

		const updatedUser = await this.userRepository.patchUpsert(
			user.id,
			{
				email_bounced: true,
				email_verified: false,
				suspicious_activity_flags: newFlags,
			},
			user.toRow(),
		);

		Logger.info(
			{userId: user.id, email: event.email, reason: event.reason},
			'User email marked as bounced and requires reverification',
		);

		if (updatedUser) {
			await this.gatewayService.dispatchPresence({
				userId: updatedUser.id,
				event: 'USER_UPDATE',
				data: mapUserToPrivateResponse(updatedUser),
			});
		}
	}

	private resolvePublicKey(rawPublicKey: string): KeyObject {
		const trimmed = rawPublicKey.trim();
		if (trimmed.includes('BEGIN PUBLIC KEY')) {
			return crypto.createPublicKey(trimmed);
		}

		const normalisedBase64 = trimmed.replace(/\s+/g, '');
		const der = decodeBase64OrBase64Url(normalisedBase64);
		return crypto.createPublicKey({
			key: der,
			format: 'der',
			type: 'spki',
		});
	}
}

function decodeSignature(signature: string): Buffer {
	return decodeBase64OrBase64Url(signature.trim());
}

function decodeBase64OrBase64Url(value: string): Buffer {
	try {
		return Buffer.from(value, 'base64');
	} catch {
		return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
	}
}
