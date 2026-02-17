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

import React, {useContext} from 'react';

export interface AuthRegisterFormDraft {
	formValues: Record<string, string>;
	selectedMonth: string;
	selectedDay: string;
	selectedYear: string;
	consent: boolean;
}

export const EMPTY_AUTH_REGISTER_FORM_DRAFT: AuthRegisterFormDraft = {
	formValues: {},
	selectedMonth: '',
	selectedDay: '',
	selectedYear: '',
	consent: false,
};

interface AuthRegisterDraftContextType {
	getRegisterFormDraft: (draftKey: string) => AuthRegisterFormDraft | undefined;
	setRegisterFormDraft: (draftKey: string, draft: AuthRegisterFormDraft) => void;
	clearRegisterFormDraft: (draftKey: string) => void;
}

export const AuthRegisterDraftContext = React.createContext<AuthRegisterDraftContextType | null>(null);

export function useAuthRegisterDraftContext(): AuthRegisterDraftContextType {
	const context = useContext(AuthRegisterDraftContext);
	if (!context) {
		throw new Error('useAuthRegisterDraftContext must be used within AuthLayout');
	}
	return context;
}
