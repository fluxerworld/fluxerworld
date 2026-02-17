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

import * as GuildActionCreators from '@app/actions/GuildActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {Form} from '@app/components/form/Form';
import {Input} from '@app/components/form/Input';
import styles from '@app/components/modals/guild_tabs/GuildVanityURLTab.module.css';
import {Button} from '@app/components/uikit/button/Button';
import {Spinner} from '@app/components/uikit/Spinner';
import {useFormSubmit} from '@app/hooks/useFormSubmit';
import {Logger} from '@app/lib/Logger';
import ChannelStore from '@app/stores/ChannelStore';
import DeveloperOptionsStore from '@app/stores/DeveloperOptionsStore';
import GuildStore from '@app/stores/GuildStore';
import RuntimeConfigStore from '@app/stores/RuntimeConfigStore';
import * as PermissionUtils from '@app/utils/PermissionUtils';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {Trans, useLingui} from '@lingui/react/macro';
import {WarningIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {useForm} from 'react-hook-form';

const logger = new Logger('GuildVanityURLTab');

interface FormInputs {
	code: string;
}

function hasAnyChannelViewableToEveryone(guildId: string): boolean {
	const guild = GuildStore.getGuild(guildId);
	if (!guild) return false;

	const channels = ChannelStore.getGuildChannels(guildId);

	for (const channel of channels) {
		if (channel.isGuildCategory()) continue;

		const permissions = PermissionUtils.computePermissions(guildId, channel.toJSON(), null, null, false);

		if ((permissions & Permissions.VIEW_CHANNEL) === Permissions.VIEW_CHANNEL) {
			return true;
		}
	}

	return false;
}

const GuildVanityURLTab: React.FC<{guildId: string}> = observer(({guildId}) => {
	const {t} = useLingui();
	const [vanityCode, setVanityCode] = useState<string>('');
	const [uses, setUses] = useState<number>(0);
	const [isLoading, setIsLoading] = useState(true);
	const form = useForm<FormInputs>({defaultValues: {code: ''}});

	const channels = ChannelStore.getGuildChannels(guildId);
	const guild = GuildStore.getGuild(guildId);
	const forceShowDisclaimer = DeveloperOptionsStore.forceShowVanityURLDisclaimer;
	const hasViewableChannel = useMemo(() => {
		return hasAnyChannelViewableToEveryone(guildId);
	}, [guildId, channels, guild]);

	const fetchVanityURL = useCallback(async () => {
		try {
			setIsLoading(true);
			const data = await GuildActionCreators.getVanityURL(guildId);
			setVanityCode(data.code || '');
			form.reset({code: data.code || ''});
			setUses(data.uses);
		} catch (err) {
			logger.error('Failed to fetch vanity URL', err);
			form.setError('code', {
				type: 'server',
				message: t`Failed to load vanity URL. Please try again.`,
			});
		} finally {
			setIsLoading(false);
		}
	}, [guildId, form]);

	useEffect(() => {
		void fetchVanityURL();
	}, [fetchVanityURL]);

	const onSubmit = async (data: FormInputs) => {
		const trimmedValue = data.code.trim();

		if (trimmedValue && !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(trimmedValue)) {
			form.setError('code', {
				message: t`Vanity URL can only contain alphanumeric characters and internal hyphens.`,
			});
			return;
		}

		await GuildActionCreators.updateVanityURL(guildId, trimmedValue || null);
		setVanityCode(trimmedValue);
		ToastActionCreators.createToast({
			type: 'success',
			children: trimmedValue ? (
				<Trans>
					Your vanity URL has been set to {RuntimeConfigStore.inviteEndpoint}/{trimmedValue}
				</Trans>
			) : (
				<Trans>Your vanity URL has been removed.</Trans>
			),
		});
		await fetchVanityURL();
	};

	const {handleSubmit, isSubmitting} = useFormSubmit({
		form,
		onSubmit,
		defaultErrorField: 'code',
	});

	if (isLoading) {
		return (
			<div className={styles.spinnerContainer}>
				<Spinner />
			</div>
		);
	}

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<h2 className={styles.title}>
					<Trans>Custom Invite URL</Trans>
				</h2>
				<p className={styles.subtitle}>
					<Trans>Set a custom invite URL for your community.</Trans>
				</p>
			</div>

			{(!hasViewableChannel || forceShowDisclaimer) && (
				<div className={styles.warning}>
					<div className={styles.warningContent}>
						<div className={styles.warningIcon}>
							<WarningIcon size={20} weight="fill" />
						</div>
						<div className={styles.warningBody}>
							<p className={styles.warningTitle}>
								<Trans>Vanity URL won't work</Trans>
							</p>
							<p className={styles.warningText}>
								<Trans>
									At least one channel must have "View Channel" permission enabled for @everyone in order for the vanity
									URL to work. Currently, no channels are viewable to @everyone.
								</Trans>
							</p>
						</div>
					</div>
				</div>
			)}

			<Form form={form} onSubmit={handleSubmit}>
				<div className={styles.formCard}>
					<div>
						<div className={styles.fieldLabel}>
							<Trans>Vanity URL</Trans>
						</div>
						<div className={styles.inputRow}>
							<span className={styles.inputPrefix}>{RuntimeConfigStore.inviteEndpoint}/</span>
							<div className={styles.inputWrapper}>
								<Input
									{...form.register('code', {
										minLength: {
											value: 2,
											message: t`Vanity URL must be at least 2 characters long.`,
										},
										maxLength: {
											value: 32,
											message: t`Vanity URL must be no more than 32 characters long.`,
										},
									})}
									error={form.formState.errors.code?.message}
									label=""
									placeholder={t`your-custom-url`}
									minLength={2}
									maxLength={32}
								/>
							</div>
						</div>
						<p className={styles.helpText}>
							<Trans>
								Vanity URLs must be between 2 and 32 characters long and can only contain alphanumeric characters and
								internal hyphens.
							</Trans>
						</p>
					</div>

					{vanityCode && (
						<div>
							<p className={styles.usage}>
								<Trans>Current uses:</Trans> <span className={styles.usageValue}>{uses}</span>
							</p>
						</div>
					)}

					<div className={styles.actions}>
						<Button type="submit" submitting={isSubmitting}>
							<Trans>Save</Trans>
						</Button>
					</div>
				</div>
			</Form>
		</div>
	);
});

export default GuildVanityURLTab;
