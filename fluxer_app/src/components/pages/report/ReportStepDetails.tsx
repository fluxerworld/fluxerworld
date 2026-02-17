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

import {Input, Textarea} from '@app/components/form/Input';
import {Select, type SelectOption} from '@app/components/form/Select';
import styles from '@app/components/pages/ReportPage.module.css';
import type {FormValues, ReportType} from '@app/components/pages/report/ReportTypes';
import {Button} from '@app/components/uikit/button/Button';
import {Trans, useLingui} from '@lingui/react/macro';
import type React from 'react';

interface Props {
	selectedType: ReportType;
	formValues: FormValues;
	categoryOptions: Array<SelectOption<string>>;
	countryOptions: Array<SelectOption<string>>;
	fieldErrors: Partial<Record<keyof FormValues, string>>;
	errorMessage: string | null;
	canSubmit: boolean;
	isSubmitting: boolean;
	onFieldChange: (field: keyof FormValues, value: string) => void;
	onSubmit: () => void;
	onStartOver: () => void;
	onBack: () => void;
	messageLinkOk: boolean;
	userTargetOk: boolean;
	guildTargetOk: boolean;
}

export const ReportStepDetails: React.FC<Props> = ({
	selectedType,
	formValues,
	categoryOptions,
	countryOptions,
	fieldErrors,
	errorMessage,
	canSubmit,
	isSubmitting,
	onFieldChange,
	onSubmit,
	onStartOver,
	onBack,
	messageLinkOk,
	userTargetOk,
	guildTargetOk,
}) => {
	const {t} = useLingui();
	const hasFieldErrors = Object.values(fieldErrors).some((value) => Boolean(value));
	const showGeneralError = Boolean(errorMessage && !hasFieldErrors);

	return (
		<div className={styles.card}>
			<header className={styles.cardHeader}>
				<p className={styles.eyebrow}>
					<Trans>Step 4</Trans>
				</p>
				<h1 className={styles.title}>
					<Trans>Report details</Trans>
				</h1>
				<p className={styles.description}>
					<Trans>Share only what's needed to help our team assess the content.</Trans>
				</p>
			</header>

			<div className={styles.cardBody}>
				{showGeneralError && (
					<div className={styles.errorBox} role="alert" aria-live="polite">
						{errorMessage}
					</div>
				)}

				<form
					className={styles.form}
					onSubmit={(e) => {
						e.preventDefault();
						onSubmit();
					}}
				>
					<Select<string>
						label={t`Violation Category`}
						value={formValues.category}
						options={categoryOptions}
						error={fieldErrors.category}
						onChange={(value) => onFieldChange('category', value)}
						isSearchable={false}
					/>

					{selectedType === 'message' && (
						<>
							<Input
								label={t`Message Link`}
								type="url"
								value={formValues.messageLink}
								onChange={(e) => onFieldChange('messageLink', e.target.value)}
								placeholder="https://fluxer.app/channels/..."
								autoComplete="off"
								error={fieldErrors.messageLink}
								footer={
									!formValues.messageLink.trim() ? undefined : !messageLinkOk ? (
										<span className={styles.helperText}>
											<Trans>That doesn't look like a valid URL.</Trans>
										</span>
									) : undefined
								}
							/>
							<Input
								label={t`Reported User Tag (Optional)`}
								type="text"
								value={formValues.messageUserTag}
								onChange={(e) => onFieldChange('messageUserTag', e.target.value)}
								placeholder="username#1234"
								autoComplete="off"
								error={fieldErrors.messageUserTag}
							/>
						</>
					)}

					{selectedType === 'user' && (
						<>
							<Input
								label={t`User ID (Optional)`}
								type="text"
								value={formValues.userId}
								onChange={(e) => onFieldChange('userId', e.target.value)}
								placeholder="123456789012345678"
								autoComplete="off"
								error={fieldErrors.userId}
							/>
							<Input
								label={t`User Tag (Optional)`}
								type="text"
								value={formValues.userTag}
								onChange={(e) => onFieldChange('userTag', e.target.value)}
								placeholder="username#1234"
								autoComplete="off"
								error={fieldErrors.userTag}
								footer={
									userTargetOk ? undefined : (
										<span className={styles.helperText}>
											<Trans>Provide at least a user ID or a user tag.</Trans>
										</span>
									)
								}
							/>
						</>
					)}

					{selectedType === 'guild' && (
						<>
							<Input
								label={t`Community ID`}
								type="text"
								value={formValues.guildId}
								onChange={(e) => onFieldChange('guildId', e.target.value)}
								placeholder="123456789012345678"
								autoComplete="off"
								error={fieldErrors.guildId}
								footer={
									guildTargetOk ? undefined : (
										<span className={styles.helperText}>
											<Trans>Community ID is required.</Trans>
										</span>
									)
								}
							/>
							<Input
								label={t`Invite Code (Optional)`}
								type="text"
								value={formValues.inviteCode}
								onChange={(e) => onFieldChange('inviteCode', e.target.value)}
								placeholder="abcDEF12"
								autoComplete="off"
								error={fieldErrors.inviteCode}
							/>
						</>
					)}

					<Input
						label={t`Full Legal Name`}
						type="text"
						value={formValues.reporterFullName}
						onChange={(e) => onFieldChange('reporterFullName', e.target.value)}
						placeholder={t`First and last name`}
						autoComplete="name"
						error={fieldErrors.reporterFullName}
					/>

					<Select<string>
						label={t`Country of Residence`}
						value={formValues.reporterCountry}
						options={countryOptions}
						error={fieldErrors.reporterCountry}
						onChange={(value) => onFieldChange('reporterCountry', value)}
					/>

					<Input
						label={t`Your FluxerTag (Optional)`}
						type="text"
						value={formValues.reporterFluxerTag}
						onChange={(e) => onFieldChange('reporterFluxerTag', e.target.value)}
						placeholder="username#1234"
						error={fieldErrors.reporterFluxerTag}
					/>

					<Textarea
						label={t`Additional Comments (Optional)`}
						value={formValues.additionalInfo}
						onChange={(e) => onFieldChange('additionalInfo', e.target.value)}
						placeholder={t`Describe what makes the content illegal`}
						maxLength={1000}
						minRows={3}
						maxRows={6}
						error={fieldErrors.additionalInfo}
					/>

					<div className={styles.actionRow}>
						<Button
							fitContent
							type="submit"
							disabled={!canSubmit || isSubmitting}
							submitting={isSubmitting}
							className={styles.actionButton}
						>
							<Trans>Submit DSA Report</Trans>
						</Button>
						<Button variant="secondary" fitContent type="button" onClick={onBack} disabled={isSubmitting}>
							<Trans>Back</Trans>
						</Button>
					</div>
				</form>
			</div>

			<footer className={styles.footerLinks}>
				<p className={styles.linkRow}>
					<button type="button" className={styles.linkButton} onClick={onStartOver} disabled={isSubmitting}>
						<Trans>Start over</Trans>
					</button>
				</p>
			</footer>
		</div>
	);
};
