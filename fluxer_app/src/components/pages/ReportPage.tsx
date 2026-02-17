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

import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import type {SelectOption} from '@app/components/form/Select';
import styles from '@app/components/pages/ReportPage.module.css';
import {
	COUNTRY_OPTIONS,
	GUILD_CATEGORY_OPTIONS,
	MESSAGE_CATEGORY_OPTIONS,
	REPORT_TYPE_OPTION_DESCRIPTORS,
	USER_CATEGORY_OPTIONS,
} from '@app/components/pages/report/OptionDescriptors';
import {ReportBreadcrumbs} from '@app/components/pages/report/ReportBreadcrumbs';
import {ReportStepComplete} from '@app/components/pages/report/ReportStepComplete';
import {ReportStepDetails} from '@app/components/pages/report/ReportStepDetails';
import {ReportStepEmail} from '@app/components/pages/report/ReportStepEmail';
import {ReportStepSelection} from '@app/components/pages/report/ReportStepSelection';
import {ReportStepVerification} from '@app/components/pages/report/ReportStepVerification';
import type {FlowStep, FormValues, ReportType} from '@app/components/pages/report/ReportTypes';
import {createInitialState, reducer} from '@app/components/pages/report/State';
import {
	EMAIL_REGEX,
	formatVerificationCodeInput,
	isValidHttpUrl,
	normalizeLikelyUrl,
	VERIFICATION_CODE_REGEX,
} from '@app/components/pages/report/Validators';
import type {RadioOption} from '@app/components/uikit/radio_group/RadioGroup';
import {AuthLayoutContext} from '@app/contexts/AuthLayoutContext';
import {Endpoints} from '@app/Endpoints';
import {useFluxerDocumentTitle} from '@app/hooks/useFluxerDocumentTitle';
import HttpClient from '@app/lib/HttpClient';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import type {MessageDescriptor} from '@lingui/core';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback, useContext, useEffect, useLayoutEffect, useMemo, useReducer} from 'react';

interface ValidationError {
	path: string;
	message: string;
}

export const ReportPage = observer(() => {
	const {t} = useLingui();
	const authLayout = useContext(AuthLayoutContext);

	useFluxerDocumentTitle(t`Report Illegal Content`);

	useLayoutEffect(() => {
		if (!authLayout) return;
		authLayout.setShowLogoSide(false);
		return () => authLayout.setShowLogoSide(true);
	}, [authLayout]);

	const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

	const parseValidationErrors = useCallback(
		(
			error: unknown,
		): {fieldErrors: Partial<Record<keyof FormValues, string>>; generalMessage: string | null} | null => {
			if (error && typeof error === 'object' && 'body' in error && (error as {body?: unknown}).body) {
				const body = (error as {body?: Record<string, unknown>}).body;
				const pathMap: Record<string, keyof FormValues> = {
					category: 'category',
					reporter_full_legal_name: 'reporterFullName',
					reporter_country_of_residence: 'reporterCountry',
					reporter_fluxer_tag: 'reporterFluxerTag',
					message_link: 'messageLink',
					reported_user_tag: 'messageUserTag',
					user_id: 'userId',
					user_tag: 'userTag',
					guild_id: 'guildId',
					invite_code: 'inviteCode',
					additional_info: 'additionalInfo',
				};

				if (body?.code === APIErrorCodes.INVALID_FORM_BODY && Array.isArray(body.errors)) {
					const fieldErrors: Partial<Record<keyof FormValues, string>> = {};
					const errors = body.errors as Array<ValidationError>;
					for (const err of errors) {
						const mapped = pathMap[err.path];
						if (mapped) {
							fieldErrors[mapped] = err.message;
						}
					}

					const hasFieldErrors = Object.keys(fieldErrors).length > 0;
					const generalMessage = hasFieldErrors
						? null
						: (errors[0]?.message ?? t`Something went wrong while submitting the report. Please try again.`);

					return {fieldErrors, generalMessage};
				}

				if (typeof body?.message === 'string') {
					return {fieldErrors: {}, generalMessage: body.message};
				}
			}

			return null;
		},
		[t],
	);

	const reportTypeOptions = useMemo<ReadonlyArray<RadioOption<ReportType>>>(() => {
		return REPORT_TYPE_OPTION_DESCRIPTORS.map((option: {value: ReportType; name: MessageDescriptor}) => ({
			value: option.value,
			name: t(option.name),
		}));
	}, [t]);

	const messageCategoryOptions = useMemo<Array<SelectOption<string>>>(() => {
		return MESSAGE_CATEGORY_OPTIONS.map((option: {value: string; label: MessageDescriptor}) => ({
			value: option.value,
			label: t(option.label),
		}));
	}, [t]);

	const userCategoryOptions = useMemo<Array<SelectOption<string>>>(() => {
		return USER_CATEGORY_OPTIONS.map((option: {value: string; label: MessageDescriptor}) => ({
			value: option.value,
			label: t(option.label),
		}));
	}, [t]);

	const guildCategoryOptions = useMemo<Array<SelectOption<string>>>(() => {
		return GUILD_CATEGORY_OPTIONS.map((option: {value: string; label: MessageDescriptor}) => ({
			value: option.value,
			label: t(option.label),
		}));
	}, [t]);

	const countryOptions = useMemo<Array<SelectOption<string>>>(() => {
		return COUNTRY_OPTIONS.map((option: {value: string; label: MessageDescriptor}) => ({
			value: option.value,
			label: t(option.label),
		}));
	}, [t]);

	const categoryOptionsByType = useMemo(() => {
		return {
			message: messageCategoryOptions,
			user: userCategoryOptions,
			guild: guildCategoryOptions,
		} satisfies Record<ReportType, Array<SelectOption<string>>>;
	}, [messageCategoryOptions, userCategoryOptions, guildCategoryOptions]);

	const categoryOptions = state.selectedType ? categoryOptionsByType[state.selectedType] : [];

	useEffect(() => {
		if (state.resendCooldownSeconds <= 0) return;
		const timer = window.setInterval(() => dispatch({type: 'TICK_RESEND_COOLDOWN'}), 1000);
		return () => window.clearInterval(timer);
	}, [state.resendCooldownSeconds, dispatch]);

	useEffect(() => {
		if (state.flowStep === 'selection') return;

		if (!state.selectedType) {
			dispatch({type: 'GO_TO_SELECTION'});
			return;
		}

		if (state.flowStep === 'verification' && !state.email.trim()) {
			dispatch({type: 'GO_TO_EMAIL'});
			return;
		}

		if (state.flowStep === 'details' && !state.ticket) {
			dispatch({type: 'GO_TO_EMAIL'});
			return;
		}

		if (state.flowStep === 'complete' && !state.successReportId) {
			dispatch({type: 'GO_TO_SELECTION'});
		}
	}, [state.flowStep, state.selectedType, state.email, state.ticket, state.successReportId]);

	useEffect(() => {
		window.scrollTo({top: 0, behavior: 'smooth'});
	}, [state.flowStep]);

	const onSelectType = useCallback((type: ReportType) => {
		dispatch({type: 'SELECT_TYPE', reportType: type});
	}, []);

	const sendVerificationCode = useCallback(async () => {
		if (state.isSendingCode || state.isVerifying || state.isSubmitting) return;

		const normalizedEmail = state.email.trim();

		if (!normalizedEmail) {
			dispatch({type: 'SET_ERROR', message: t`Please provide an email address.`});
			return;
		}

		if (!EMAIL_REGEX.test(normalizedEmail)) {
			dispatch({type: 'SET_ERROR', message: t`Please enter a valid email address.`});
			return;
		}

		dispatch({type: 'SET_ERROR', message: null});
		dispatch({type: 'SENDING_CODE', value: true});
		if (state.flowStep === 'verification') {
			dispatch({type: 'START_RESEND_COOLDOWN', seconds: 30});
		}

		try {
			await HttpClient.post({
				url: Endpoints.DSA_REPORT_EMAIL_SEND,
				body: {email: normalizedEmail},
			});

			dispatch({type: 'SET_EMAIL', email: normalizedEmail});
			dispatch({type: 'GO_TO_VERIFICATION'});

			if (state.flowStep === 'verification') {
				ToastActionCreators.createToast({type: 'success', children: t`Code resent`});
			}
		} catch (_error) {
			dispatch({type: 'SET_ERROR', message: t`Failed to send verification code. Please try again.`});
			if (state.flowStep === 'verification') {
				ToastActionCreators.createToast({type: 'error', children: t`Failed to resend code. Please try again.`});
			}
		} finally {
			dispatch({type: 'SENDING_CODE', value: false});
		}
	}, [state.email, state.isSendingCode, state.isVerifying, state.isSubmitting, state.flowStep, t]);

	const verifyCode = useCallback(async () => {
		if (state.isSendingCode || state.isVerifying || state.isSubmitting) return;

		const code = state.verificationCode.trim().toUpperCase();

		if (!code) {
			dispatch({type: 'SET_ERROR', message: t`Enter the code before continuing.`});
			return;
		}

		if (!VERIFICATION_CODE_REGEX.test(code)) {
			dispatch({type: 'SET_ERROR', message: t`Enter a code in the format ABCD-1234.`});
			return;
		}

		const normalizedEmail = state.email.trim();

		if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
			dispatch({type: 'SET_ERROR', message: t`Please go back and enter a valid email address.`});
			return;
		}

		dispatch({type: 'SET_ERROR', message: null});
		dispatch({type: 'VERIFYING', value: true});

		try {
			const response = await HttpClient.post<{ticket: string}>({
				url: Endpoints.DSA_REPORT_EMAIL_VERIFY,
				body: {email: normalizedEmail, code},
			});

			dispatch({type: 'SET_TICKET', ticket: response.body.ticket});
			dispatch({type: 'GO_TO_DETAILS'});
		} catch (_error) {
			dispatch({type: 'SET_ERROR', message: t`The verification code is invalid or expired.`});
		} finally {
			dispatch({type: 'VERIFYING', value: false});
		}
	}, [state.email, state.verificationCode, state.isSendingCode, state.isVerifying, state.isSubmitting, t]);

	const handleSubmit = useCallback(async () => {
		if (!state.selectedType) return;
		if (state.isSubmitting || state.isSendingCode || state.isVerifying) return;

		if (!state.ticket) {
			dispatch({type: 'SET_ERROR', message: t`You must verify your email before submitting a report.`});
			return;
		}

		dispatch({type: 'CLEAR_FIELD_ERRORS'});

		const reporterFullName = state.formValues.reporterFullName.trim();
		const reporterCountry = state.formValues.reporterCountry;
		const reporterFluxerTag = state.formValues.reporterFluxerTag.trim();
		const additionalInfo = state.formValues.additionalInfo.trim();

		if (!state.formValues.category) {
			dispatch({type: 'SET_ERROR', message: t`Select a violation category.`});
			return;
		}

		if (!reporterFullName) {
			dispatch({type: 'SET_ERROR', message: t`Provide your full legal name for the declaration.`});
			return;
		}

		if (!reporterCountry) {
			dispatch({type: 'SET_ERROR', message: t`Select your country of residence.`});
			return;
		}

		const payload: Record<string, unknown> = {
			ticket: state.ticket,
			report_type: state.selectedType,
			category: state.formValues.category,
			reporter_full_legal_name: reporterFullName,
			reporter_country_of_residence: reporterCountry,
		};

		if (reporterFluxerTag) payload.reporter_fluxer_tag = reporterFluxerTag;
		if (additionalInfo) payload.additional_info = additionalInfo;

		switch (state.selectedType) {
			case 'message': {
				const raw = state.formValues.messageLink;
				const normalized = normalizeLikelyUrl(raw);

				if (!raw.trim()) {
					dispatch({type: 'SET_ERROR', message: t`Please paste the message link you are reporting.`});
					return;
				}

				if (!isValidHttpUrl(normalized)) {
					dispatch({type: 'SET_ERROR', message: t`Please enter a valid message link URL.`});
					return;
				}

				payload.message_link = normalized;

				const reportedUserTag = state.formValues.messageUserTag.trim();
				if (reportedUserTag) payload.reported_user_tag = reportedUserTag;
				break;
			}

			case 'user': {
				const userId = state.formValues.userId.trim();
				const userTag = state.formValues.userTag.trim();

				if (!userId && !userTag) {
					dispatch({
						type: 'SET_ERROR',
						message: t`Provide either a user ID or a FluxerTag for the person you are reporting.`,
					});
					return;
				}

				if (userId) payload.user_id = userId;
				if (userTag) payload.user_tag = userTag;
				break;
			}

			case 'guild': {
				const guildId = state.formValues.guildId.trim();
				const inviteCode = state.formValues.inviteCode.trim();

				if (!guildId) {
					dispatch({type: 'SET_ERROR', message: t`Please include the community ID you are reporting.`});
					return;
				}

				payload.guild_id = guildId;
				if (inviteCode) payload.invite_code = inviteCode;
				break;
			}
		}

		dispatch({type: 'SET_ERROR', message: null});
		dispatch({type: 'SUBMITTING', value: true});

		try {
			const response = await HttpClient.post<{report_id: string}>({
				url: Endpoints.DSA_REPORT_CREATE,
				body: payload,
			});

			dispatch({type: 'SUBMIT_SUCCESS', reportId: response.body.report_id});
		} catch (_error) {
			const parsed = parseValidationErrors(_error);
			if (parsed) {
				dispatch({type: 'SET_FIELD_ERRORS', errors: parsed.fieldErrors});
				dispatch({type: 'SET_ERROR', message: parsed.generalMessage});
			} else {
				dispatch({type: 'SET_ERROR', message: t`Something went wrong while submitting the report. Please try again.`});
			}
			dispatch({type: 'SUBMITTING', value: false});
		}
	}, [state, t]);

	const reporterFullName = state.formValues.reporterFullName.trim();
	const reporterCountry = state.formValues.reporterCountry;
	const category = state.formValues.category;

	const messageLinkNormalized = normalizeLikelyUrl(state.formValues.messageLink);
	const messageLinkOk = state.selectedType !== 'message' ? true : isValidHttpUrl(messageLinkNormalized);

	const userTargetOk =
		state.selectedType !== 'user' ? true : Boolean(state.formValues.userId.trim() || state.formValues.userTag.trim());

	const guildTargetOk = state.selectedType !== 'guild' ? true : Boolean(state.formValues.guildId.trim());

	const canSubmit =
		Boolean(category) &&
		Boolean(reporterFullName) &&
		Boolean(reporterCountry) &&
		messageLinkOk &&
		userTargetOk &&
		guildTargetOk;

	const handleBreadcrumbSelect = (step: FlowStep) => {
		switch (step) {
			case 'selection':
				dispatch({type: 'GO_TO_SELECTION'});
				break;
			case 'email':
				dispatch({type: 'GO_TO_EMAIL'});
				break;
			case 'verification':
				dispatch({type: 'GO_TO_VERIFICATION'});
				break;
			case 'details':
				dispatch({type: 'GO_TO_DETAILS'});
				break;
			default:
				break;
		}
	};

	const renderStep = () => {
		switch (state.flowStep) {
			case 'selection':
				return (
					<ReportStepSelection
						reportTypeOptions={reportTypeOptions}
						selectedType={state.selectedType}
						onSelect={onSelectType}
					/>
				);

			case 'email':
				return (
					<ReportStepEmail
						email={state.email}
						errorMessage={state.errorMessage}
						isSending={state.isSendingCode}
						onEmailChange={(value) => dispatch({type: 'SET_EMAIL', email: value})}
						onSubmit={() => void sendVerificationCode()}
						onStartOver={() => dispatch({type: 'GO_TO_SELECTION'})}
					/>
				);

			case 'verification':
				return (
					<ReportStepVerification
						email={state.email}
						verificationCode={state.verificationCode}
						errorMessage={state.errorMessage}
						isVerifying={state.isVerifying}
						isResending={state.isSendingCode}
						resendCooldownSeconds={state.resendCooldownSeconds}
						onChangeEmail={() => dispatch({type: 'GO_TO_EMAIL'})}
						onResend={() => void sendVerificationCode()}
						onVerify={() => void verifyCode()}
						onCodeChange={(value) =>
							dispatch({type: 'SET_VERIFICATION_CODE', code: formatVerificationCodeInput(value)})
						}
						onStartOver={() => dispatch({type: 'GO_TO_SELECTION'})}
					/>
				);

			case 'details':
				return (
					<ReportStepDetails
						selectedType={state.selectedType as ReportType}
						formValues={state.formValues}
						categoryOptions={categoryOptions}
						countryOptions={countryOptions}
						fieldErrors={state.fieldErrors}
						errorMessage={state.errorMessage}
						canSubmit={canSubmit}
						isSubmitting={state.isSubmitting}
						onFieldChange={(field, value) => dispatch({type: 'SET_FORM_FIELD', field, value})}
						onSubmit={() => void handleSubmit()}
						onStartOver={() => dispatch({type: 'RESET_ALL'})}
						onBack={() => dispatch({type: 'GO_TO_VERIFICATION'})}
						messageLinkOk={messageLinkOk}
						userTargetOk={userTargetOk}
						guildTargetOk={guildTargetOk}
					/>
				);

			case 'complete':
				return state.successReportId ? <ReportStepComplete onStartOver={() => dispatch({type: 'RESET_ALL'})} /> : null;

			default:
				return null;
		}
	};

	const breadcrumbs =
		state.flowStep === 'complete' ? null : (
			<ReportBreadcrumbs
				current={state.flowStep}
				hasSelection={Boolean(state.selectedType)}
				hasEmail={Boolean(state.email.trim())}
				hasTicket={Boolean(state.ticket)}
				onSelect={handleBreadcrumbSelect}
			/>
		);

	const breadcrumbShell =
		state.flowStep === 'complete' ? null : (
			<div className={styles.breadcrumbShell}>
				{breadcrumbs ?? <span className={styles.breadcrumbPlaceholder} aria-hidden="true" />}
			</div>
		);

	return (
		<div className={styles.page}>
			{breadcrumbShell}
			<div className={styles.mainColumn}>{renderStep()}</div>
		</div>
	);
});
