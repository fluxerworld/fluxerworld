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

import {type Action, INITIAL_FORM_VALUES, type State} from '@app/components/pages/report/ReportTypes';

export function createInitialState(): State {
	return {
		selectedType: null,
		flowStep: 'selection',

		email: '',
		verificationCode: '',
		ticket: null,

		formValues: {...INITIAL_FORM_VALUES},

		isSendingCode: false,
		isVerifying: false,
		isSubmitting: false,

		errorMessage: null,
		successReportId: null,

		resendCooldownSeconds: 0,

		fieldErrors: {},
	};
}

export function reducer(state: State, action: Action): State {
	switch (action.type) {
		case 'RESET_ALL':
			return createInitialState();

		case 'SELECT_TYPE':
			return {
				...createInitialState(),
				selectedType: action.reportType,
				flowStep: 'email',
			};

		case 'GO_TO_SELECTION':
			return {
				...createInitialState(),
			};

		case 'GO_TO_EMAIL':
			return {
				...state,
				flowStep: 'email',
				verificationCode: '',
				ticket: null,
				isVerifying: false,
				errorMessage: null,
				resendCooldownSeconds: 0,
				fieldErrors: {},
			};

		case 'GO_TO_VERIFICATION':
			return {
				...state,
				flowStep: 'verification',
				verificationCode: '',
				ticket: null,
				errorMessage: null,
				resendCooldownSeconds: 0,
				fieldErrors: {},
			};

		case 'GO_TO_DETAILS':
			return {
				...state,
				flowStep: 'details',
				errorMessage: null,
				fieldErrors: {},
			};

		case 'SET_ERROR':
			return {...state, errorMessage: action.message};

		case 'SET_EMAIL':
			return {...state, email: action.email, errorMessage: null};

		case 'SET_VERIFICATION_CODE':
			return {...state, verificationCode: action.code, errorMessage: null};

		case 'SET_TICKET':
			return {...state, ticket: action.ticket};

		case 'SET_FORM_FIELD':
			return {
				...state,
				formValues: {...state.formValues, [action.field]: action.value},
				errorMessage: null,
				fieldErrors: {...state.fieldErrors, [action.field]: undefined},
			};

		case 'SENDING_CODE':
			return {...state, isSendingCode: action.value};

		case 'VERIFYING':
			return {...state, isVerifying: action.value};

		case 'SUBMITTING':
			return {...state, isSubmitting: action.value};

		case 'SUBMIT_SUCCESS':
			return {
				...state,
				successReportId: action.reportId,
				flowStep: 'complete',
				isSubmitting: false,
				errorMessage: null,
				fieldErrors: {},
			};

		case 'START_RESEND_COOLDOWN':
			return {...state, resendCooldownSeconds: action.seconds};

		case 'TICK_RESEND_COOLDOWN':
			return {...state, resendCooldownSeconds: Math.max(0, state.resendCooldownSeconds - 1)};

		case 'SET_FIELD_ERRORS':
			return {...state, fieldErrors: action.errors};

		case 'CLEAR_FIELD_ERRORS':
			return {...state, fieldErrors: {}};

		case 'CLEAR_FIELD_ERROR': {
			const next = {...state.fieldErrors};
			delete next[action.field];
			return {...state, fieldErrors: next};
		}

		default:
			return state;
	}
}
