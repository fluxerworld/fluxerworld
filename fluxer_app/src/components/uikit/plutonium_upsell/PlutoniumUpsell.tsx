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

import * as PremiumModalActionCreators from '@app/actions/PremiumModalActionCreators';
import {Button} from '@app/components/uikit/button/Button';
import styles from '@app/components/uikit/plutonium_upsell/PlutoniumUpsell.module.css';
import {shouldShowPremiumFeatures} from '@app/utils/PremiumUtils';
import {Trans, useLingui} from '@lingui/react/macro';
import {CrownIcon, InfoIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import type React from 'react';

interface PlutoniumUpsellProps {
	children: React.ReactNode;
	className?: string;
	buttonText?: React.ReactNode;
	onButtonClick?: () => void;
	dismissible?: boolean;
	onDismiss?: () => void;
}

export const PlutoniumUpsell: React.FC<PlutoniumUpsellProps> = ({
	children,
	className,
	buttonText,
	onButtonClick,
	dismissible,
	onDismiss,
}) => {
	const showPremiumFeatures = shouldShowPremiumFeatures();
	const {t} = useLingui();
	if (!showPremiumFeatures) {
		return (
			<div className={clsx(styles.selfHostedNotice, className)}>
				<InfoIcon size={16} weight="fill" className={styles.selfHostedIcon} />
				<div className={styles.selfHostedTextContainer}>
					<div className={styles.selfHostedText}>{children}</div>
					<p className={styles.selfHostedText}>
						<Trans>This feature has been disabled by the instance administrator.</Trans>
					</p>
				</div>
			</div>
		);
	}
	return (
		<div className={clsx(styles.upsell, className)}>
			<CrownIcon size={16} weight="fill" className={styles.icon} />
			<div className={styles.content}>
				<div className={styles.text}>{children}</div>
				<div className={styles.actions}>
					<Button
						variant="inverted"
						superCompact={true}
						fitContent={true}
						onClick={onButtonClick ?? (() => PremiumModalActionCreators.open())}
						aria-label={t`Get Plutonium`}
					>
						{buttonText ?? <Trans>Get Plutonium</Trans>}
					</Button>
					{dismissible && onDismiss && (
						<button type="button" className={styles.dismissLink} onClick={onDismiss}>
							<Trans>Don't show this again</Trans>
						</button>
					)}
				</div>
			</div>
		</div>
	);
};
