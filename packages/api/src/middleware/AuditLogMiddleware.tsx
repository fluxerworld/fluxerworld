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

import type {HonoEnv} from '@fluxer/api/src/types/HonoEnv';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {AuditLogReasonType} from '@fluxer/schema/src/primitives/ChannelValidators';
import {createMiddleware} from 'hono/factory';

export const AuditLogMiddleware = createMiddleware<HonoEnv>(async (ctx, next) => {
	const auditLogReasonHeader = ctx.req.header('X-Audit-Log-Reason');

	if (auditLogReasonHeader) {
		const result = AuditLogReasonType.safeParse(auditLogReasonHeader);
		if (!result.success) {
			throw InputValidationError.fromCode('X-Audit-Log-Reason', ValidationErrorCodes.INVALID_AUDIT_LOG_REASON);
		}
		ctx.set('auditLogReason', result.data);
	} else {
		ctx.set('auditLogReason', null);
	}

	await next();
});
