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
import type {ReportType} from '@app/components/pages/report/ReportTypes';
import type {RadioOption} from '@app/components/uikit/radio_group/RadioGroup';
import {RadioGroup} from '@app/components/uikit/radio_group/RadioGroup';
import {Trans, useLingui} from '@lingui/react/macro';
import type React from 'react';

interface Props {
	reportTypeOptions: ReadonlyArray<RadioOption<ReportType>>;
	selectedType: ReportType | null;
	onSelect: (type: ReportType) => void;
}

export const ReportStepSelection: React.FC<Props> = ({reportTypeOptions, selectedType, onSelect}) => {
	const {t} = useLingui();
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
					aria-label={t`Report Type`}
				/>
			</div>
		</div>
	);
};
