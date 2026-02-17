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

import {StatusSlate} from '@app/components/modals/shared/StatusSlate';
import {Trans} from '@lingui/react/macro';
import {CheckCircleIcon} from '@phosphor-icons/react';
import type React from 'react';

const FilledCheckCircleIcon: React.FC<React.ComponentProps<typeof CheckCircleIcon>> = (props) => (
	<CheckCircleIcon weight="fill" {...props} />
);

interface Props {
	onStartOver: () => void;
}

export const ReportStepComplete: React.FC<Props> = ({onStartOver}) => (
	<StatusSlate
		Icon={FilledCheckCircleIcon}
		title={<Trans>Report Submitted</Trans>}
		description={<Trans>Thank you for helping keep Fluxer safe. We'll review your report as soon as possible.</Trans>}
		iconStyle={{color: 'var(--status-success)'}}
		actions={[
			{
				text: <Trans>Submit another report</Trans>,
				onClick: onStartOver,
				variant: 'secondary',
			},
		]}
	/>
);
