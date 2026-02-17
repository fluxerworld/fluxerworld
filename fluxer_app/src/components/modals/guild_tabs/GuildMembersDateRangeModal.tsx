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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {DateTimePickerField} from '@app/components/form/DateTimePickerField';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import {Trans, useLingui} from '@lingui/react/macro';
import {useCallback, useState} from 'react';

interface GuildMembersDateRangeModalProps {
	onApply: (gte: number | undefined, lte: number | undefined) => void;
	initialGte?: number;
	initialLte?: number;
}

export function GuildMembersDateRangeModal({onApply, initialGte, initialLte}: GuildMembersDateRangeModalProps) {
	const {t} = useLingui();

	const [afterDate, setAfterDate] = useState<Date | null>(initialGte != null ? new Date(initialGte * 1000) : null);
	const [beforeDate, setBeforeDate] = useState<Date | null>(initialLte != null ? new Date(initialLte * 1000) : null);

	const handleClear = useCallback(() => {
		onApply(undefined, undefined);
		ModalActionCreators.pop();
	}, [onApply]);

	const handleApply = useCallback(() => {
		const gte = afterDate ? Math.floor(afterDate.getTime() / 1000) : undefined;
		const lte = beforeDate ? Math.floor(beforeDate.getTime() / 1000) : undefined;
		onApply(gte, lte);
		ModalActionCreators.pop();
	}, [afterDate, beforeDate, onApply]);

	return (
		<Modal.Root size="small">
			<Modal.Header title={t`Custom Date Range`} />
			<Modal.Content>
				<Modal.ContentLayout>
					<DateTimePickerField
						label={t`After Date`}
						value={afterDate}
						onChange={setAfterDate}
						maxDate={beforeDate ?? undefined}
					/>
					<DateTimePickerField
						label={t`Before Date`}
						value={beforeDate}
						onChange={setBeforeDate}
						minDate={afterDate ?? undefined}
					/>
				</Modal.ContentLayout>
			</Modal.Content>
			<Modal.FormFooter>
				<Button variant="secondary" onClick={handleClear}>
					<Trans>Clear</Trans>
				</Button>
				<Button variant="primary" onClick={handleApply}>
					<Trans>Apply</Trans>
				</Button>
			</Modal.FormFooter>
		</Modal.Root>
	);
}
