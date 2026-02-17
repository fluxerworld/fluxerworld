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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import * as UserActionCreators from '@app/actions/UserActionCreators';
import {Form} from '@app/components/form/Form';
import {Input} from '@app/components/form/Input';
import {Select} from '@app/components/form/Select';
import * as Modal from '@app/components/modals/Modal';
import styles from '@app/components/modals/PhoneAddModal.module.css';
import {Button} from '@app/components/uikit/button/Button';
import {
	COUNTRY_CODES,
	type CountryCode,
	formatPhoneNumber,
	getCountryName,
	getDefaultCountry,
	getE164PhoneNumber,
} from '@app/data/CountryCodes';
import {useFormSubmit} from '@app/hooks/useFormSubmit';
import * as EmojiUtils from '@app/utils/EmojiUtils';
import * as LocaleUtils from '@app/utils/LocaleUtils';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useEffect, useState} from 'react';
import {useForm} from 'react-hook-form';
import {components, type FilterOptionOption, type OptionProps, type SingleValueProps} from 'react-select';

interface PhoneFormInputs {
	phoneNumber: string;
}

interface CodeFormInputs {
	code: string;
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
			<div className={styles.flagOption}>
				<img src={EmojiUtils.getEmojiURL(country.flag) ?? undefined} alt={countryName} className={styles.flagImage} />
				<span>{countryName}</span>
				<span className={styles.dialCodeText}>({country.dialCode})</span>
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
			<div className={styles.flagOption}>
				<img src={EmojiUtils.getEmojiURL(country.flag) ?? undefined} alt={countryName} className={styles.flagImage} />
				<span>{country.dialCode}</span>
			</div>
		</components.SingleValue>
	);
});

export const PhoneAddModal = observer(() => {
	const {t} = useLingui();
	const locale = LocaleUtils.getCurrentLocale();
	const countryOptions = getCountryOptions(locale);
	const [step, setStep] = useState<'phone' | 'code'>('phone');
	const [selectedCountry, setSelectedCountry] = useState<CountryCode>(getDefaultCountry());
	const [phoneNumber, setPhoneNumber] = useState('');
	const [formattedPhone, setFormattedPhone] = useState('');
	const phoneForm = useForm<PhoneFormInputs>();
	const codeForm = useForm<CodeFormInputs>();
	useEffect(() => {
		const formatted = formatPhoneNumber(phoneNumber, selectedCountry);
		setFormattedPhone(formatted);
	}, [phoneNumber, selectedCountry]);

	const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		const digitsOnly = value.replace(/\D/g, '');
		setPhoneNumber(digitsOnly);
	};

	const onSubmitPhone = async () => {
		if (!phoneNumber) {
			phoneForm.setError('phoneNumber', {message: 'Phone number is required'});
			return;
		}

		const e164Phone = getE164PhoneNumber(phoneNumber, selectedCountry);
		await UserActionCreators.sendPhoneVerification(e164Phone);
		setStep('code');
	};

	const onSubmitCode = async (data: CodeFormInputs) => {
		const e164Phone = getE164PhoneNumber(phoneNumber, selectedCountry);
		const {phone_token} = await UserActionCreators.verifyPhone(e164Phone, data.code.split(' ').join(''));
		await UserActionCreators.addPhone(phone_token);
		ModalActionCreators.pop();
		ToastActionCreators.createToast({type: 'success', children: <Trans>Phone number added</Trans>});
	};

	const {handleSubmit: handlePhoneSubmit} = useFormSubmit({
		form: phoneForm,
		onSubmit: onSubmitPhone,
		defaultErrorField: 'phoneNumber',
	});

	const {handleSubmit: handleCodeSubmit} = useFormSubmit({
		form: codeForm,
		onSubmit: onSubmitCode,
		defaultErrorField: 'code',
	});

	if (step === 'phone') {
		return (
			<Modal.Root size="small" centered>
				<Form form={phoneForm} onSubmit={handlePhoneSubmit} aria-label={t`Add phone number form`}>
					<Modal.Header title={t`Add Phone Number`} />
					<Modal.Content contentClassName={styles.content}>
						<div className={styles.formContent}>
							<div className={styles.selectWrapper}>
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
						</div>
					</Modal.Content>
					<Modal.Footer>
						<Button onClick={ModalActionCreators.pop} variant="secondary">
							<Trans>Cancel</Trans>
						</Button>
						<Button type="submit" submitting={phoneForm.formState.isSubmitting}>
							<Trans>Send code</Trans>
						</Button>
					</Modal.Footer>
				</Form>
			</Modal.Root>
		);
	}

	return (
		<Modal.Root size="small" centered>
			<Form form={codeForm} onSubmit={handleCodeSubmit} aria-label={t`Verify phone number form`}>
				<Modal.Header title={t`Verify Phone Number`} />
				<Modal.Content contentClassName={styles.content}>
					<Input
						{...codeForm.register('code')}
						autoComplete="one-time-code"
						autoFocus={true}
						error={codeForm.formState.errors.code?.message}
						label={t`Verification Code`}
						required={true}
						footer={
							<p className={styles.footerText}>
								<Trans>Enter the 6-digit code sent to {getE164PhoneNumber(phoneNumber, selectedCountry)}.</Trans>
							</p>
						}
					/>
				</Modal.Content>
				<Modal.Footer>
					<Button onClick={() => setStep('phone')} variant="secondary">
						<Trans>Back</Trans>
					</Button>
					<Button type="submit" submitting={codeForm.formState.isSubmitting}>
						<Trans>Verify</Trans>
					</Button>
				</Modal.Footer>
			</Form>
		</Modal.Root>
	);
});
