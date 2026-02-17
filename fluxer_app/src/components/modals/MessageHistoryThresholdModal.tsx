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
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {Form} from '@app/components/form/Form';
import {
	MessageHistoryThresholdAccordion,
	MessageHistoryThresholdField,
	type MessageHistoryThresholdFormValues,
} from '@app/components/modals/guild_tabs/guild_overview_tab/sections/MessageHistoryThresholdContent';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import {useFormSubmit} from '@app/hooks/useFormSubmit';
import GuildStore from '@app/stores/GuildStore';
import PermissionStore from '@app/stores/PermissionStore';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {extractTimestamp} from '@fluxer/snowflake/src/SnowflakeUtils';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useEffect, useMemo} from 'react';
import {useForm} from 'react-hook-form';

interface MessageHistoryThresholdModalProps {
	guildId: string;
}

export const MessageHistoryThresholdModal: React.FC<MessageHistoryThresholdModalProps> = observer(({guildId}) => {
	const {t} = useLingui();
	const guild = GuildStore.getGuild(guildId);
	const canManageGuild = PermissionStore.can(Permissions.MANAGE_GUILD, {guildId});

	const form = useForm<MessageHistoryThresholdFormValues>({
		defaultValues: {message_history_cutoff: guild?.messageHistoryCutoff ?? null},
	});

	const {handleSubmit, isSubmitting} = useFormSubmit({
		form,
		onSubmit: async (data) => {
			if (!guild) return;
			await GuildActionCreators.update(guild.id, {message_history_cutoff: data.message_history_cutoff});
			form.reset(data);
			ToastActionCreators.createToast({type: 'success', children: t`Message history threshold updated`});
			ModalActionCreators.pop();
		},
		defaultErrorField: 'message_history_cutoff',
	});

	useEffect(() => {
		if (!guild) return;
		if (form.formState.isDirty) return;
		form.reset({message_history_cutoff: guild.messageHistoryCutoff ?? null});
	}, [form, guild]);

	const guildCreatedAt = useMemo(() => {
		const timestamp = extractTimestamp(guildId);
		return new Date(timestamp);
	}, [guildId]);

	const maxDate = useMemo(() => new Date(), []);

	if (!guild) return null;

	return (
		<Modal.Root size="medium" centered onClose={ModalActionCreators.pop}>
			<Modal.Header title={t`Message History Threshold`} />
			<Modal.Content>
				<Modal.ContentLayout>
					<Modal.Description>
						<MessageHistoryThresholdAccordion />
					</Modal.Description>
					<Form form={form} onSubmit={handleSubmit}>
						<MessageHistoryThresholdField
							form={form}
							name="message_history_cutoff"
							canManageGuild={canManageGuild}
							guildCreatedAt={guildCreatedAt}
							maxDate={maxDate}
						/>
					</Form>
				</Modal.ContentLayout>
			</Modal.Content>
			<Modal.Footer>
				<Button variant="secondary" onClick={ModalActionCreators.pop} disabled={isSubmitting}>
					<Trans>Cancel</Trans>
				</Button>
				<Button onClick={handleSubmit} disabled={!canManageGuild} submitting={isSubmitting}>
					<Trans>Save</Trans>
				</Button>
			</Modal.Footer>
		</Modal.Root>
	);
});
