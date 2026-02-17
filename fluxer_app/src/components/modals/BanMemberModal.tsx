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
import {Input} from '@app/components/form/Input';
import {Select as FormSelect} from '@app/components/form/Select';
import styles from '@app/components/modals/BanMemberModal.module.css';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import {RadioGroup} from '@app/components/uikit/radio_group/RadioGroup';
import {Logger} from '@app/lib/Logger';
import type {UserRecord} from '@app/records/UserRecord';
import bannedMp4 from '@app/videos/banned.mp4';
import bannedPng from '@app/videos/banned.png';
import bannedWebm from '@app/videos/banned.webm';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useState} from 'react';

const logger = new Logger('BanMemberModal');

interface SelectOption {
	value: number;
	label: string;
}

export const BanMemberModal: React.FC<{guildId: string; targetUser: UserRecord}> = observer(({guildId, targetUser}) => {
	const {t} = useLingui();
	const [reason, setReason] = useState('');
	const [deleteMessageDays, setDeleteMessageDays] = useState<number>(1);
	const [banDuration, setBanDuration] = useState<number>(0);
	const [isBanning, setIsBanning] = useState(false);

	const getBanDurationOptions = useCallback(
		(): ReadonlyArray<SelectOption> => [
			{value: 0, label: t`Permanent`},
			{value: 60 * 60, label: t`1 hour`},
			{value: 60 * 60 * 12, label: t`12 hours`},
			{value: 60 * 60 * 24, label: t`1 day`},
			{value: 60 * 60 * 24 * 3, label: t`3 days`},
			{value: 60 * 60 * 24 * 5, label: t`5 days`},
			{value: 60 * 60 * 24 * 7, label: t`1 week`},
			{value: 60 * 60 * 24 * 14, label: t`2 weeks`},
			{value: 60 * 60 * 24 * 30, label: t`1 month`},
		],
		[t],
	);

	const BAN_DURATION_OPTIONS = getBanDurationOptions();

	const handleBan = async () => {
		setIsBanning(true);
		try {
			await GuildActionCreators.banMember(guildId, targetUser.id, deleteMessageDays, reason || undefined, banDuration);
			ToastActionCreators.createToast({
				type: 'success',
				children: <Trans>Successfully banned {targetUser.tag} from the community</Trans>,
			});
			ModalActionCreators.pop();
		} catch (error) {
			logger.error('Failed to ban member:', error);
			ToastActionCreators.createToast({
				type: 'error',
				children: <Trans>Failed to ban member. Please try again.</Trans>,
			});
		} finally {
			setIsBanning(false);
		}
	};

	return (
		<Modal.Root size="small" centered>
			<Modal.Header title={t`Ban ${targetUser.tag}`} />
			<Modal.Content>
				<div className={styles.content}>
					{/* biome-ignore lint/a11y/useMediaCaption: this is fine s*/}
					<video autoPlay loop className={styles.video}>
						<source src={bannedWebm} type="video/webm" />
						<source src={bannedMp4} type="video/mp4" />
						<img src={bannedPng} alt={t`Banned`} />
					</video>

					<div>
						<FormSelect<number>
							label={t`Ban Duration`}
							description={t`How long this user should be banned for.`}
							value={banDuration}
							onChange={(v) => setBanDuration(v)}
							options={BAN_DURATION_OPTIONS}
							disabled={isBanning}
						/>
					</div>

					<div>
						<div className={styles.sectionTitle}>
							<Trans>Delete Message History</Trans>
						</div>
						<RadioGroup
							aria-label={t`Delete Message History`}
							options={[
								{value: 0, name: t`Don't Delete Any`, desc: t`Keep all messages`},
								{value: 1, name: t`Previous 24 Hours`, desc: t`Delete messages from the last day`},
								{value: 7, name: t`Previous 7 Days`, desc: t`Delete messages from the last week`},
							]}
							value={deleteMessageDays}
							onChange={setDeleteMessageDays}
							disabled={isBanning}
						/>
					</div>

					<Input
						type="text"
						label={t`Reason (Optional)`}
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						placeholder={t`Enter a reason for the ban...`}
						maxLength={512}
						disabled={isBanning}
					/>
				</div>
			</Modal.Content>
			<Modal.Footer>
				<Button variant="secondary" onClick={() => ModalActionCreators.pop()} disabled={isBanning}>
					<Trans>Cancel</Trans>
				</Button>
				<Button variant="danger-primary" onClick={handleBan} disabled={isBanning}>
					<Trans>Ban Member</Trans>
				</Button>
			</Modal.Footer>
		</Modal.Root>
	);
});
