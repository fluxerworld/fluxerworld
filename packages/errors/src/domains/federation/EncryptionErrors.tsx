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

import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {BadRequestError} from '@fluxer/errors/src/domains/core/BadRequestError';
import {InternalServerError} from '@fluxer/errors/src/domains/core/InternalServerError';

export class MissingEphemeralKeyError extends BadRequestError {
	constructor() {
		super({code: APIErrorCodes.MISSING_EPHEMERAL_KEY});
	}
}

export class MissingIvError extends BadRequestError {
	constructor() {
		super({code: APIErrorCodes.MISSING_IV});
	}
}

export class InvalidEphemeralKeyError extends BadRequestError {
	constructor() {
		super({code: APIErrorCodes.INVALID_EPHEMERAL_KEY});
	}
}

export class InvalidIvError extends BadRequestError {
	constructor() {
		super({code: APIErrorCodes.INVALID_IV});
	}
}

export class EmptyEncryptedBodyError extends BadRequestError {
	constructor() {
		super({code: APIErrorCodes.EMPTY_ENCRYPTED_BODY});
	}
}

export class DecryptionFailedError extends InternalServerError {
	constructor() {
		super({code: APIErrorCodes.DECRYPTION_FAILED});
	}
}

export class EncryptionFailedError extends InternalServerError {
	constructor() {
		super({code: APIErrorCodes.ENCRYPTION_FAILED});
	}
}

export class InvalidDecryptedJsonError extends BadRequestError {
	constructor() {
		super({code: APIErrorCodes.INVALID_DECRYPTED_JSON});
	}
}
