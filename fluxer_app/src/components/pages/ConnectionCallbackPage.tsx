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

import styles from '@app/components/pages/ConnectionCallbackPage.module.css';
import {useLocation} from '@app/lib/router/React';
import {Trans} from '@lingui/react/macro';
import {CheckCircleIcon, XCircleIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';

const ConnectionCallbackPage = observer(() => {
	const location = useLocation();
	const queryParams = new URLSearchParams(location.search);
	const status = queryParams.get('status');

	const isSuccess = status === 'connected';
	const isError = status === 'error';

	return (
		<div className={styles.container}>
			{isSuccess && (
				<>
					<CheckCircleIcon className={styles.successIcon} weight="fill" />
					<div className={styles.content}>
						<h1 className={styles.title}>
							<Trans>Account Connected</Trans>
						</h1>
						<p className={styles.description}>
							<Trans>
								Your account has been linked successfully. You can now close this tab and return to the app.
							</Trans>
						</p>
					</div>
				</>
			)}

			{isError && (
				<>
					<XCircleIcon className={styles.errorIcon} weight="fill" />
					<div className={styles.content}>
						<h1 className={styles.title}>
							<Trans>Connection Failed</Trans>
						</h1>
						<p className={styles.description}>
							<Trans>Something went wrong while connecting your account. You can close this tab and try again.</Trans>
						</p>
					</div>
				</>
			)}

			{!isSuccess && !isError && (
				<div className={styles.content}>
					<h1 className={styles.title}>
						<Trans>Invalid Status</Trans>
					</h1>
					<p className={styles.description}>
						<Trans>An invalid status was provided. You can now close this tab and return to the app.</Trans>
					</p>
				</div>
			)}
		</div>
	);
});

export default ConnectionCallbackPage;
