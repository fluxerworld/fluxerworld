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

import {AddFriendForm} from '@app/components/channel/direct_message/AddFriendForm';
import styles from '@app/components/channel/direct_message/AddFriendView.module.css';
import {Trans} from '@lingui/react/macro';
import {UserCirclePlusIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';

export const AddFriendView = observer(() => {
	return (
		<div className={styles.addFriendContainer}>
			<div className={styles.card}>
				<UserCirclePlusIcon weight="fill" className={styles.heroIcon} />
				<h2 className={styles.title}>
					<Trans>Add Friend</Trans>
				</h2>
				<p className={styles.subtitle}>
					<Trans>You can add friends with their FluxerTag.</Trans>
				</p>
				<div className={styles.formContainer}>
					<AddFriendForm />
				</div>
			</div>
		</div>
	);
});
