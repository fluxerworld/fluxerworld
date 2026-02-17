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

import {DateTimePickerField} from '@app/components/form/DateTimePickerField';
import {Switch} from '@app/components/form/Switch';
import styles from '@app/components/modals/guild_tabs/guild_overview_tab/GuildOverviewTab.module.css';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import {Trans, useLingui} from '@lingui/react/macro';
import {AnimatePresence, motion} from 'framer-motion';
import type React from 'react';
import {useCallback, useMemo, useState} from 'react';
import type {ControllerRenderProps, FieldValues, Path, UseFormReturn} from 'react-hook-form';
import {Controller} from 'react-hook-form';

export interface MessageHistoryThresholdFormValues {
	message_history_cutoff: string | null;
}

export const MessageHistoryThresholdDescription: React.FC = () => (
	<div className={styles.messageHistoryDescription}>
		<p>
			<Trans>
				When a custom threshold date is not set, members without the <strong>Read Message History</strong> permission
				cannot view any historical messages. They'll only see messages in real time as they arrive, and they'll
				disappear when they restart their clients.
			</Trans>
		</p>
		<p>
			<Trans>
				If you'd like these members to access historical messages after a specific date, enable this feature and choose
				a threshold below.
			</Trans>
		</p>
		<ul className={styles.messageHistoryList}>
			<li>
				<Trans>
					You can remove the <strong>Read Message History</strong> permission from the <strong>@everyone</strong> role
					in the <strong>Roles & Permissions</strong> tab and grant it to one or more trusted roles instead.
				</Trans>
			</li>
			<li>
				<Trans>
					Community owners and users with the <strong>Administrator</strong> permission always have all permissions,
					including <strong>Read Message History</strong>, so they aren't affected by this setting.
				</Trans>
			</li>
			<li>
				<Trans>
					You can also create per-category or per-channel permission overrides to grant <strong>@everyone</strong> full
					access to rules or announcement channels, for example.
				</Trans>
			</li>
		</ul>
	</div>
);

export const MessageHistoryThresholdAccordion: React.FC = () => {
	const {t} = useLingui();
	const [isOpen, setIsOpen] = useState(false);
	const toggle = useCallback(() => setIsOpen((current) => !current), []);

	return (
		<div className={styles.messageHistoryAccordion}>
			<button type="button" className={styles.messageHistoryAccordionToggle} onClick={toggle} aria-expanded={isOpen}>
				<span className={styles.messageHistoryAccordionTitle}>{t`How this works`}</span>
				<motion.span
					className={styles.messageHistoryAccordionChevron}
					aria-hidden
					animate={{rotate: isOpen ? 45 : -45}}
					transition={{duration: AccessibilityStore.useReducedMotion ? 0 : 0.2, ease: 'easeOut'}}
				/>
			</button>
			<AnimatePresence initial={false}>
				{isOpen && (
					<motion.div
						className={styles.messageHistoryAccordionContent}
						initial={AccessibilityStore.useReducedMotion ? {height: 'auto', opacity: 1} : {height: 0, opacity: 0}}
						animate={{height: 'auto', opacity: 1}}
						exit={AccessibilityStore.useReducedMotion ? {height: 'auto', opacity: 1} : {height: 0, opacity: 0}}
						transition={{duration: AccessibilityStore.useReducedMotion ? 0 : 0.25, ease: 'easeOut'}}
					>
						<MessageHistoryThresholdDescription />
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};

export function buildMessageHistoryThresholdValidator(
	t: (descriptor: TemplateStringsArray) => string,
	guildCreatedAt: Date,
): (value: string | null) => true | string {
	return (value) => {
		if (value === null) {
			return true;
		}
		const cutoffTimestamp = new Date(value).getTime();
		if (cutoffTimestamp < guildCreatedAt.getTime()) {
			return t`Threshold date cannot be before community creation`;
		}
		if (cutoffTimestamp > Date.now()) {
			return t`Threshold date cannot be in the future`;
		}
		return true;
	};
}

interface MessageHistoryThresholdFieldProps<T extends FieldValues> {
	form: UseFormReturn<T>;
	name: Path<T>;
	canManageGuild: boolean;
	guildCreatedAt: Date;
	maxDate: Date;
}

export function MessageHistoryThresholdField<T extends FieldValues>({
	form,
	name,
	canManageGuild,
	guildCreatedAt,
	maxDate,
}: MessageHistoryThresholdFieldProps<T>) {
	const {t} = useLingui();

	return (
		<Controller
			name={name}
			control={form.control}
			rules={{
				validate: buildMessageHistoryThresholdValidator(t, guildCreatedAt),
			}}
			render={({field, fieldState}) => (
				<MessageHistoryThresholdPicker
					field={field}
					error={fieldState.error?.message}
					canManageGuild={canManageGuild}
					guildCreatedAt={guildCreatedAt}
					maxDate={maxDate}
				/>
			)}
		/>
	);
}

interface MessageHistoryThresholdPickerProps<T extends FieldValues> {
	field: ControllerRenderProps<T, Path<T>>;
	error?: string;
	canManageGuild: boolean;
	guildCreatedAt: Date;
	maxDate: Date;
}

function MessageHistoryThresholdPicker<T extends FieldValues>({
	field,
	error,
	canManageGuild,
	guildCreatedAt,
	maxDate,
}: MessageHistoryThresholdPickerProps<T>) {
	const {t} = useLingui();
	const isEnabled = field.value != null;

	const handleToggle = useCallback(
		(enabled: boolean) => {
			if (enabled) {
				field.onChange(guildCreatedAt.toISOString());
			} else {
				field.onChange(null);
			}
		},
		[field, guildCreatedAt],
	);

	const handleDateChange = useCallback(
		(date: Date | null) => {
			if (date) {
				field.onChange(date.toISOString());
			}
		},
		[field],
	);

	const dateValue = useMemo(() => (typeof field.value === 'string' ? new Date(field.value) : null), [field.value]);

	return (
		<div>
			<Switch
				label={t`Enable message history threshold`}
				description={t`Allow members without Read Message History to see messages after a specific date.`}
				value={isEnabled}
				onChange={handleToggle}
				disabled={!canManageGuild}
			/>

			{isEnabled && (
				<DateTimePickerField
					className={styles.dateTimePickerField}
					label={t`Threshold Date`}
					description={t`Members without Read Message History can view messages sent after this date.`}
					value={dateValue}
					onChange={handleDateChange}
					minDate={guildCreatedAt}
					maxDate={maxDate}
					disabled={!canManageGuild}
					error={error}
				/>
			)}
		</div>
	);
}
