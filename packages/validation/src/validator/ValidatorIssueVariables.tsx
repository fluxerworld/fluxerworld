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

import type {ZodError} from 'zod';

interface ZodTooSmallIssue {
	code: 'too_small';
	minimum: number | bigint;
	type: string;
}

interface ZodTooBigIssue {
	code: 'too_big';
	maximum: number | bigint;
	type: string;
}

interface ZodInvalidTypeIssue {
	code: 'invalid_type';
	expected: string;
	received: string;
}

interface ZodCustomIssue {
	code: 'custom';
	params?: Record<string, unknown>;
}

type ZodValidationIssue = ZodError['issues'][number];

function getIssueFieldName(issue: ZodValidationIssue): string {
	if (issue.path.length === 0) {
		return 'field';
	}
	return String(issue.path[issue.path.length - 1]);
}

function isTooSmallIssue(issue: ZodValidationIssue): issue is ZodValidationIssue & ZodTooSmallIssue {
	return issue.code === 'too_small' && 'minimum' in issue && 'type' in issue;
}

function isTooBigIssue(issue: ZodValidationIssue): issue is ZodValidationIssue & ZodTooBigIssue {
	return issue.code === 'too_big' && 'maximum' in issue && 'type' in issue;
}

function isInvalidTypeIssue(issue: ZodValidationIssue): issue is ZodValidationIssue & ZodInvalidTypeIssue {
	return issue.code === 'invalid_type' && 'expected' in issue && 'received' in issue;
}

function isCustomIssue(issue: ZodValidationIssue): issue is ZodValidationIssue & ZodCustomIssue {
	return issue.code === 'custom';
}

export function extractValidatorIssueVariables(issue: ZodValidationIssue): Record<string, unknown> | undefined {
	const fieldName = getIssueFieldName(issue);

	if (isTooSmallIssue(issue)) {
		return {
			name: fieldName,
			min: issue.minimum,
			minValue: issue.minimum,
			minimum: issue.minimum,
			type: issue.type,
		};
	}

	if (isTooBigIssue(issue)) {
		return {
			name: fieldName,
			max: issue.maximum,
			maxValue: issue.maximum,
			maximum: issue.maximum,
			type: issue.type,
		};
	}

	if (isInvalidTypeIssue(issue)) {
		return {
			name: fieldName,
			expected: issue.expected,
			received: issue.received,
		};
	}

	if (isCustomIssue(issue) && issue.params !== undefined && issue.params !== null) {
		return {
			name: fieldName,
			...issue.params,
		};
	}

	return {name: fieldName};
}
