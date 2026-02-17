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

import * as RelationshipActionCreators from '@app/actions/RelationshipActionCreators';
import styles from '@app/components/channel/direct_message/AddFriendForm.module.css';
import {Input} from '@app/components/form/Input';
import {openClaimAccountModal} from '@app/components/modals/ClaimAccountModal';
import {StatusSlate} from '@app/components/modals/shared/StatusSlate';
import {Button} from '@app/components/uikit/button/Button';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import UserStore from '@app/stores/UserStore';
import {getApiErrorCode} from '@app/utils/ApiErrorUtils';
import {getSendFriendRequestErrorMessage} from '@app/utils/RelationshipActionUtils';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {Trans, useLingui} from '@lingui/react/macro';
import {WarningCircleIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useState} from 'react';

interface AddFriendFormProps {
	onSuccess?: () => void;
}

export const AddFriendForm: React.FC<AddFriendFormProps> = observer(({onSuccess}) => {
	const {i18n, t} = useLingui();

	const [input, setInput] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [resultStatus, setResultStatus] = useState<'success' | 'error' | null>(null);
	const [errorCode, setErrorCode] = useState<string | null>(null);

	const isClaimed = UserStore.currentUser?.isClaimed() ?? true;
	if (!isClaimed) {
		return (
			<StatusSlate
				Icon={WarningCircleIcon}
				title={<Trans>Claim Your Account</Trans>}
				description={<Trans>Claim your account to send friend requests.</Trans>}
				actions={[
					{
						text: <Trans>Claim Account</Trans>,
						onClick: () => openClaimAccountModal({force: true}),
						variant: 'primary',
					},
				]}
			/>
		);
	}

	const parseInput = (input: string): [string, string] => {
		const parts = input['split']('#');
		if (parts.length > 1) {
			return [parts[0], parts.slice(1).join('#')];
		}
		return [input, '0000'];
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setInput(e.target.value);
		if (resultStatus) {
			setResultStatus(null);
			setErrorCode(null);
		}
	};

	const getErrorMessage = () => {
		if (!errorCode) {
			return getSendFriendRequestErrorMessage(i18n, null, null);
		}

		if (errorCode === APIErrorCodes.NO_USERS_WITH_FLUXERTAG_EXIST) {
			return t`No user found with that FluxerTag.`;
		}
		if (errorCode === APIErrorCodes.DISCRIMINATOR_REQUIRED) {
			return t`Please enter a valid FluxerTag (Username#0000).`;
		}

		return getSendFriendRequestErrorMessage(i18n, errorCode, null);
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		const [username, discriminator] = parseInput(input);

		if (!username || !discriminator || !/^\d{4}$/.test(discriminator)) {
			setResultStatus('error');
			setErrorCode(APIErrorCodes.NO_USERS_WITH_FLUXERTAG_EXIST);
			return;
		}

		setIsLoading(true);

		RelationshipActionCreators.sendFriendRequestByTag(username, discriminator)
			.then(() => {
				setIsLoading(false);
				setResultStatus('success');
				setInput('');
				onSuccess?.();
			})
			.catch((error: unknown) => {
				setIsLoading(false);
				setResultStatus('error');
				setErrorCode(getApiErrorCode(error) ?? null);
			});
	};

	const isDisabled = isLoading || !input['trim']();
	const isMobile = MobileLayoutStore.isMobileLayout();

	const submitButton = (
		<Button
			type="submit"
			disabled={isDisabled}
			submitting={isLoading}
			className={isMobile ? styles.button : styles.inlineButton}
			fitContainer={false}
			compact={!isMobile}
		>
			{t`Send Request`}
		</Button>
	);

	return (
		<form onSubmit={handleSubmit} className={styles.form}>
			<div className={clsx(styles.container, !isMobile && styles.containerDesktop)}>
				<Input
					type="text"
					value={input}
					onChange={handleInputChange}
					placeholder={t`Username#0000`}
					className={clsx(
						styles.input,
						!isMobile && styles.inputDesktop,
						resultStatus === 'error' && styles.inputError,
					)}
					disabled={isLoading}
					aria-label={t`Friend's FluxerTag`}
					rightElement={!isMobile ? submitButton : undefined}
				/>
				{isMobile && submitButton}
			</div>

			{resultStatus === 'error' && <p className={styles.errorMessage}>{getErrorMessage()}</p>}
			{resultStatus === 'success' && <p className={styles.successMessage}>{t`Friend request sent!`}</p>}
		</form>
	);
});
