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

import * as NagbarActionCreators from '@app/actions/NagbarActionCreators';
import {
	getNagbarControls,
	type NagbarControlDefinition,
} from '@app/components/modals/tabs/developer_options_tab/NagbarControls';
import styles from '@app/components/modals/tabs/developer_options_tab/NagbarsTab.module.css';
import {Button} from '@app/components/uikit/button/Button';
import type {NagbarStore, NagbarToggleKey} from '@app/stores/NagbarStore';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';

interface NagbarsTabContentProps {
	nagbarState: NagbarStore;
}

const NagbarRow: React.FC<{
	control: NagbarControlDefinition;
	nagbarState: NagbarStore;
}> = observer(({control, nagbarState}) => {
	const {t} = useLingui();
	const getFlag = (key: NagbarToggleKey): boolean => Boolean(nagbarState[key]);
	const useActualDisabled =
		control.useActualDisabled?.(nagbarState) ?? control.resetKeys.every((key: NagbarToggleKey) => !getFlag(key));
	const forceShowDisabled = control.forceShowDisabled?.(nagbarState) ?? getFlag(control.forceKey);
	const forceHideDisabled = control.forceHideDisabled?.(nagbarState) ?? getFlag(control.forceHideKey);

	const handleUseActual = () => {
		control.resetKeys.forEach((key: NagbarToggleKey) => NagbarActionCreators.resetNagbar(key));
		NagbarActionCreators.setForceHideNagbar(control.forceHideKey, false);
	};

	const handleForceShow = () => {
		NagbarActionCreators.dismissNagbar(control.forceKey);
		NagbarActionCreators.setForceHideNagbar(control.forceHideKey, false);
	};

	const handleForceHide = () => {
		NagbarActionCreators.setForceHideNagbar(control.forceHideKey, true);
		NagbarActionCreators.resetNagbar(control.forceKey);
	};

	return (
		<div className={styles.nagbarItem}>
			<div className={styles.nagbarInfo}>
				<span className={styles.nagbarLabel}>{control.label}</span>
				<span className={styles.nagbarStatus}>{control.status(nagbarState)}</span>
			</div>
			<div className={styles.buttonGroup}>
				<Button onClick={handleUseActual} disabled={useActualDisabled}>
					{t`Use Actual`}
				</Button>
				<Button onClick={handleForceShow} disabled={forceShowDisabled}>
					{t`Force Show`}
				</Button>
				<Button onClick={handleForceHide} disabled={forceHideDisabled}>
					{t`Force Hide`}
				</Button>
			</div>
		</div>
	);
});

export const NagbarsTabContent: React.FC<NagbarsTabContentProps> = observer(({nagbarState}) => {
	const {t, i18n} = useLingui();
	const nagbarControls = getNagbarControls(i18n);

	return (
		<div className={styles.nagbarList}>
			{nagbarControls.map((control: NagbarControlDefinition) => (
				<NagbarRow key={control.key} control={control} nagbarState={nagbarState} />
			))}

			<div className={styles.footer}>
				<Button
					onClick={() => NagbarActionCreators.resetAllNagbars()}
					variant="secondary"
				>{t`Reset All Nagbars`}</Button>
			</div>
		</div>
	);
});
