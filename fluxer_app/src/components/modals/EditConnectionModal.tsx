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

import * as ConnectionActionCreators from '@app/actions/ConnectionActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {Switch} from '@app/components/form/Switch';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import type {ConnectionRecord} from '@app/records/ConnectionRecord';
import {ConnectionVisibilityFlags} from '@fluxer/constants/src/ConnectionConstants';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback, useState} from 'react';

interface Props {
	connection: ConnectionRecord;
}

export const EditConnectionModal = observer(({connection}: Props) => {
	const {t, i18n} = useLingui();
	const [visibilityFlags, setVisibilityFlags] = useState(connection.visibilityFlags);
	const [submitting, setSubmitting] = useState(false);

	const hasFlag = useCallback((flag: number) => (visibilityFlags & flag) === flag, [visibilityFlags]);

	const handleToggle = useCallback(
		(flag: number, value: boolean) => {
			setVisibilityFlags((prev) => {
				let next = prev;

				if (value) {
					next |= flag;

					if (flag === ConnectionVisibilityFlags.EVERYONE) {
						next |= ConnectionVisibilityFlags.FRIENDS;
						next |= ConnectionVisibilityFlags.MUTUAL_GUILDS;
					}
				} else {
					next &= ~flag;

					if (flag === ConnectionVisibilityFlags.FRIENDS || flag === ConnectionVisibilityFlags.MUTUAL_GUILDS) {
						next &= ~ConnectionVisibilityFlags.EVERYONE;
					}
				}

				return next;
			});
		},
		[setVisibilityFlags],
	);

	const handleSave = useCallback(async () => {
		setSubmitting(true);
		try {
			await ConnectionActionCreators.updateConnection(i18n, connection.type, connection.id, {
				visibility_flags: visibilityFlags,
			});
			ModalActionCreators.pop();
		} finally {
			setSubmitting(false);
		}
	}, [i18n, connection.type, connection.id, visibilityFlags]);

	return (
		<Modal.Root size="small" centered>
			<Modal.Header title={t`Edit Connection`} />
			<Modal.Content>
				<Modal.ContentLayout>
					<Modal.Description>
						<Trans>Choose who can see this connection on your profile.</Trans>
					</Modal.Description>
					<Switch
						label={<Trans>Everyone</Trans>}
						description={<Trans>Allow anyone to see this connection on your profile</Trans>}
						value={hasFlag(ConnectionVisibilityFlags.EVERYONE)}
						onChange={(value) => handleToggle(ConnectionVisibilityFlags.EVERYONE, value)}
					/>
					<Switch
						label={<Trans>Friends</Trans>}
						description={<Trans>Allow your friends to see this connection</Trans>}
						value={hasFlag(ConnectionVisibilityFlags.FRIENDS)}
						onChange={(value) => handleToggle(ConnectionVisibilityFlags.FRIENDS, value)}
					/>
					<Switch
						label={<Trans>Community Members</Trans>}
						description={<Trans>Allow members from communities you're in to see this connection</Trans>}
						value={hasFlag(ConnectionVisibilityFlags.MUTUAL_GUILDS)}
						onChange={(value) => handleToggle(ConnectionVisibilityFlags.MUTUAL_GUILDS, value)}
					/>
				</Modal.ContentLayout>
			</Modal.Content>
			<Modal.Footer>
				<Button onClick={ModalActionCreators.pop} variant="secondary">
					<Trans>Cancel</Trans>
				</Button>
				<Button onClick={handleSave} submitting={submitting}>
					<Trans>Save</Trans>
				</Button>
			</Modal.Footer>
		</Modal.Root>
	);
});
