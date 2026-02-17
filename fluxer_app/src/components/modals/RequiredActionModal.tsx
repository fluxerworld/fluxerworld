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
import {VerificationResult} from '@app/actions/AuthenticationActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import * as UserActionCreators from '@app/actions/UserActionCreators';
import {Form} from '@app/components/form/Form';
import {Input} from '@app/components/form/Input';
import {Select} from '@app/components/form/Select';
import * as Modal from '@app/components/modals/Modal';
import styles from '@app/components/modals/RequiredActionModal.module.css';
import {Button} from '@app/components/uikit/button/Button';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {
	COUNTRY_CODES,
	type CountryCode,
	formatPhoneNumber,
	getCountryName,
	getDefaultCountry,
	getE164PhoneNumber,
} from '@app/data/CountryCodes';
import {useFormSubmit} from '@app/hooks/useFormSubmit';
import DeveloperOptionsStore from '@app/stores/DeveloperOptionsStore';
import LayerManager from '@app/stores/LayerManager';
import UserStore from '@app/stores/UserStore';
import * as EmojiUtils from '@app/utils/EmojiUtils';
import * as LocaleUtils from '@app/utils/LocaleUtils';
import type {RequiredAction} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import type {MessageDescriptor} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {WarningIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {useForm} from 'react-hook-form';
import {components, type FilterOptionOption, type OptionProps, type SingleValueProps} from 'react-select';

interface PhoneFormInputs {
	phoneNumber: string;
}
interface CodeFormInputs {
	code: string;
}

interface BouncedEmailFormInputs {
	newEmail: string;
}

interface CountrySelectOption {
	value: string;
	label: string;
	country: CountryCode;
}

const getCountryOptions = (locale: string): ReadonlyArray<CountrySelectOption> =>
	COUNTRY_CODES.map((country) => ({
		value: country.code,
		label: `${getCountryName(country.code, locale)} (${country.dialCode})`,
		country,
	}));

const CountryOption = observer((props: OptionProps<CountrySelectOption>) => {
	const {country} = props.data;
	const locale = LocaleUtils.getCurrentLocale();
	const countryName = getCountryName(country.code, locale);
	return (
		<components.Option {...props}>
			<div className={styles.countryOption}>
				<img src={EmojiUtils.getEmojiURL(country.flag) ?? undefined} alt={countryName} className={styles.countryFlag} />
				<span>{countryName}</span>
				<span className={styles.countryDialCode}>({country.dialCode})</span>
			</div>
		</components.Option>
	);
});

const SingleValue = observer((props: SingleValueProps<CountrySelectOption>) => {
	const {country} = props.data;
	const locale = LocaleUtils.getCurrentLocale();
	const countryName = getCountryName(country.code, locale);
	return (
		<components.SingleValue {...props}>
			<div className={styles.countryValue}>
				<img src={EmojiUtils.getEmojiURL(country.flag) ?? undefined} alt={countryName} className={styles.countryFlag} />
				<span>{country.dialCode}</span>
			</div>
		</components.SingleValue>
	);
});

type VerificationMode = 'email' | 'phone' | 'email_or_phone';
type PhoneVerificationStep = 'phone' | 'code';
interface VerificationTab {
	id: 'email' | 'phone';
	label: string;
}

const getVerificationMode = (requiredActions: Array<RequiredAction>): VerificationMode => {
	if (
		requiredActions.includes('REQUIRE_VERIFIED_EMAIL_OR_VERIFIED_PHONE') ||
		requiredActions.includes('REQUIRE_REVERIFIED_EMAIL_OR_VERIFIED_PHONE') ||
		requiredActions.includes('REQUIRE_VERIFIED_EMAIL_OR_REVERIFIED_PHONE') ||
		requiredActions.includes('REQUIRE_REVERIFIED_EMAIL_OR_REVERIFIED_PHONE')
	) {
		return 'email_or_phone';
	}
	if (requiredActions.includes('REQUIRE_VERIFIED_PHONE') || requiredActions.includes('REQUIRE_REVERIFIED_PHONE')) {
		return 'phone';
	}
	return 'email';
};

const getTitleDescriptor = (mode: VerificationMode, reverify = false, emailBounced = false): MessageDescriptor => {
	switch (mode) {
		case 'email':
			if (emailBounced) {
				return msg`Email Update Required`;
			}
			return reverify ? msg`Email Re-Verification Required` : msg`Email Verification Required`;
		case 'phone':
			return reverify ? msg`Phone Re-Verification Required` : msg`Phone Verification Required`;
		case 'email_or_phone':
			return reverify ? msg`Email or Phone Re-Verification Required` : msg`Account Verification Required`;
	}
};

const getDescriptionDescriptor = (
	mode: VerificationMode,
	reverify = false,
	emailBounced = false,
): MessageDescriptor => {
	switch (mode) {
		case 'email':
			if (emailBounced) {
				return msg`Your current email address couldn't receive messages. Please update it to continue using Fluxer.`;
			}
			return reverify
				? msg`We've detected suspicious activity on your account. Please reverify your email address to continue using Fluxer.`
				: msg`We've detected suspicious activity on your account. Please verify your email address to continue using Fluxer.`;
		case 'phone':
			return reverify
				? msg`We've detected suspicious activity on your account. Please reverify your phone number to continue using Fluxer.`
				: msg`We've detected suspicious activity on your account. Please verify your phone number to continue using Fluxer.`;
		case 'email_or_phone':
			return reverify
				? msg`We've detected suspicious activity on your account. Please reverify your email address or phone number to continue using Fluxer.`
				: msg`We've detected suspicious activity on your account. Please verify your email address or phone number to continue using Fluxer.`;
	}
};

const RequiredActionModal: React.FC<{mock?: boolean}> = observer(({mock = false}) => {
	const {t} = useLingui();
	const user = UserStore.currentUser;

	const [selectedVerificationType, setSelectedVerificationType] = useState<'email' | 'phone'>(
		DeveloperOptionsStore.mockRequiredActionsSelectedTab,
	);
	const [phoneVerificationStep, setPhoneVerificationStep] = useState<PhoneVerificationStep>(
		DeveloperOptionsStore.mockRequiredActionsPhoneStep,
	);
	const [bouncedEmailStep, setBouncedEmailStep] = useState<'new_email' | 'code'>('new_email');
	const [bouncedEmailTicket, setBouncedEmailTicket] = useState<string | null>(null);
	const [bouncedEmailRecipient, setBouncedEmailRecipient] = useState<string | null>(null);
	const [isResendingEmail, setIsResendingEmail] = useState(false);
	const [isResendingBouncedEmailCode, setIsResendingBouncedEmailCode] = useState(false);
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const [selectedCountry, setSelectedCountry] = useState<CountryCode>(getDefaultCountry());
	const [phoneNumber, setPhoneNumber] = useState('');
	const [formattedPhone, setFormattedPhone] = useState('');
	const phoneForm = useForm<PhoneFormInputs>();
	const codeForm = useForm<CodeFormInputs>();
	const bouncedEmailForm = useForm<BouncedEmailFormInputs>();
	const bouncedEmailCodeForm = useForm<CodeFormInputs>();
	const locale = LocaleUtils.getCurrentLocale();
	const countryOptions = getCountryOptions(locale);
	const isEmailBounced = !mock && !!user?.emailBounced;

	const effectiveMode: VerificationMode = useMemo(() => {
		if (mock) {
			return DeveloperOptionsStore.mockRequiredActionsMode;
		}
		const required = user?.requiredActions ?? [];
		return getVerificationMode(required);
	}, [mock, user?.requiredActions, DeveloperOptionsStore.mockRequiredActionsMode]);

	const verificationTabs = useMemo<Array<VerificationTab>>(
		() => [
			{id: 'email', label: t`Email`},
			{id: 'phone', label: t`Phone`},
		],
		[t],
	);

	const isReverify = mock ? DeveloperOptionsStore.mockRequiredActionsReverify : false;
	const showBouncedEmailFlow =
		isEmailBounced &&
		(effectiveMode === 'email' || (effectiveMode === 'email_or_phone' && selectedVerificationType === 'email'));

	useEffect(() => {
		const formatted = formatPhoneNumber(phoneNumber, selectedCountry);
		setFormattedPhone(formatted);
	}, [phoneNumber, selectedCountry]);

	useEffect(() => {
		if (!mock) {
			LayerManager.closeAll();
		}
	}, [mock]);

	useEffect(() => {
		if (mock) {
			setSelectedVerificationType(DeveloperOptionsStore.mockRequiredActionsSelectedTab);
			setPhoneVerificationStep(DeveloperOptionsStore.mockRequiredActionsPhoneStep);
		} else {
			setSelectedVerificationType('email');
			setPhoneVerificationStep('phone');
			setBouncedEmailStep('new_email');
			setBouncedEmailTicket(null);
			setBouncedEmailRecipient(null);
			setIsResendingEmail(false);
			setIsResendingBouncedEmailCode(false);
			setPhoneNumber('');
			setFormattedPhone('');
			phoneForm.reset();
			codeForm.reset();
			bouncedEmailForm.reset();
			bouncedEmailCodeForm.reset();
		}
	}, [mock, user?.requiredActions, phoneForm, codeForm, bouncedEmailForm, bouncedEmailCodeForm]);

	const onSubmitPhone = useCallback(async () => {
		if (!phoneNumber) {
			phoneForm.setError('phoneNumber', {message: t`Phone number is required`});
			return;
		}
		const e164Phone = getE164PhoneNumber(phoneNumber, selectedCountry);
		await UserActionCreators.sendPhoneVerification(e164Phone);
		setPhoneVerificationStep('code');
	}, [phoneForm, phoneNumber, selectedCountry, t]);

	const onSubmitCode = useCallback(
		async (data: CodeFormInputs) => {
			const e164Phone = getE164PhoneNumber(phoneNumber, selectedCountry);
			const {phone_token} = await UserActionCreators.verifyPhone(e164Phone, data.code.split(' ').join(''));
			await UserActionCreators.addPhone(phone_token);
			ToastActionCreators.createToast({type: 'success', children: <Trans>Phone number verified</Trans>});
		},
		[phoneNumber, selectedCountry],
	);

	const onSubmitBouncedEmail = useCallback(
		async (data: BouncedEmailFormInputs) => {
			const result = await UserActionCreators.requestBouncedEmailChangeNew(data.newEmail);
			setBouncedEmailTicket(result.ticket);
			setBouncedEmailRecipient(result.new_email);
			setBouncedEmailStep('code');
			bouncedEmailCodeForm.reset();
			ToastActionCreators.success(t`Verification code sent. Check your new email inbox.`);
		},
		[bouncedEmailCodeForm, t],
	);

	const onSubmitBouncedEmailCode = useCallback(
		async (data: CodeFormInputs) => {
			if (!bouncedEmailTicket) {
				bouncedEmailCodeForm.setError('code', {message: t`Please request a verification code first.`});
				return;
			}

			const updatedUser = await UserActionCreators.verifyBouncedEmailChangeNew(
				bouncedEmailTicket,
				data.code.split(' ').join(''),
			);
			UserStore.handleUserUpdate(updatedUser);
			ToastActionCreators.success(t`Your email address has been updated.`);
		},
		[bouncedEmailCodeForm, bouncedEmailTicket, t],
	);

	const {handleSubmit: handlePhoneSubmit, isSubmitting: isPhoneSubmitting} = useFormSubmit({
		form: phoneForm,
		onSubmit: onSubmitPhone,
		defaultErrorField: 'phoneNumber',
	});

	const {handleSubmit: handleCodeSubmit, isSubmitting: isCodeSubmitting} = useFormSubmit({
		form: codeForm,
		onSubmit: onSubmitCode,
		defaultErrorField: 'code',
	});

	const {handleSubmit: handleBouncedEmailSubmit, isSubmitting: isBouncedEmailSubmitting} = useFormSubmit({
		form: bouncedEmailForm,
		onSubmit: onSubmitBouncedEmail,
		defaultErrorField: 'newEmail',
	});

	const {handleSubmit: handleBouncedEmailCodeSubmit, isSubmitting: isBouncedEmailCodeSubmitting} = useFormSubmit({
		form: bouncedEmailCodeForm,
		onSubmit: onSubmitBouncedEmailCode,
		defaultErrorField: 'code',
	});

	const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		const digitsOnly = value.replace(/\D/g, '');
		setPhoneNumber(digitsOnly);
	};

	const handleResendEmail = async () => {
		if (mock) {
			const outcome = DeveloperOptionsStore.mockRequiredActionsResendOutcome;
			switch (outcome) {
				case 'success':
					ToastActionCreators.success(t`Verification email sent! Please check your inbox.`);
					break;
				case 'rate_limited':
					ToastActionCreators.error(t`Too many requests. Please try again later.`);
					break;
				case 'server_error':
					ToastActionCreators.error(t`Failed to send verification email. Please try again later.`);
					break;
			}
			return;
		}
		if (isResendingEmail) return;
		setIsResendingEmail(true);
		const result = await AuthenticationActionCreators.resendVerificationEmail();
		switch (result) {
			case VerificationResult.SUCCESS:
				ToastActionCreators.success(t`Verification email sent! Please check your inbox.`);
				break;
			case VerificationResult.RATE_LIMITED:
				ToastActionCreators.error(t`Too many requests. Please try again later.`);
				break;
			case VerificationResult.SERVER_ERROR:
				ToastActionCreators.error(t`Failed to send verification email. Please try again later.`);
				break;
		}
		setIsResendingEmail(false);
	};

	const isEmailResending = mock ? DeveloperOptionsStore.mockRequiredActionsResending : isResendingEmail;

	const handleResendBouncedEmailCode = useCallback(async () => {
		if (!bouncedEmailTicket || isResendingBouncedEmailCode) {
			return;
		}

		setIsResendingBouncedEmailCode(true);
		try {
			await UserActionCreators.resendBouncedEmailChangeNew(bouncedEmailTicket);
			ToastActionCreators.success(t`A new verification code has been sent.`);
		} catch {
			ToastActionCreators.error(t`Failed to resend verification code. Please try again later.`);
		} finally {
			setIsResendingBouncedEmailCode(false);
		}
	}, [bouncedEmailTicket, isResendingBouncedEmailCode, t]);

	const handleLogout = useCallback(async () => {
		if (isLoggingOut) {
			return;
		}
		setIsLoggingOut(true);
		try {
			await AuthenticationActionCreators.logout();
		} finally {
			setIsLoggingOut(false);
		}
	}, [isLoggingOut]);

	const renderBackdrop = useMemo(() => {
		return (
			<div
				style={{
					position: 'absolute',
					inset: 0,
					backgroundColor: 'hsl(0deg 0% 0%)',
					opacity: 0.95,
					backdropFilter: 'blur(12px)',
					WebkitBackdropFilter: 'blur(12px)',
					pointerEvents: mock ? 'auto' : 'none',
				}}
			/>
		);
	}, [mock]);

	return (
		<Modal.Root
			size="small"
			centered
			onClose={mock ? () => ModalActionCreators.pop() : undefined}
			backdropSlot={renderBackdrop}
		>
			<Modal.ScreenReaderLabel text={t`Account Verification Required`} />
			<Modal.Content>
				<div className={styles.container}>
					<div className={styles.header}>
						<div className={styles.iconContainer}>
							<WarningIcon weight="fill" className={styles.icon} />
						</div>
						<h2 className={styles.title}>{t(getTitleDescriptor(effectiveMode, isReverify, isEmailBounced))}</h2>
						<p className={styles.description}>
							{t(getDescriptionDescriptor(effectiveMode, isReverify, isEmailBounced))}
						</p>
					</div>

					{effectiveMode === 'email_or_phone' && (
						<div className={styles.tabContainer}>
							{verificationTabs.map((tab) => (
								<FocusRing key={tab.id} offset={-2}>
									<button
										type="button"
										className={clsx(
											styles.tabButton,
											selectedVerificationType === tab.id ? styles.tabActive : styles.tabInactive,
										)}
										onClick={() => setSelectedVerificationType(tab.id)}
										aria-pressed={selectedVerificationType === tab.id}
									>
										{tab.label}
									</button>
								</FocusRing>
							))}
						</div>
					)}

					<div className={styles.contentContainer}>
						{(effectiveMode === 'email' ||
							(effectiveMode === 'email_or_phone' && selectedVerificationType === 'email')) &&
							(showBouncedEmailFlow ? (
								<>
									<div className={styles.stepsCard}>
										<p className={styles.stepText}>
											<Trans>
												Your current email <strong>{user?.email}</strong> could not receive messages. Enter a different
												email address to continue.
											</Trans>
										</p>
									</div>

									{bouncedEmailStep === 'new_email' ? (
										<Form form={bouncedEmailForm} onSubmit={handleBouncedEmailSubmit}>
											<div className={styles.formContainer}>
												<Input
													{...bouncedEmailForm.register('newEmail')}
													autoComplete="email"
													autoFocus={true}
													error={bouncedEmailForm.formState.errors.newEmail?.message}
													label={t`New Email`}
													placeholder={t`name@example.com`}
													required={true}
													type="email"
													footer={
														<p className={styles.footerText}>
															<Trans>We'll send a verification code to this email address.</Trans>
														</p>
													}
												/>

												<Button type="submit" submitting={isBouncedEmailSubmitting}>
													<Trans>Send Code</Trans>
												</Button>
											</div>
										</Form>
									) : (
										<Form form={bouncedEmailCodeForm} onSubmit={handleBouncedEmailCodeSubmit}>
											<div className={styles.formContainer}>
												<Input
													{...bouncedEmailCodeForm.register('code')}
													autoComplete="one-time-code"
													autoFocus={true}
													error={bouncedEmailCodeForm.formState.errors.code?.message}
													label={t`Verification Code`}
													required={true}
													footer={
														<p className={styles.footerText}>
															<Trans>
																Enter the verification code sent to{' '}
																{bouncedEmailRecipient ?? user?.email ?? t`your new email`}.
															</Trans>
														</p>
													}
												/>

												<div className={styles.buttonGroup}>
													<Button type="submit" submitting={isBouncedEmailCodeSubmitting}>
														<Trans>Update Email</Trans>
													</Button>
													<Button
														variant="secondary"
														onClick={handleResendBouncedEmailCode}
														disabled={isBouncedEmailCodeSubmitting || isResendingBouncedEmailCode}
														submitting={isResendingBouncedEmailCode}
													>
														<Trans>Resend Code</Trans>
													</Button>
													<Button
														variant="secondary"
														onClick={() => {
															setBouncedEmailStep('new_email');
															setBouncedEmailTicket(null);
															setBouncedEmailRecipient(null);
															bouncedEmailCodeForm.reset();
														}}
														disabled={isBouncedEmailCodeSubmitting}
													>
														<Trans>Use Different Email</Trans>
													</Button>
												</div>
											</div>
										</Form>
									)}
								</>
							) : (
								<>
									<div className={styles.stepsCard}>
										<div className={styles.stepsContainer}>
											<div className={styles.stepRow}>
												<div className={styles.stepBadge}>1</div>
												<p className={styles.stepText}>
													<Trans>
														Check your inbox at <strong>{user?.email}</strong> for a verification email.
													</Trans>
												</p>
											</div>
											<div className={styles.stepRow}>
												<div className={styles.stepBadge}>2</div>
												<p className={styles.stepText}>
													<Trans>Click the verification link in the email.</Trans>
												</p>
											</div>
											<div className={styles.stepRow}>
												<div className={styles.stepBadge}>3</div>
												<p className={styles.stepText}>
													<Trans>Return to this page to continue.</Trans>
												</p>
											</div>
										</div>
									</div>

									<div className={styles.resendSection}>
										<p className={styles.resendText}>
											<Trans>Didn't receive the email?</Trans>
										</p>
										<Button onClick={handleResendEmail} disabled={isEmailResending} submitting={isEmailResending}>
											<Trans>Resend Verification Email</Trans>
										</Button>
									</div>
								</>
							))}

						{(effectiveMode === 'phone' ||
							(effectiveMode === 'email_or_phone' && selectedVerificationType === 'phone')) &&
							(phoneVerificationStep === 'phone' ? (
								<Form form={phoneForm} onSubmit={handlePhoneSubmit}>
									<div className={styles.phoneInputContainer}>
										<div className={styles.inputGroup}>
											<Select
												label={t`Country`}
												value={selectedCountry.code}
												onChange={(value) => {
													const country = countryOptions.find((o) => o.value === value)?.country;
													if (country) {
														setSelectedCountry(country);
														setPhoneNumber('');
														setFormattedPhone('');
													}
												}}
												options={countryOptions}
												components={{
													Option: CountryOption as React.ComponentType<OptionProps<CountrySelectOption>>,
													SingleValue: SingleValue as React.ComponentType<SingleValueProps<CountrySelectOption>>,
												}}
												placeholder={t`Search countries...`}
												filterOption={(option: FilterOptionOption<CountrySelectOption>, inputValue: string) => {
													const searchTerm = inputValue.toLowerCase();
													const countryName = getCountryName(option.data.country.code, locale);
													return (
														countryName.toLowerCase().includes(searchTerm) ||
														option.data.country.dialCode.includes(searchTerm) ||
														option.data.country.code.toLowerCase().includes(searchTerm)
													);
												}}
											/>
										</div>

										<Input
											{...phoneForm.register('phoneNumber')}
											autoComplete="tel"
											autoFocus={true}
											value={formattedPhone}
											onChange={handlePhoneInput}
											error={phoneForm.formState.errors.phoneNumber?.message}
											label={t`Phone Number`}
											placeholder={selectedCountry.format || '##########'}
											required={true}
											footer={
												<p className={styles.footerText}>
													<Trans>Enter your phone number. We'll send you a verification code via SMS.</Trans>
												</p>
											}
										/>

										<Button type="submit" submitting={isPhoneSubmitting}>
											<Trans>Send Code</Trans>
										</Button>
									</div>
								</Form>
							) : (
								<Form form={codeForm} onSubmit={handleCodeSubmit}>
									<div className={styles.formContainer}>
										<Input
											{...codeForm.register('code')}
											autoComplete="one-time-code"
											autoFocus={true}
											error={codeForm.formState.errors.code?.message}
											label={t`Verification Code`}
											required={true}
											footer={
												<p className={styles.footerText}>
													<Trans>
														Enter the 6-digit code sent to {getE164PhoneNumber(phoneNumber, selectedCountry)}.
													</Trans>
												</p>
											}
										/>

										<div className={styles.buttonGroup}>
											<Button type="submit" submitting={isCodeSubmitting}>
												<Trans>Verify</Trans>
											</Button>
											<Button onClick={() => setPhoneVerificationStep('phone')} variant="secondary">
												<Trans>Back</Trans>
											</Button>
										</div>
									</div>
								</Form>
							))}
					</div>
				</div>
			</Modal.Content>
			<Modal.Footer>
				{mock && (
					<Button variant="secondary" onClick={() => ModalActionCreators.pop()} disabled={isLoggingOut}>
						<Trans>Dismiss</Trans>
					</Button>
				)}
				<Button variant="danger-secondary" onClick={handleLogout} submitting={isLoggingOut}>
					<Trans>Log Out</Trans>
				</Button>
			</Modal.Footer>
		</Modal.Root>
	);
});

export default RequiredActionModal;
