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

import * as AuthenticationActionCreators from '@app/actions/AuthenticationActionCreators';
import styles from '@app/components/auth/AuthPageStyles.module.css';
import {DateOfBirthField} from '@app/components/auth/DateOfBirthField';
import FormField from '@app/components/auth/FormField';
import {type MissingField, SubmitTooltip, shouldDisableSubmit} from '@app/components/auth/SubmitTooltip';
import {ExternalLink} from '@app/components/common/ExternalLink';
import {Button} from '@app/components/uikit/button/Button';
import {Checkbox} from '@app/components/uikit/checkbox/Checkbox';
import {
	type AuthRegisterFormDraft,
	EMPTY_AUTH_REGISTER_FORM_DRAFT,
	useAuthRegisterDraftContext,
} from '@app/contexts/AuthRegisterDraftContext';
import {useAuthForm} from '@app/hooks/useAuthForm';
import {useUsernameSuggestions} from '@app/hooks/useUsernameSuggestions';
import {useLocation} from '@app/lib/router/React';
import {Routes} from '@app/Routes';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import {Trans, useLingui} from '@lingui/react/macro';
import {AnimatePresence, motion} from 'framer-motion';
import {useCallback, useId, useMemo, useRef, useState} from 'react';

interface FieldConfig {
	showEmail?: boolean;
	showPassword?: boolean;
	showPasswordConfirmation?: boolean;
	showUsernameValidation?: boolean;
}

interface AuthRegisterFormCoreProps {
	fields?: FieldConfig;
	submitLabel: React.ReactNode;
	redirectPath: string;
	onRegister?: (response: {token: string; user_id: string}) => Promise<void>;
	inviteCode?: string;
	extraContent?: React.ReactNode;
}

export function AuthRegisterFormCore({
	fields = {},
	submitLabel,
	redirectPath,
	onRegister,
	inviteCode,
	extraContent,
}: AuthRegisterFormCoreProps) {
	const {t} = useLingui();
	const {
		showEmail = false,
		showPassword = false,
		showPasswordConfirmation = false,
		showUsernameValidation = false,
	} = fields;
	const location = useLocation();
	const draftKey = `register:${location.pathname}${location.search}`;
	const {getRegisterFormDraft, setRegisterFormDraft, clearRegisterFormDraft} = useAuthRegisterDraftContext();

	const emailId = useId();
	const globalNameId = useId();
	const usernameId = useId();
	const passwordId = useId();
	const confirmPasswordId = useId();

	const initialDraft = useMemo<AuthRegisterFormDraft>(() => {
		const persistedDraft = getRegisterFormDraft(draftKey);
		if (!persistedDraft) {
			return EMPTY_AUTH_REGISTER_FORM_DRAFT;
		}
		return {
			...persistedDraft,
			formValues: {...persistedDraft.formValues},
		};
	}, [draftKey, getRegisterFormDraft]);
	const draftRef = useRef<AuthRegisterFormDraft>({
		...initialDraft,
		formValues: {...initialDraft.formValues},
	});

	const [selectedMonth, setSelectedMonthState] = useState(initialDraft.selectedMonth);
	const [selectedDay, setSelectedDayState] = useState(initialDraft.selectedDay);
	const [selectedYear, setSelectedYearState] = useState(initialDraft.selectedYear);
	const [consent, setConsentState] = useState(initialDraft.consent);
	const [_usernameFocused, setUsernameFocused] = useState(false);

	const initialValues: Record<string, string> = {
		global_name: initialDraft.formValues.global_name ?? '',
		username: initialDraft.formValues.username ?? '',
	};
	if (showEmail) initialValues.email = initialDraft.formValues.email ?? '';
	if (showPassword) initialValues.password = initialDraft.formValues.password ?? '';
	if (showPassword && showPasswordConfirmation) {
		initialValues.confirm_password = initialDraft.formValues.confirm_password ?? '';
	}

	const persistDraft = useCallback(
		(partialDraft: Partial<AuthRegisterFormDraft>) => {
			const currentDraft = draftRef.current;
			const nextDraft: AuthRegisterFormDraft = {
				...currentDraft,
				...partialDraft,
				formValues: partialDraft.formValues ? {...partialDraft.formValues} : currentDraft.formValues,
			};
			draftRef.current = nextDraft;
			setRegisterFormDraft(draftKey, nextDraft);
		},
		[draftKey, setRegisterFormDraft],
	);

	const handleMonthChange = useCallback(
		(month: string) => {
			setSelectedMonthState(month);
			persistDraft({selectedMonth: month});
		},
		[persistDraft],
	);

	const handleDayChange = useCallback(
		(day: string) => {
			setSelectedDayState(day);
			persistDraft({selectedDay: day});
		},
		[persistDraft],
	);

	const handleYearChange = useCallback(
		(year: string) => {
			setSelectedYearState(year);
			persistDraft({selectedYear: year});
		},
		[persistDraft],
	);

	const handleConsentChange = useCallback(
		(nextConsent: boolean) => {
			setConsentState(nextConsent);
			persistDraft({consent: nextConsent});
		},
		[persistDraft],
	);

	const handleRegisterSubmit = async (values: Record<string, string>) => {
		if (showPasswordConfirmation && showPassword && values.password !== values.confirm_password) {
			form.setError('confirm_password', t`Passwords do not match`);
			return;
		}

		const dateOfBirth =
			selectedYear && selectedMonth && selectedDay
				? `${selectedYear}-${selectedMonth.padStart(2, '0')}-${selectedDay.padStart(2, '0')}`
				: '';

		const response = await AuthenticationActionCreators.register({
			global_name: values.global_name || undefined,
			username: values.username || undefined,
			email: showEmail ? values.email : undefined,
			password: showPassword ? values.password : undefined,
			date_of_birth: dateOfBirth,
			consent,
			invite_code: inviteCode,
		});

		if (onRegister) {
			await onRegister(response);
		} else {
			await AuthenticationActionCreators.completeLogin({
				token: response.token,
				userId: response.user_id,
			});
		}
		clearRegisterFormDraft(draftKey);
	};

	const {form, isLoading, fieldErrors} = useAuthForm({
		initialValues,
		onSubmit: handleRegisterSubmit,
		redirectPath,
		firstFieldName: showEmail ? 'email' : 'global_name',
	});

	const setDraftedFormValue = useCallback(
		(fieldName: string, value: string) => {
			form.setValue(fieldName, value);
			const nextFormValues = {
				...draftRef.current.formValues,
				[fieldName]: value,
			};
			persistDraft({formValues: nextFormValues});
		},
		[form, persistDraft],
	);

	const {suggestions} = useUsernameSuggestions({
		globalName: form.getValue('global_name'),
		username: form.getValue('username'),
	});

	const missingFields = useMemo(() => {
		const missing: Array<MissingField> = [];
		if (showEmail && !form.getValue('email')) {
			missing.push({key: 'email', label: t`Email`});
		}
		if (showPassword && !form.getValue('password')) {
			missing.push({key: 'password', label: t`Password`});
		}
		if (showPassword && showPasswordConfirmation && !form.getValue('confirm_password')) {
			missing.push({key: 'confirm_password', label: t`Confirm Password`});
		}
		if (!selectedMonth || !selectedDay || !selectedYear) {
			missing.push({key: 'date_of_birth', label: t`Date of Birth`});
		}
		return missing;
	}, [form, selectedMonth, selectedDay, selectedYear, showEmail, showPassword, showPasswordConfirmation]);

	type HelperTextState = {type: 'error'; message: string} | {type: 'suggestion'; username: string} | {type: 'hint'};

	const usernameValue = form.getValue('username');
	const helperTextState = useMemo<HelperTextState>(() => {
		const trimmed = usernameValue?.trim() || '';

		if (showUsernameValidation && trimmed.length > 0) {
			if (trimmed.length > 32) {
				return {type: 'error', message: t`Username must be 32 characters or less`};
			}
			if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
				return {type: 'error', message: t`Only letters, numbers, and underscores`};
			}
		}

		if (trimmed.length === 0 && suggestions.length === 1) {
			return {type: 'suggestion', username: suggestions[0]};
		}

		return {type: 'hint'};
	}, [usernameValue, suggestions, showUsernameValidation, t]);

	return (
		<form className={styles.form} onSubmit={form.handleSubmit}>
			{showEmail && (
				<FormField
					id={emailId}
					name="email"
					type="email"
					autoComplete="email"
					required
					label={t`Email`}
					value={form.getValue('email')}
					onChange={(value) => setDraftedFormValue('email', value)}
					error={form.getError('email') || fieldErrors?.email}
				/>
			)}

			<FormField
				id={globalNameId}
				name="global_name"
				type="text"
				label={t`Display Name (Optional)`}
				placeholder={t`What should people call you?`}
				value={form.getValue('global_name')}
				onChange={(value) => setDraftedFormValue('global_name', value)}
				error={form.getError('global_name') || fieldErrors?.global_name}
			/>

			<div>
				<FormField
					id={usernameId}
					name="username"
					type="text"
					autoComplete="username"
					label={t`Username (Optional)`}
					placeholder={t`Leave blank for a random username`}
					value={usernameValue}
					onChange={(value) => setDraftedFormValue('username', value)}
					onFocus={() => setUsernameFocused(true)}
					onBlur={() => setUsernameFocused(false)}
					error={form.getError('username') || fieldErrors?.username}
				/>
				<AnimatePresence mode="wait" initial={false}>
					{helperTextState.type === 'error' && (
						<motion.span
							key="error"
							className={styles.usernameError}
							initial={AccessibilityStore.useReducedMotion ? {opacity: 1, y: 0} : {opacity: 0, y: -5}}
							animate={{opacity: 1, y: 0}}
							exit={AccessibilityStore.useReducedMotion ? {opacity: 1, y: 0} : {opacity: 0, y: 5}}
							transition={{duration: AccessibilityStore.useReducedMotion ? 0 : 0.2}}
						>
							{helperTextState.message}
						</motion.span>
					)}
					{helperTextState.type === 'suggestion' && (
						<motion.span
							key="suggestion"
							className={styles.usernameHint}
							initial={AccessibilityStore.useReducedMotion ? {opacity: 1, y: 0} : {opacity: 0, y: -5}}
							animate={{opacity: 1, y: 0}}
							exit={AccessibilityStore.useReducedMotion ? {opacity: 1, y: 0} : {opacity: 0, y: 5}}
							transition={{duration: AccessibilityStore.useReducedMotion ? 0 : 0.2}}
						>
							<Trans>How about:</Trans>{' '}
							<button
								type="button"
								className={styles.suggestionLink}
								onClick={() => setDraftedFormValue('username', helperTextState.username)}
							>
								{helperTextState.username}
							</button>
						</motion.span>
					)}
					{helperTextState.type === 'hint' && (
						<motion.span
							key="hint"
							className={styles.usernameHint}
							initial={AccessibilityStore.useReducedMotion ? {opacity: 1, y: 0} : {opacity: 0, y: -5}}
							animate={{opacity: 1, y: 0}}
							exit={AccessibilityStore.useReducedMotion ? {opacity: 1, y: 0} : {opacity: 0, y: 5}}
							transition={{duration: AccessibilityStore.useReducedMotion ? 0 : 0.2}}
						>
							<Trans>A 4-digit tag will be added automatically to ensure uniqueness</Trans>
						</motion.span>
					)}
				</AnimatePresence>
			</div>

			{showPassword && (
				<FormField
					id={passwordId}
					name="password"
					type="password"
					autoComplete="new-password"
					required
					label={t`Password`}
					value={form.getValue('password')}
					onChange={(value) => setDraftedFormValue('password', value)}
					error={form.getError('password') || fieldErrors?.password}
				/>
			)}
			{showPassword && showPasswordConfirmation && (
				<FormField
					id={confirmPasswordId}
					name="confirm_password"
					type="password"
					autoComplete="new-password"
					required
					label={t`Confirm Password`}
					value={form.getValue('confirm_password')}
					onChange={(value) => setDraftedFormValue('confirm_password', value)}
					error={form.getError('confirm_password')}
				/>
			)}

			<DateOfBirthField
				selectedMonth={selectedMonth}
				selectedDay={selectedDay}
				selectedYear={selectedYear}
				onMonthChange={handleMonthChange}
				onDayChange={handleDayChange}
				onYearChange={handleYearChange}
				error={fieldErrors?.date_of_birth}
			/>

			{extraContent}

			<div className={styles.consentRow}>
				<Checkbox checked={consent} onChange={handleConsentChange}>
					<span className={styles.consentLabel}>
						<Trans>I agree to the</Trans>{' '}
						<ExternalLink href={Routes.terms()} className={styles.policyLink}>
							<Trans>Terms of Service</Trans>
						</ExternalLink>{' '}
						<Trans>and</Trans>{' '}
						<ExternalLink href={Routes.privacy()} className={styles.policyLink}>
							<Trans>Privacy Policy</Trans>
						</ExternalLink>
					</span>
				</Checkbox>
			</div>

			<SubmitTooltip consent={consent} missingFields={missingFields}>
				<Button
					type="submit"
					fitContainer
					disabled={isLoading || form.isSubmitting || shouldDisableSubmit(consent, missingFields)}
				>
					{submitLabel}
				</Button>
			</SubmitTooltip>
		</form>
	);
}
