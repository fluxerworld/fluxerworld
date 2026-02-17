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

import styles from '@app/components/form/DateTimePickerField.module.css';
import surfaceStyles from '@app/components/form/FormSurface.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {PASSWORD_MANAGER_IGNORE_ATTRIBUTES} from '@app/lib/PasswordManagerAutocomplete';
import {useLingui} from '@lingui/react/macro';
import {CalendarBlankIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {DateTime} from 'luxon';
import type React from 'react';
import {useCallback, useMemo, useState} from 'react';
import {Button, Dialog, DialogTrigger, Popover} from 'react-aria-components';
import {DayPicker} from 'react-day-picker';

interface DateTimePickerFieldProps {
	label?: string;
	description?: string;
	value: Date | null;
	onChange: (date: Date | null) => void;
	minDate?: Date;
	maxDate?: Date;
	disabled?: boolean;
	error?: string;
	className?: string;
}

function formatDisplayDate(date: Date | null): string {
	if (!date) {
		return '';
	}
	const dt = DateTime.fromJSDate(date);
	return dt.toFormat('d LLL yyyy, HH:mm');
}

function toTimeString(date: Date): string {
	return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export const DateTimePickerField: React.FC<DateTimePickerFieldProps> = (props) => {
	const {t} = useLingui();
	const {label, description, value, onChange, minDate, maxDate, disabled, error, className} = props;

	const [popoutOpen, setPopoutOpen] = useState(false);

	const displayValue = useMemo(() => formatDisplayDate(value), [value]);
	const timeValue = useMemo(() => (value ? toTimeString(value) : '00:00'), [value]);

	const handleDaySelect = useCallback(
		(selected: Date | undefined) => {
			if (!selected) {
				return;
			}
			const current = value ?? new Date();
			const merged = new Date(selected);
			merged.setHours(current.getHours(), current.getMinutes(), 0, 0);
			onChange(merged);
		},
		[value, onChange],
	);

	const handleTimeChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const timeStr = event.target.value;
			if (!timeStr) {
				return;
			}
			const [hours, minutes] = timeStr.split(':').map(Number);
			const current = value ?? new Date();
			const updated = new Date(current);
			updated.setHours(hours, minutes, 0, 0);
			onChange(updated);
		},
		[value, onChange],
	);

	const disabledMatcher = useMemo(() => {
		const matchers: Array<{before: Date} | {after: Date}> = [];
		if (minDate) {
			matchers.push({before: minDate});
		}
		if (maxDate) {
			matchers.push({after: maxDate});
		}
		return matchers;
	}, [minDate, maxDate]);

	const calendarClassNames = useMemo(
		() => ({
			root: styles.rdpRoot,
			months: styles.rdpMonths,
			month: styles.rdpMonth,
			nav: styles.rdpNav,
			month_caption: styles.rdpMonthCaption,
			caption_label: styles.rdpCaptionLabel,
			button_previous: styles.rdpButtonPrevious,
			button_next: styles.rdpButtonNext,
			chevron: styles.rdpChevron,
			month_grid: styles.rdpMonthGrid,
			weekday: styles.rdpWeekday,
			day: styles.rdpDay,
			day_button: styles.rdpDayButton,
			today: styles.rdpToday,
			selected: styles.rdpSelected,
			outside: styles.rdpOutside,
			disabled: styles.rdpDisabled,
			hidden: styles.rdpHidden,
		}),
		[],
	);

	return (
		<FocusRing within={true} offset={-2} enabled={!disabled}>
			<fieldset className={clsx(styles.fieldset, className)}>
				{label && (
					<div className={styles.labelContainer}>
						<legend className={styles.label}>{label}</legend>
					</div>
				)}

				<div className={styles.inputContainer}>
					<div className={clsx(styles.inputWrapper, surfaceStyles.surface)}>
						<input
							type="text"
							{...PASSWORD_MANAGER_IGNORE_ATTRIBUTES}
							readOnly={true}
							value={displayValue}
							placeholder={t`Select a date and time`}
							disabled={disabled}
							className={styles.input}
							aria-label={label ?? t`Date and time`}
						/>
						<div className={styles.divider} />
						<DialogTrigger isOpen={popoutOpen} onOpenChange={setPopoutOpen}>
							<Button className={styles.calendarButton} aria-label={t`Open date picker`} isDisabled={disabled}>
								<CalendarBlankIcon size={18} />
							</Button>
							<Popover placement="bottom start" offset={8} className={styles.popover}>
								<Dialog className={styles.dialog} aria-label={t`Date picker`}>
									<div className={styles.calendarContainer}>
										<DayPicker
											mode="single"
											selected={value ?? undefined}
											onSelect={handleDaySelect}
											startMonth={minDate}
											endMonth={maxDate}
											disabled={disabledMatcher}
											defaultMonth={value ?? undefined}
											showOutsideDays={true}
											classNames={calendarClassNames}
										/>
										<div className={styles.timeRow}>
											<label className={styles.timeLabel} htmlFor="rdp-time-input">
												{t`Time`}
											</label>
											<input
												id="rdp-time-input"
												type="time"
												{...PASSWORD_MANAGER_IGNORE_ATTRIBUTES}
												className={styles.timeInput}
												value={timeValue}
												onChange={handleTimeChange}
											/>
										</div>
									</div>
								</Dialog>
							</Popover>
						</DialogTrigger>
					</div>

					{description && <p className={styles.description}>{description}</p>}

					{error && <p className={styles.errorText}>{error}</p>}
				</div>
			</fieldset>
		</FocusRing>
	);
};
