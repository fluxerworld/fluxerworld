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
import {Select, type SelectOption} from '@app/components/form/Select';
import styles from '@app/components/modals/tabs/applications_tab/application_detail/ApplicationDetail.module.css';
import type {ApplicationDetailForm} from '@app/components/modals/tabs/applications_tab/application_detail/ApplicationDetailTypes';
import {SectionCard} from '@app/components/modals/tabs/applications_tab/application_detail/SectionCard';
import {Button} from '@app/components/uikit/button/Button';
import {Checkbox} from '@app/components/uikit/checkbox/Checkbox';
import {t} from '@lingui/core/macro';
import {Trans} from '@lingui/react/macro';
import {CopyIcon} from '@phosphor-icons/react';
import type React from 'react';
import {Controller} from 'react-hook-form';

interface OAuthBuilderSectionProps {
	form: ApplicationDetailForm;
	availableScopes: ReadonlyArray<string>;
	builderScopeList: Array<string>;
	botPermissionsList: Array<{id: string; label: string}>;
	builderUrl: string;
	redirectOptions: Array<SelectOption<string>>;
	onCopyBuilderUrl: () => Promise<void>;
}

export const OAuthBuilderSection: React.FC<OAuthBuilderSectionProps> = ({
	form,
	availableScopes,
	builderScopeList,
	botPermissionsList,
	builderUrl,
	redirectOptions,
	onCopyBuilderUrl,
}) => {
	const builderRedirectUri = form.watch('builderRedirectUri');
	const botRequireCodeGrant = form.watch('botRequireCodeGrant') ?? false;

	const isBotOnly = builderScopeList.length === 1 && builderScopeList[0] === 'bot';
	const redirectRequired = builderScopeList.length > 0 && (!isBotOnly || botRequireCodeGrant);

	let redirectError: string | undefined;
	if (redirectRequired && !builderRedirectUri) {
		if (isBotOnly && botRequireCodeGrant) {
			redirectError = t`Redirect URI is required because this bot requires OAuth2 code grant.`;
		} else {
			redirectError = t`Redirect URI is required when not using only the bot scope.`;
		}
	}

	return (
		<SectionCard
			title={<Trans>OAuth2 URL Builder</Trans>}
			subtitle={<Trans>Construct an authorize URL with scopes and permissions.</Trans>}
		>
			<div className={styles.fieldStack}>
				<div className={styles.scopeGrid}>
					<div className={styles.fieldLabel}>
						<Trans>Scopes</Trans>
					</div>
					<div className={styles.scopeList}>
						{availableScopes.map((scope) => (
							<div key={scope} className={styles.scopeItem}>
								<Controller
									name={`builderScopes.${scope}` as const}
									control={form.control}
									render={({field}) => (
										<Checkbox checked={!!field.value} onChange={(checked) => field.onChange(checked)} size="small">
											<span className={styles.scopeLabel}>{scope}</span>
										</Checkbox>
									)}
								/>
							</div>
						))}
					</div>
				</div>

				<Controller
					name="builderRedirectUri"
					control={form.control}
					render={({field}) => (
						<Select
							label={t`Redirect URI`}
							placeholder={t`Select a redirect URI`}
							value={field.value ?? ''}
							options={redirectOptions}
							onChange={(val) => field.onChange(val || '')}
							isClearable
							error={redirectError}
						/>
					)}
				/>

				{builderScopeList.includes('bot') && (
					<div className={styles.scopeGrid}>
						<div className={styles.fieldLabel}>
							<Trans>Bot permissions</Trans>
						</div>
						<div className={`${styles.scopeList} ${styles.botPermissionList}`}>
							{botPermissionsList.map((perm) => (
								<div key={perm.id} className={styles.scopeItem}>
									<Controller
										name={`builderPermissions.${perm.id}` as const}
										control={form.control}
										render={({field}) => (
											<Checkbox checked={!!field.value} onChange={(checked) => field.onChange(checked)} size="small">
												<span className={styles.scopeLabel}>{perm.label}</span>
											</Checkbox>
										)}
									/>
								</div>
							))}
						</div>
					</div>
				)}

				<div className={styles.builderResult}>
					<Input
						label={t`Authorize URL`}
						value={builderUrl}
						readOnly
						placeholder={t`Select scopes (and redirect URI if required)`}
						rightElement={
							<Button
								variant="primary"
								compact
								fitContent
								aria-label={t`Copy authorize URL`}
								leftIcon={<CopyIcon size={16} />}
								disabled={!builderUrl}
								onClick={onCopyBuilderUrl}
							>
								<span className={styles.srOnly}>
									<Trans>Copy</Trans>
								</span>
							</Button>
						}
					/>
				</div>
			</div>
		</SectionCard>
	);
};
