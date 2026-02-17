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
import {useLocation} from '@app/lib/router/React';
import {Routes} from '@app/Routes';
import {Trans, useLingui} from '@lingui/react/macro';
import {useCallback, useId, useMemo, useRef, useState} from 'react';

interface AuthMinimalRegisterFormCoreProps {
	submitLabel: React.ReactNode;
	redirectPath: string;
	onRegister?: (response: {token: string; user_id: string}) => Promise<void>;
	inviteCode?: string;
	extraContent?: React.ReactNode;
}

export function AuthMinimalRegisterFormCore({
	submitLabel,
	redirectPath,
	onRegister,
	inviteCode,
	extraContent,
}: AuthMinimalRegisterFormCoreProps) {
	const {t} = useLingui();
	const location = useLocation();
	const draftKey = `register:${location.pathname}${location.search}`;
	const {getRegisterFormDraft, setRegisterFormDraft, clearRegisterFormDraft} = useAuthRegisterDraftContext();
	const globalNameId = useId();

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

	const initialValues: Record<string, string> = {
		global_name: initialDraft.formValues.global_name ?? '',
	};

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
		const dateOfBirth =
			selectedYear && selectedMonth && selectedDay
				? `${selectedYear}-${selectedMonth.padStart(2, '0')}-${selectedDay.padStart(2, '0')}`
				: '';

		const response = await AuthenticationActionCreators.register({
			global_name: values.global_name || undefined,
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
		firstFieldName: 'global_name',
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
	const missingFields = useMemo(() => {
		const missing: Array<MissingField> = [];
		if (!selectedMonth || !selectedDay || !selectedYear) {
			missing.push({key: 'date_of_birth', label: t`Date of Birth`});
		}
		return missing;
	}, [selectedMonth, selectedDay, selectedYear]);

	const globalNameValue = form.getValue('global_name');

	return (
		<form className={styles.form} onSubmit={form.handleSubmit}>
			<FormField
				id={globalNameId}
				name="global_name"
				type="text"
				label={t`Display Name (Optional)`}
				placeholder={t`What should people call you?`}
				value={globalNameValue}
				onChange={(value) => setDraftedFormValue('global_name', value)}
				error={form.getError('global_name') || fieldErrors?.global_name}
			/>

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
