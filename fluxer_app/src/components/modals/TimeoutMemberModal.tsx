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

import * as GuildMemberActionCreators from '@app/actions/GuildMemberActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {Input, Textarea} from '@app/components/form/Input';
import {Select as FormSelect} from '@app/components/form/Select';
import * as Modal from '@app/components/modals/Modal';
import styles from '@app/components/modals/TimeoutMemberModal.module.css';
import {getTimeoutDurationOptions} from '@app/components/modals/TimeoutMemberOptions';
import {Button} from '@app/components/uikit/button/Button';
import {Logger} from '@app/lib/Logger';
import type {UserRecord} from '@app/records/UserRecord';
import {
	DAYS_PER_YEAR,
	SECONDS_PER_DAY,
	SECONDS_PER_HOUR,
	SECONDS_PER_MINUTE,
} from '@fluxer/date_utils/src/DateConstants';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useMemo, useState} from 'react';

const logger = new Logger('TimeoutMemberModal');

interface SelectOption<V extends string | number = number> {
	value: V;
	label: string;
}

interface TimeoutMemberModalProps {
	guildId: string;
	targetUser: UserRecord;
}

const MAX_TIMEOUT_SECONDS = DAYS_PER_YEAR * SECONDS_PER_DAY;

type CustomDurationUnit = 'seconds' | 'minutes' | 'hours' | 'days';

const CUSTOM_DURATION_MULTIPLIERS: Record<CustomDurationUnit, number> = {
	seconds: 1,
	minutes: SECONDS_PER_MINUTE,
	hours: SECONDS_PER_HOUR,
	days: SECONDS_PER_DAY,
};

export const TimeoutMemberModal: React.FC<TimeoutMemberModalProps> = observer(({guildId, targetUser}) => {
	const {t, i18n} = useLingui();

	const getCustomDurationUnitOptions = useCallback(
		(): ReadonlyArray<SelectOption<CustomDurationUnit>> => [
			{value: 'seconds', label: t`Seconds`},
			{value: 'minutes', label: t`Minutes`},
			{value: 'hours', label: t`Hours`},
			{value: 'days', label: t`Days`},
		],
		[t],
	);

	const timeoutDurationOptions = useMemo(() => getTimeoutDurationOptions(i18n), [i18n]);

	const durationOptions = useMemo<Array<SelectOption<number | 'custom'>>>(() => {
		const baseOptions = timeoutDurationOptions.map((option) => ({
			value: option.value,
			label: option.label,
		}));
		return [...baseOptions, {value: 'custom' as const, label: t`Custom duration`}];
	}, [timeoutDurationOptions, t]);

	const customDurationUnitOptions = getCustomDurationUnitOptions();

	const [selectedDuration, setSelectedDuration] = useState<number | 'custom'>(timeoutDurationOptions[3].value);
	const [customDurationValue, setCustomDurationValue] = useState('10');
	const [customDurationUnit, setCustomDurationUnit] = useState<CustomDurationUnit>('minutes');
	const [reason, setReason] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	const customDurationNumber = Number(customDurationValue);
	const customDurationSeconds =
		Number.isFinite(customDurationNumber) && customDurationNumber > 0
			? customDurationNumber * CUSTOM_DURATION_MULTIPLIERS[customDurationUnit]
			: 0;

	const customDurationError =
		selectedDuration === 'custom'
			? customDurationNumber <= 0
				? t`Duration must be greater than zero.`
				: customDurationSeconds > MAX_TIMEOUT_SECONDS
					? t`Timeout cannot exceed 365 days.`
					: undefined
			: undefined;

	const isCustomDurationValid = selectedDuration !== 'custom' || !customDurationError;
	const effectiveDurationSeconds = selectedDuration === 'custom' ? customDurationSeconds : (selectedDuration as number);

	const handleTimeout = async () => {
		if (selectedDuration === 'custom' && (!isCustomDurationValid || customDurationSeconds <= 0)) {
			return;
		}

		setIsSubmitting(true);
		try {
			const timeoutUntil = new Date(Date.now() + effectiveDurationSeconds * 1000).toISOString();
			const trimmedReason = reason.trim();
			await GuildMemberActionCreators.timeout(guildId, targetUser.id, timeoutUntil, trimmedReason || null);

			ToastActionCreators.createToast({
				type: 'success',
				children: <Trans>Successfully timed out {targetUser.tag}</Trans>,
			});
			ModalActionCreators.pop();
		} catch (error) {
			logger.error('Failed to timeout member:', error);
			ToastActionCreators.createToast({
				type: 'error',
				children: <Trans>Failed to timeout member. Please try again.</Trans>,
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Modal.Root size="small" centered>
			<Modal.Header title={t`Timeout ${targetUser.tag}`} />
			<Modal.Content>
				<Modal.ContentLayout>
					<p className={styles.helperText}>
						<Trans>
							Prevent <strong>{targetUser.tag}</strong> from sending messages, reacting, and joining voice channels for
							the specified duration.
						</Trans>
					</p>

					<FormSelect<number | 'custom'>
						label={t`Timeout Duration`}
						description={t`How long this user should be timed out for.`}
						value={selectedDuration}
						onChange={(value) => setSelectedDuration(value)}
						options={durationOptions}
						disabled={isSubmitting}
					/>

					{selectedDuration === 'custom' && (
						<>
							<div className={styles.durationInputs}>
								<Input
									type="number"
									label={t`Custom Duration`}
									min={1}
									step={1}
									value={customDurationValue}
									onChange={(event) => setCustomDurationValue(event.target.value)}
									error={customDurationError}
									disabled={isSubmitting}
								/>
								<FormSelect<CustomDurationUnit>
									label={t`Unit`}
									value={customDurationUnit}
									onChange={(value) => setCustomDurationUnit(value)}
									options={customDurationUnitOptions}
									disabled={isSubmitting}
								/>
							</div>

							<p className={styles.hint}>
								<Trans>Enter a numeric value and choose a unit.</Trans>
							</p>

							<p className={styles.hint}>
								<Trans>The timeout cannot exceed 365 days (31536000 seconds).</Trans>
							</p>
						</>
					)}

					<Textarea
						label={t`Reason (Optional)`}
						value={reason}
						onChange={(event) => setReason(event.target.value)}
						maxLength={512}
						minRows={3}
						disabled={isSubmitting}
					/>

					<p className={styles.hint}>
						<Trans>This reason will be displayed in the Activity Log in Community Settings.</Trans>
					</p>
				</Modal.ContentLayout>
			</Modal.Content>

			<Modal.Footer>
				<Button variant="secondary" onClick={() => ModalActionCreators.pop()} disabled={isSubmitting}>
					<Trans>Cancel</Trans>
				</Button>
				<Button
					variant="danger-primary"
					onClick={handleTimeout}
					disabled={isSubmitting || (selectedDuration === 'custom' && !isCustomDurationValid)}
				>
					<Trans>Timeout</Trans>
				</Button>
			</Modal.Footer>
		</Modal.Root>
	);
});
