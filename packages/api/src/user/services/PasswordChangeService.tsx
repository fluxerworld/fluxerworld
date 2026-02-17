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

import crypto from 'node:crypto';
import type {User} from '@fluxer/api/src/models/User';
import type {PasswordChangeRepository} from '@fluxer/api/src/user/repositories/auth/PasswordChangeRepository';
import type {IUserAccountRepository} from '@fluxer/api/src/user/repositories/IUserAccountRepository';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import type {IEmailService} from '@fluxer/email/src/IEmailService';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {RateLimitError} from '@fluxer/errors/src/domains/core/RateLimitError';
import type {IRateLimitService} from '@fluxer/rate_limit/src/IRateLimitService';
import {ms} from 'itty-time';

export interface IAuthServiceForPasswordChange {
	hashPassword(password: string): Promise<string>;
	isPasswordPwned(password: string): Promise<boolean>;
}

export interface StartPasswordChangeResult {
	ticket: string;
	code_expires_at: string;
	resend_available_at: string;
}

export interface VerifyPasswordChangeResult {
	verification_proof: string;
}

export class PasswordChangeService {
	private readonly CODE_TTL_MS = ms('10 minutes');
	private readonly RESEND_COOLDOWN_MS = ms('30 seconds');

	constructor(
		private readonly repo: PasswordChangeRepository,
		private readonly emailService: IEmailService,
		private readonly authService: IAuthServiceForPasswordChange,
		private readonly userAccountRepository: IUserAccountRepository,
		private readonly rateLimitService: IRateLimitService,
	) {}

	async start(user: User): Promise<StartPasswordChangeResult> {
		if (!user.email) {
			throw InputValidationError.fromCode('email', ValidationErrorCodes.MUST_HAVE_EMAIL_TO_CHANGE_IT);
		}

		await this.ensureRateLimit(`password_change:start:${user.id}`, 3, ms('15 minutes'));

		const ticket = this.generateTicket();
		const now = new Date();
		const code = this.generateCode();
		const codeExpiresAt = new Date(now.getTime() + this.CODE_TTL_MS);

		await this.emailService.sendPasswordChangeVerification(user.email, user.username, code, user.locale);

		await this.repo.createTicket({
			ticket,
			user_id: user.id,
			code,
			code_sent_at: now,
			code_expires_at: codeExpiresAt,
			verified: false,
			verification_proof: null,
			status: 'pending',
			created_at: now,
			updated_at: now,
		});

		return {
			ticket,
			code_expires_at: codeExpiresAt.toISOString(),
			resend_available_at: new Date(now.getTime() + this.RESEND_COOLDOWN_MS).toISOString(),
		};
	}

	async resend(user: User, ticket: string): Promise<void> {
		const row = await this.getTicketForUser(ticket, user.id);
		if (!user.email) {
			throw InputValidationError.fromCode('email', ValidationErrorCodes.MUST_HAVE_EMAIL_TO_CHANGE_IT);
		}

		this.assertCooldown(row.code_sent_at);
		await this.ensureRateLimit(`password_change:resend:${user.id}`, 3, ms('15 minutes'));

		const now = new Date();
		const code = this.generateCode();
		const codeExpiresAt = new Date(now.getTime() + this.CODE_TTL_MS);

		await this.emailService.sendPasswordChangeVerification(user.email, user.username, code, user.locale);

		row.code = code;
		row.code_sent_at = now;
		row.code_expires_at = codeExpiresAt;
		row.updated_at = now;
		await this.repo.updateTicket(row);
	}

	async verify(user: User, ticket: string, code: string): Promise<VerifyPasswordChangeResult> {
		const row = await this.getTicketForUser(ticket, user.id);

		if (row.verified && row.verification_proof) {
			return {verification_proof: row.verification_proof};
		}

		if (!row.code || !row.code_expires_at) {
			throw InputValidationError.fromCode('code', ValidationErrorCodes.VERIFICATION_CODE_NOT_ISSUED);
		}

		if (row.code_expires_at.getTime() < Date.now()) {
			throw InputValidationError.fromCode('code', ValidationErrorCodes.VERIFICATION_CODE_EXPIRED);
		}

		if (row.code !== code.trim()) {
			throw InputValidationError.fromCode('code', ValidationErrorCodes.INVALID_VERIFICATION_CODE);
		}

		const now = new Date();
		const verificationProof = this.generateProof();

		row.verified = true;
		row.verification_proof = verificationProof;
		row.status = 'verified';
		row.updated_at = now;
		await this.repo.updateTicket(row);

		return {verification_proof: verificationProof};
	}

	async complete(user: User, ticket: string, verificationProof: string, newPassword: string): Promise<void> {
		const row = await this.getTicketForUser(ticket, user.id);

		if (!row.verified || !row.verification_proof) {
			throw InputValidationError.fromCode('ticket', ValidationErrorCodes.INVALID_OR_EXPIRED_TICKET);
		}

		if (row.verification_proof !== verificationProof) {
			throw InputValidationError.fromCode('verification_proof', ValidationErrorCodes.INVALID_PROOF_TOKEN);
		}

		if (await this.authService.isPasswordPwned(newPassword)) {
			throw InputValidationError.fromCode('new_password', ValidationErrorCodes.PASSWORD_IS_TOO_COMMON);
		}

		const newPasswordHash = await this.authService.hashPassword(newPassword);

		await this.userAccountRepository.patchUpsert(user.id, {
			password_hash: newPasswordHash,
			password_last_changed_at: new Date(),
		});

		const now = new Date();
		row.status = 'completed';
		row.updated_at = now;
		await this.repo.updateTicket(row);
	}

	private async getTicketForUser(ticket: string, userId: bigint) {
		const row = await this.repo.findTicket(ticket);
		if (!row || row.user_id !== userId) {
			throw InputValidationError.fromCode('ticket', ValidationErrorCodes.INVALID_OR_EXPIRED_TICKET);
		}
		if (row.status === 'completed') {
			throw InputValidationError.fromCode('ticket', ValidationErrorCodes.TICKET_ALREADY_COMPLETED);
		}
		return row;
	}

	private generateCode(): string {
		const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
		let raw = '';
		while (raw.length < 8) {
			const byte = crypto.randomBytes(1)[0];
			const idx = byte % alphabet.length;
			raw += alphabet[idx];
		}
		return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
	}

	private generateTicket(): string {
		return crypto.randomUUID();
	}

	private generateProof(): string {
		return crypto.randomUUID();
	}

	private assertCooldown(sentAt: Date | null | undefined) {
		if (!sentAt) return;
		const nextAllowed = sentAt.getTime() + this.RESEND_COOLDOWN_MS;
		if (nextAllowed > Date.now()) {
			const retryAfter = Math.ceil((nextAllowed - Date.now()) / 1000);
			throw new RateLimitError({
				message: 'Please wait before resending.',
				retryAfter,
				limit: 1,
				resetTime: new Date(nextAllowed),
			});
		}
	}

	private async ensureRateLimit(identifier: string, maxAttempts: number, windowMs: number) {
		const result = await this.rateLimitService.checkLimit({identifier, maxAttempts, windowMs});
		if (!result.allowed) {
			throw new RateLimitError({
				message: 'Too many attempts. Please try again later.',
				retryAfter: result.retryAfter || 0,
				limit: result.limit,
				resetTime: result.resetTime,
			});
		}
	}
}
