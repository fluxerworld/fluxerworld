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

import * as AuthenticationActionCreators from '@app/actions/AuthenticationActionCreators';
import {VerificationResult} from '@app/actions/AuthenticationActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {Button} from '@app/components/uikit/button/Button';
import {WarningAlert} from '@app/components/uikit/warning_alert/WarningAlert';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useState} from 'react';

export const EmailVerificationAlert = observer(() => {
	const {t} = useLingui();
	const [isResending, setIsResending] = useState(false);

	const handleResend = async () => {
		if (isResending) return;
		setIsResending(true);
		const result = await AuthenticationActionCreators.resendVerificationEmail();

		switch (result) {
			case VerificationResult.SUCCESS:
				ToastActionCreators.success(t`Verification email sent! Please check your inbox.`);
				break;
			case VerificationResult.RATE_LIMITED:
				ToastActionCreators.error(t`Too many requests. Please try again later.`);
				break;
			case VerificationResult.SERVER_ERROR:
				ToastActionCreators.error(t`Failed to send verification email. Please try again later.`);
				break;
		}

		setIsResending(false);
	};

	return (
		<WarningAlert
			title={<Trans>Email Verification Required</Trans>}
			actions={
				<Button variant="primary" small disabled={isResending} submitting={isResending} onClick={handleResend}>
					<Trans>Resend Email</Trans>
				</Button>
			}
		>
			<Trans>Please check your inbox for a verification email.</Trans>
		</WarningAlert>
	);
});
