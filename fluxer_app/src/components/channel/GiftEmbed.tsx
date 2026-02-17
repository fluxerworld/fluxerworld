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

import * as GiftActionCreators from '@app/actions/GiftActionCreators';
import styles from '@app/components/channel/GiftEmbed.module.css';
import {
	EmbedCard,
	EmbedSkeletonButton,
	EmbedSkeletonCircle,
	EmbedSkeletonSubtitle,
	EmbedSkeletonTitle,
} from '@app/components/embeds/embed_card/EmbedCard';
import cardStyles from '@app/components/embeds/embed_card/EmbedCard.module.css';
import {useEmbedSkeletonOverride} from '@app/components/embeds/embed_card/useEmbedSkeletonOverride';
import {openClaimAccountModal} from '@app/components/modals/ClaimAccountModal';
import {Button} from '@app/components/uikit/button/Button';
import i18n from '@app/I18n';
import {ComponentDispatch} from '@app/lib/ComponentDispatch';
import {Logger} from '@app/lib/Logger';
import GiftStore from '@app/stores/GiftStore';
import UserStore from '@app/stores/UserStore';
import {getGiftDurationText} from '@app/utils/GiftUtils';
import {useLingui} from '@lingui/react/macro';
import {GiftIcon, QuestionIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useEffect, useRef} from 'react';

const logger = new Logger('GiftEmbed');

interface GiftEmbedProps {
	code: string;
}

export const GiftEmbed = observer(function GiftEmbed({code}: GiftEmbedProps) {
	const {t} = useLingui();
	const giftState = GiftStore.gifts.get(code) ?? null;
	const gift = giftState?.data;
	const creator = UserStore.getUser(gift?.created_by?.id ?? '');
	const isUnclaimed = !(UserStore.currentUser?.isClaimed() ?? false);
	const shouldForceSkeleton = useEmbedSkeletonOverride();

	useEffect(() => {
		if (!giftState) {
			void GiftActionCreators.fetchWithCoalescing(code).catch(() => {});
		}
	}, [code, giftState]);

	const prevLoadingRef = useRef<boolean>(true);
	useEffect(() => {
		const isLoading = !!giftState?.loading;
		if (prevLoadingRef.current && !isLoading && giftState) {
			ComponentDispatch.dispatch('LAYOUT_RESIZED');
		}
		prevLoadingRef.current = isLoading;
	}, [giftState?.loading]);

	if (shouldForceSkeleton || !giftState || giftState.loading) {
		return <GiftLoadingState />;
	}

	if (giftState.invalid || giftState.error || !gift) {
		return <GiftNotFoundError />;
	}

	const durationText = getGiftDurationText(i18n, gift);

	const handleRedeem = async () => {
		if (isUnclaimed) {
			openClaimAccountModal({force: true});
			return;
		}
		try {
			await GiftActionCreators.redeem(i18n, code);
		} catch (error) {
			logger.error('Failed to redeem gift', error);
		}
	};

	const subtitleNode = creator ? (
		<span className={styles.subRow}>{t`From ${creator.username}#${creator.discriminator}`}</span>
	) : undefined;

	const helpText = gift.redeemed
		? t`Already redeemed`
		: isUnclaimed
			? t`Claim your account to redeem this gift.`
			: t`Click to claim your gift!`;

	const footer =
		gift.redeemed && !isUnclaimed ? (
			<Button variant="primary" matchSkeletonHeight disabled>
				{t`Gift Claimed`}
			</Button>
		) : (
			<Button variant="primary" matchSkeletonHeight onClick={handleRedeem} disabled={gift.redeemed || isUnclaimed}>
				{(() => {
					if (gift.redeemed) return t`Gift Claimed`;
					if (isUnclaimed) return t`Claim Account to Redeem`;
					return t`Claim Gift`;
				})()}
			</Button>
		);

	return (
		<EmbedCard
			splashURL={null}
			icon={
				<div className={`${styles.iconCircle} ${gift.redeemed ? styles.iconCircleInactive : styles.iconCircleActive}`}>
					<GiftIcon className={styles.icon} />
				</div>
			}
			title={
				<h3
					className={`${styles.title} ${cardStyles.title} ${gift.redeemed ? styles.titleTertiary : styles.titlePrimary}`}
				>
					{durationText}
				</h3>
			}
			subtitle={subtitleNode}
			body={<div className={styles.helpRow}>{helpText}</div>}
			footer={footer}
		/>
	);
});

const GiftLoadingState = observer(function GiftLoadingState() {
	return (
		<EmbedCard
			splashURL={null}
			icon={<EmbedSkeletonCircle className={styles.skeletonCircle} />}
			title={<EmbedSkeletonTitle className={styles.skeletonTitle} />}
			body={<EmbedSkeletonSubtitle className={styles.skeletonHelp} />}
			footer={<EmbedSkeletonButton className={styles.skeletonButton} />}
		/>
	);
});

const GiftNotFoundError = observer(function GiftNotFoundError() {
	const {t} = useLingui();

	return (
		<EmbedCard
			splashURL={null}
			icon={
				<div className={`${styles.iconCircle} ${styles.iconCircleDisabled}`}>
					<QuestionIcon className={`${styles.icon} ${styles.iconError}`} />
				</div>
			}
			title={<h3 className={`${styles.title} ${styles.titleDanger}`}>{t`Unknown Gift`}</h3>}
			body={<span className={styles.helpRow}>{t`This gift code is invalid or already claimed.`}</span>}
			footer={
				<Button variant="primary" matchSkeletonHeight disabled>
					{t`Gift Unavailable`}
				</Button>
			}
		/>
	);
});
