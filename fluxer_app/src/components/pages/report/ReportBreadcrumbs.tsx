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

import styles from '@app/components/pages/ReportPage.module.css';
import type {FlowStep} from '@app/components/pages/report/ReportTypes';
import {Trans} from '@lingui/react/macro';
import clsx from 'clsx';
import React from 'react';

interface Props {
	current: FlowStep;
	hasSelection: boolean;
	hasEmail: boolean;
	hasTicket: boolean;
	onSelect: (step: FlowStep) => void;
}

const STEP_ORDER: Array<FlowStep> = ['selection', 'email', 'verification', 'details'];

export const ReportBreadcrumbs: React.FC<Props> = ({current, hasSelection, hasEmail, hasTicket, onSelect}) => {
	const isEnabled = (step: FlowStep) => {
		if (step === 'selection') return true;
		if (step === 'email') return hasSelection;
		if (step === 'verification') return hasEmail;
		if (step === 'details') return hasTicket;
		return false;
	};

	const labelMap: Record<FlowStep, React.ReactNode> = {
		selection: <Trans>Choose</Trans>,
		email: <Trans>Email</Trans>,
		verification: <Trans>Code</Trans>,
		details: <Trans>Details</Trans>,
		complete: <Trans>Done</Trans>,
	};

	return (
		<div className={styles.breadcrumbs}>
			{STEP_ORDER.map((step, index) => {
				const active = current === step;
				const clickable = !active && isEnabled(step);

				return (
					<React.Fragment key={step}>
						<button
							type="button"
							className={clsx(styles.breadcrumbStep, active && styles.breadcrumbActive)}
							disabled={!clickable}
							onClick={() => clickable && onSelect(step)}
						>
							<span className={styles.breadcrumbNumber}>{index + 1}</span>
							<span className={styles.breadcrumbLabel}>{labelMap[step]}</span>
						</button>
						{index < STEP_ORDER.length - 1 && <span className={styles.breadcrumbSeparator}>›</span>}
					</React.Fragment>
				);
			})}
		</div>
	);
};
