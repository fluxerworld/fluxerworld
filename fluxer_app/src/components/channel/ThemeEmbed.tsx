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

import * as ThemeActionCreators from '@app/actions/ThemeActionCreators';
import styles from '@app/components/channel/ThemeEmbed.module.css';
import {
	EmbedCard,
	EmbedSkeletonButton,
	EmbedSkeletonCircle,
	EmbedSkeletonSubtitle,
	EmbedSkeletonTitle,
} from '@app/components/embeds/embed_card/EmbedCard';
import cardStyles from '@app/components/embeds/embed_card/EmbedCard.module.css';
import {useEmbedSkeletonOverride} from '@app/components/embeds/embed_card/useEmbedSkeletonOverride';
import {Button} from '@app/components/uikit/button/Button';
import {useThemeExists} from '@app/hooks/useThemeExists';
import {Trans, useLingui} from '@lingui/react/macro';
import {PaletteIcon, QuestionIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';

interface ThemeEmbedProps {
	themeId: string;
}

export const ThemeEmbed = observer(function ThemeEmbed({themeId}: ThemeEmbedProps) {
	const {t, i18n} = useLingui();
	const status = useThemeExists(themeId);
	const shouldForceSkeleton = useEmbedSkeletonOverride();

	const handleImport = () => {
		ThemeActionCreators.openAcceptModal(themeId, i18n);
	};

	if (shouldForceSkeleton || status === 'loading') {
		return <ThemeLoadingState />;
	}

	if (status === 'error') {
		return <ThemeUnavailableError message={t`This theme is no longer available.`} />;
	}

	return (
		<EmbedCard
			splashURL={null}
			icon={
				<div className={`${styles.iconCircle} ${styles.iconCircleActive}`}>
					<PaletteIcon size={24} weight="bold" className={styles.iconOnBrand} />
				</div>
			}
			title={<h3 className={`${cardStyles.title} ${cardStyles.titlePrimary}`}>{t`Shared theme`}</h3>}
			subtitle={
				<span className={cardStyles.helpText}>
					<Trans>You've got CSS!</Trans>
				</span>
			}
			footer={
				<Button variant="primary" matchSkeletonHeight onClick={handleImport}>
					{t`Import theme`}
				</Button>
			}
		/>
	);
});

const ThemeLoadingState = observer(() => {
	return (
		<EmbedCard
			splashURL={null}
			icon={<EmbedSkeletonCircle />}
			title={<EmbedSkeletonTitle />}
			subtitle={<EmbedSkeletonSubtitle />}
			footer={<EmbedSkeletonButton />}
		/>
	);
});

const ThemeUnavailableError = observer(({message}: {message: string | null}) => {
	const {t} = useLingui();
	return (
		<EmbedCard
			splashURL={null}
			icon={
				<div className={cardStyles.iconCircleDisabled}>
					<QuestionIcon className={cardStyles.iconError} />
				</div>
			}
			title={<h3 className={`${cardStyles.title} ${cardStyles.titleDanger}`}>{t`Theme unavailable`}</h3>}
			subtitle={<span className={cardStyles.helpText}>{message ?? t`This theme is no longer available.`}</span>}
			footer={
				<Button variant="primary" matchSkeletonHeight disabled>
					{t`Import unavailable`}
				</Button>
			}
		/>
	);
});
