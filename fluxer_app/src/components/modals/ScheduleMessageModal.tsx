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

import {Input} from '@app/components/form/Input';
import {Select, type SelectOption} from '@app/components/form/Select';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import {MS_PER_DAY} from '@fluxer/date_utils/src/DateConstants';
import {getSystemTimeZone} from '@fluxer/date_utils/src/DateIntrospection';
import {useLingui} from '@lingui/react/macro';
import type React from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';

interface ScheduleMessageModalProps {
	onClose: () => void;
	onSubmit: (scheduledLocalAt: string, timezone: string) => Promise<void>;
	initialScheduledLocalAt?: string;
	initialTimezone?: string;
	title?: string;
	submitLabel?: string;
	helpText?: React.ReactNode;
}

const formatInputValue = (value: Date): string => value.toISOString().slice(0, 16);

export const ScheduleMessageModal = ({
	onClose,
	onSubmit,
	initialScheduledLocalAt,
	initialTimezone,
	title,
	submitLabel,
	helpText,
}: ScheduleMessageModalProps) => {
	const {t} = useLingui();
	const minDateTime = useMemo(() => formatInputValue(new Date(Date.now() + 60_000)), []);
	const maxDateTime = useMemo(() => formatInputValue(new Date(Date.now() + 30 * MS_PER_DAY)), []);
	const defaultTimezone = useMemo(() => getSystemTimeZone(), []);
	const timezoneOptions = useMemo((): Array<SelectOption<string>> => {
		const intl = Intl as typeof Intl & {supportedValuesOf?: (type: string) => Array<string>};
		const zones = typeof intl.supportedValuesOf === 'function' ? intl.supportedValuesOf('timeZone') : [defaultTimezone];
		return zones.map((zone) => ({value: zone, label: zone}));
	}, [defaultTimezone]);

	const initialScheduledAt = useMemo(
		() => initialScheduledLocalAt ?? formatInputValue(new Date(Date.now() + 5 * 60 * 1000)),
		[initialScheduledLocalAt],
	);
	const [scheduledLocalAt, setScheduledLocalAt] = useState(initialScheduledAt);
	const [timezone, setTimezone] = useState(initialTimezone ?? defaultTimezone);
	useEffect(() => {
		setScheduledLocalAt(initialScheduledLocalAt ?? formatInputValue(new Date(Date.now() + 5 * 60 * 1000)));
	}, [initialScheduledLocalAt]);
	useEffect(() => {
		if (initialTimezone) {
			setTimezone(initialTimezone);
		}
	}, [initialTimezone]);
	const [submitting, setSubmitting] = useState(false);

	const handleConfirm = useCallback(async () => {
		if (!scheduledLocalAt) {
			return;
		}
		setSubmitting(true);
		try {
			await onSubmit(scheduledLocalAt, timezone);
			onClose();
		} finally {
			setSubmitting(false);
		}
	}, [scheduledLocalAt, timezone, onSubmit, onClose]);

	return (
		<Modal.Root size="small" centered onClose={onClose}>
			<Modal.Header title={title ?? t`Schedule Message`} />
			<Modal.Content>
				<Modal.ContentLayout>
					<Modal.Description>{helpText ?? t`Pick a time when this message should be posted.`}</Modal.Description>

					<Modal.InputGroup>
						<Input
							id="schedule-message-time"
							type="datetime-local"
							label={t`Date & Time`}
							min={minDateTime}
							max={maxDateTime}
							value={scheduledLocalAt}
							onChange={(event) => setScheduledLocalAt(event.target.value)}
						/>

						<Select
							id="schedule-message-timezone"
							label={t`Timezone`}
							description={t`Scheduled messages can be at most 30 days in the future.`}
							value={timezone}
							options={timezoneOptions}
							onChange={setTimezone}
						/>
					</Modal.InputGroup>
				</Modal.ContentLayout>
			</Modal.Content>
			<Modal.Footer>
				<Button variant="secondary" onClick={onClose}>
					{t`Cancel`}
				</Button>
				<Button variant="primary" onClick={handleConfirm} submitting={submitting} disabled={!scheduledLocalAt}>
					{submitLabel ?? t`Schedule`}
				</Button>
			</Modal.Footer>
		</Modal.Root>
	);
};
