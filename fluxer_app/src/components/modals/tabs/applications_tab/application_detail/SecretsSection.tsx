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
import styles from '@app/components/modals/tabs/applications_tab/application_detail/ApplicationDetail.module.css';
import {SectionCard} from '@app/components/modals/tabs/applications_tab/application_detail/SectionCard';
import {Button} from '@app/components/uikit/button/Button';
import {useLingui} from '@lingui/react/macro';
import type React from 'react';

interface SecretsSectionProps {
	clientSecret: string | null;
	botToken: string | null;
	onRegenerateClientSecret: () => void;
	onRegenerateBotToken: () => void;
	isRotatingClient: boolean;
	isRotatingBot: boolean;
	hasBot: boolean;
	clientSecretInputId: string;
	botTokenInputId: string;
}

export const SecretsSection: React.FC<SecretsSectionProps> = ({
	clientSecret,
	botToken,
	onRegenerateClientSecret,
	onRegenerateBotToken,
	isRotatingClient,
	isRotatingBot,
	hasBot,
	clientSecretInputId,
	botTokenInputId,
}) => {
	const {t} = useLingui();
	return (
		<SectionCard
			title={t`Secrets & Tokens`}
			subtitle={t`Keep these safe. Regenerating will break existing integrations.`}
		>
			<div className={styles.fieldStack}>
				<div className={styles.secretRow}>
					<Input
						id={clientSecretInputId}
						label={t`Client secret`}
						type="text"
						value={clientSecret ?? ''}
						readOnly
						placeholder={clientSecret ? '•'.repeat(64) : '•'.repeat(64)}
					/>
					<div className={styles.secretActions}>
						<Button variant="primary" compact submitting={isRotatingClient} onClick={onRegenerateClientSecret}>
							{t`Regenerate`}
						</Button>
					</div>
				</div>

				{hasBot && (
					<div className={styles.secretRow}>
						<Input
							id={botTokenInputId}
							label={t`Bot token`}
							type="text"
							value={botToken ?? ''}
							readOnly
							placeholder={botToken ? '•'.repeat(64) : '•'.repeat(64)}
						/>
						<div className={styles.secretActions}>
							<Button variant="primary" compact submitting={isRotatingBot} onClick={onRegenerateBotToken}>
								{t`Regenerate`}
							</Button>
						</div>
					</div>
				)}
			</div>
		</SectionCard>
	);
};
