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

import {DebugModal, type DebugTab} from '@app/components/debug/DebugModal';
import http from '@app/lib/HttpClient';
import type {UserRecord} from '@app/records/UserRecord';
import UserStore from '@app/stores/UserStore';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useEffect, useMemo, useState} from 'react';

interface UserDebugModalProps {
	title: string;
	user: UserRecord;
}

export const UserDebugModal: React.FC<UserDebugModalProps> = observer(({title, user}) => {
	const {t} = useLingui();
	const [staffEmail, setStaffEmail] = useState<string | null>(null);
	const isStaff = UserStore.currentUser?.isStaff?.() ?? false;

	useEffect(() => {
		if (!isStaff) return;
		http.get<{email: string | null}>(`/users/${user.id}/staff-info`)
			.then((res) => setStaffEmail(res.body.email))
			.catch(() => {});
	}, [isStaff, user.id]);

	const recordJsonData = useMemo(() => {
		const json = user.toJSON();
		if (isStaff && staffEmail !== null) {
			return {...json, email: staffEmail};
		}
		return json;
	}, [user, isStaff, staffEmail]);

	const tabs: Array<DebugTab> = [
		{
			id: 'record',
			label: t`User Record`,
			data: recordJsonData,
		},
	];

	return <DebugModal title={title} tabs={tabs} />;
});
