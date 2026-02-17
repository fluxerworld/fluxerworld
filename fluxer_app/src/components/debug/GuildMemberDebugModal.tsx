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
import type {GuildMemberRecord} from '@app/records/GuildMemberRecord';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useMemo} from 'react';

interface GuildMemberDebugModalProps {
	title: string;
	member: GuildMemberRecord;
}

export const GuildMemberDebugModal: React.FC<GuildMemberDebugModalProps> = observer(({title, member}) => {
	const {t} = useLingui();
	const recordJsonData = useMemo(() => member.toJSON(), [member]);

	const tabs: Array<DebugTab> = [
		{
			id: 'record',
			label: t`Community Member Record`,
			data: recordJsonData,
		},
	];

	return <DebugModal title={title} tabs={tabs} />;
});
