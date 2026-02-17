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

import {Input} from '@app/components/form/Input';
import {Switch} from '@app/components/form/Switch';
import styles from '@app/components/modals/tabs/applications_tab/application_detail/ApplicationDetail.module.css';
import type {ApplicationDetailForm} from '@app/components/modals/tabs/applications_tab/application_detail/ApplicationDetailTypes';
import {SectionCard} from '@app/components/modals/tabs/applications_tab/application_detail/SectionCard';
import {Button} from '@app/components/uikit/button/Button';
import {useLingui} from '@lingui/react/macro';
import {XIcon} from '@phosphor-icons/react';
import type React from 'react';

interface ApplicationInfoSectionProps {
	form: ApplicationDetailForm;
	redirectInputs: Array<string>;
	onAddRedirect: () => void;
	onRemoveRedirect: (index: number) => void;
	onUpdateRedirect: (index: number, value: string) => void;
}

export const ApplicationInfoSection: React.FC<ApplicationInfoSectionProps> = ({
	form,
	redirectInputs,
	onAddRedirect,
	onRemoveRedirect,
	onUpdateRedirect,
}) => {
	const {t} = useLingui();
	const redirectList = redirectInputs ?? [];

	return (
		<SectionCard title={t`Application Information`} subtitle={t`Basic settings and allowed redirect URIs.`}>
			<div className={styles.fieldStack}>
				<Input
					{...form.register('name', {required: t`Application name is required`})}
					label={t`Application Name`}
					value={form.watch('name')}
					placeholder={t`My Application`}
					maxLength={100}
					error={form.formState.errors.name?.message}
				/>

				<Switch
					label={t`Public Bot`}
					description={t`Allow anyone to invite this bot to their communities.`}
					value={form.watch('botPublic')}
					onChange={(checked) => form.setValue('botPublic', checked, {shouldDirty: true})}
				/>

				<Switch
					label={t`Require OAuth2 code grant`}
					description={t`When enabled, inviting this bot requires a redirect URI and an authorization code.`}
					value={form.watch('botRequireCodeGrant')}
					onChange={(checked) => form.setValue('botRequireCodeGrant', checked, {shouldDirty: true})}
				/>

				<div className={styles.redirectList}>
					{redirectList.map((value, idx) => (
						<div key={idx} className={styles.redirectRow} data-first={idx === 0 ? 'true' : undefined}>
							<Input
								label={idx === 0 ? t`Redirect URIs` : undefined}
								value={value}
								onChange={(e) => onUpdateRedirect(idx, e.target.value)}
								placeholder={t`https://example.com/callback`}
							/>
							<div className={styles.redirectActions}>
								<button
									type="button"
									className={styles.redirectRemoveButton}
									onClick={() => onRemoveRedirect(idx)}
									disabled={idx === 0}
									aria-label={t`Remove redirect URI`}
								>
									<XIcon size={18} weight="bold" />
								</button>
							</div>
						</div>
					))}
					<Button variant="primary" fitContent className={styles.addRedirectButton} onClick={onAddRedirect}>
						{t`Add redirect`}
					</Button>
				</div>
			</div>
		</SectionCard>
	);
};
