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

import * as IARActionCreators from '@app/actions/IARActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {Message} from '@app/components/channel/Message';
import {Textarea} from '@app/components/form/Input';
import {Select, type SelectOption} from '@app/components/form/Select';
import styles from '@app/components/modals/IARModal.module.css';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import {
	getGuildViolationCategories,
	getMessageViolationCategories,
	getUserViolationCategories,
} from '@app/constants/IARConstants';
import {Logger} from '@app/lib/Logger';
import type {GuildRecord} from '@app/records/GuildRecord';
import type {MessageRecord} from '@app/records/MessageRecord';
import type {UserRecord} from '@app/records/UserRecord';
import ChannelStore from '@app/stores/ChannelStore';
import {MessagePreviewContext} from '@fluxer/constants/src/ChannelConstants';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useMemo, useState} from 'react';

interface ViolationSelectOption extends SelectOption<string> {
	desc: string;
}

const logger = new Logger('IARModal');

export type IARContext =
	| {
			type: 'message';
			message: MessageRecord;
	  }
	| {
			type: 'user';
			user: UserRecord;
			guildId?: string;
	  }
	| {
			type: 'guild';
			guild: GuildRecord;
	  };

interface IARModalProps {
	context: IARContext;
}

export const IARModal: React.FC<IARModalProps> = observer(({context}) => {
	const {t, i18n} = useLingui();
	const [selectedCategory, setSelectedCategory] = useState<string>('');
	const [additionalInfo, setAdditionalInfo] = useState('');
	const [submitting, setSubmitting] = useState(false);

	const categoryOptions = useMemo((): Array<ViolationSelectOption> => {
		let categories: Array<{value: string; name: string; desc: string}>;
		switch (context.type) {
			case 'message':
				categories = getMessageViolationCategories(i18n);
				break;
			case 'user':
				categories = getUserViolationCategories(i18n);
				break;
			case 'guild':
				categories = getGuildViolationCategories(i18n);
				break;
		}
		return categories.map((cat) => ({value: cat.value, label: cat.name, desc: cat.desc}));
	}, [context.type, i18n]);

	const renderOption = useCallback(
		(option: ViolationSelectOption, isSelected: boolean) => (
			<div className={styles.optionContent}>
				<div className={styles.optionName}>{option.label}</div>
				<div className={isSelected ? styles.optionDescSelected : styles.optionDesc}>{option.desc}</div>
			</div>
		),
		[],
	);

	const renderValue = useCallback((option: ViolationSelectOption | null) => {
		if (!option) return null;
		return (
			<div className={styles.valueContent}>
				<div className={styles.valueName}>{option.label}</div>
				<div className={styles.valueDesc}>{option.desc}</div>
			</div>
		);
	}, []);

	const title = useMemo(() => {
		switch (context.type) {
			case 'message':
				return t`Report Message`;
			case 'user':
				return t`Report User`;
			case 'guild':
				return t`Report Community`;
		}
	}, [context.type]);

	const handleCategoryChange = useCallback((value: string) => {
		setSelectedCategory(value);
	}, []);

	const handleAdditionalInfoChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setAdditionalInfo(e.target.value);
	}, []);

	const handleSubmit = useCallback(async () => {
		if (!selectedCategory) {
			ToastActionCreators.createToast({
				type: 'error',
				children: <Trans>Please select a violation category</Trans>,
			});
			return;
		}

		setSubmitting(true);
		try {
			switch (context.type) {
				case 'message':
					await IARActionCreators.reportMessage(
						context.message.channelId,
						context.message.id,
						selectedCategory,
						additionalInfo,
					);
					break;
				case 'user':
					await IARActionCreators.reportUser(context.user.id, selectedCategory, additionalInfo, context.guildId);
					break;
				case 'guild':
					await IARActionCreators.reportGuild(context.guild.id, selectedCategory, additionalInfo);
					break;
			}

			ToastActionCreators.createToast({
				type: 'success',
				children: <Trans>Report submitted successfully. Our Safety Team will review it shortly.</Trans>,
			});
			ModalActionCreators.pop();
		} catch (error) {
			logger.error('Failed to submit report:', error);
			ToastActionCreators.createToast({
				type: 'error',
				children: <Trans>Failed to submit report. Please try again.</Trans>,
			});
		} finally {
			setSubmitting(false);
		}
	}, [context, selectedCategory, additionalInfo]);

	const renderPreview = () => {
		if (context.type === 'message') {
			const channel = ChannelStore.getChannel(context.message.channelId);
			if (!channel) return null;

			return (
				<div className={styles.preview}>
					<Message
						channel={channel}
						message={context.message}
						previewContext={MessagePreviewContext.LIST_POPOUT}
						removeTopSpacing={true}
					/>
				</div>
			);
		}

		if (context.type === 'user') {
			return (
				<div className={styles.userPreview}>
					<div className={styles.userInfo}>
						<span className={styles.username}>{context.user.username}</span>
						<span className={styles.discriminator}>#{context.user.discriminator?.toString().padStart(4, '0')}</span>
					</div>
				</div>
			);
		}

		if (context.type === 'guild') {
			return (
				<div className={styles.guildPreview}>
					<span className={styles.guildName}>{context.guild.name}</span>
				</div>
			);
		}

		return null;
	};

	return (
		<Modal.Root size="small" centered>
			<Modal.Header title={title} />
			<Modal.Content>
				<Modal.ContentLayout>
					<p className={styles.description}>
						<Trans>
							Thank you for helping keep Fluxer safe. Reports are reviewed by our Safety Team. False reports may result
							in action against your account.
						</Trans>
					</p>
					{renderPreview()}
					<div className={styles.categorySection}>
						<Select<string, false, ViolationSelectOption>
							label={t`Why are you reporting this?`}
							value={selectedCategory}
							options={categoryOptions}
							onChange={handleCategoryChange}
							disabled={submitting}
							placeholder={t`Select a reason...`}
							renderOption={renderOption}
							renderValue={renderValue}
							isSearchable={false}
							className={styles.categorySelect}
						/>
					</div>
					<Textarea
						label={t`Additional information (optional)`}
						value={additionalInfo}
						onChange={handleAdditionalInfoChange}
						placeholder={t`Provide any additional context that may help our Safety Team...`}
						minRows={3}
						maxRows={8}
						maxLength={1000}
						showCharacterCount={true}
						disabled={submitting}
					/>
				</Modal.ContentLayout>
			</Modal.Content>
			<Modal.Footer>
				<Button variant="secondary" onClick={() => ModalActionCreators.pop()} disabled={submitting}>
					<Trans>Cancel</Trans>
				</Button>
				<Button variant="danger-primary" onClick={handleSubmit} disabled={!selectedCategory || submitting}>
					<Trans>Submit Report</Trans>
				</Button>
			</Modal.Footer>
		</Modal.Root>
	);
});
