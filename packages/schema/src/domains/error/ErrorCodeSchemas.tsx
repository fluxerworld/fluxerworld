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
import {APIErrorCodesDescriptions} from '@fluxer/constants/src/ApiErrorCodesDescriptions';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {ValidationErrorCodesDescriptions} from '@fluxer/constants/src/ValidationErrorCodesDescriptions';
import {createFlexibleStringLiteralUnion} from '@fluxer/schema/src/primitives/SchemaPrimitives';

type APIErrorCodePair = readonly [string, string, string?];

function buildAPIErrorCodePairs(): ReadonlyArray<APIErrorCodePair> {
	return Object.entries(APIErrorCodes).map(([key, value]) => {
		const description = APIErrorCodesDescriptions[key as keyof typeof APIErrorCodesDescriptions];
		return [value, key, description] as const;
	});
}

function buildValidationErrorCodePairs(): ReadonlyArray<APIErrorCodePair> {
	return Object.entries(ValidationErrorCodes).map(([key, value]) => {
		const description = ValidationErrorCodesDescriptions[key as keyof typeof ValidationErrorCodesDescriptions];
		return [value, key, description] as const;
	});
}

export const APIErrorCodeSchema = createFlexibleStringLiteralUnion(
	buildAPIErrorCodePairs(),
	'Error codes returned by API operations',
);

export const ValidationErrorCodeSchema = createFlexibleStringLiteralUnion(
	buildValidationErrorCodePairs(),
	'Error codes for field validation issues',
);

export const AnyErrorCodeSchema = createFlexibleStringLiteralUnion(
	[...buildAPIErrorCodePairs()],
	'Any error code in top-level error response',
);
