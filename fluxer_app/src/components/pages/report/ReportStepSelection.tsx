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

import {Trans} from '@lingui/react/macro';
import type React from 'react';
import type {RadioOption} from '~/components/uikit/RadioGroup/RadioGroup';
import {RadioGroup} from '~/components/uikit/RadioGroup/RadioGroup';
import styles from '../ReportPage.module.css';
import type {ReportType} from './types';

type Props = {
	reportTypeOptions: ReadonlyArray<RadioOption<ReportType>>;
	selectedType: ReportType | null;
	onSelect: (type: ReportType) => void;
};

export const ReportStepSelection: React.FC<Props> = ({reportTypeOptions, selectedType, onSelect}) => {
	return (
		<div className={styles.card}>
			<header className={styles.cardHeader}>
				<p className={styles.eyebrow}>
					<Trans>Step 1</Trans>
				</p>
				<h1 className={styles.title}>
					<Trans>Report Illegal Content</Trans>
				</h1>
				<p className={styles.description}>
					<Trans>Select what you want to report.</Trans>
				</p>
			</header>

			<div className={styles.cardBody}>
				<RadioGroup<ReportType>
					options={reportTypeOptions}
					value={selectedType}
					onChange={onSelect}
					aria-label="Report Type"
				/>
			</div>
		</div>
	);
};

export default ReportStepSelection;
