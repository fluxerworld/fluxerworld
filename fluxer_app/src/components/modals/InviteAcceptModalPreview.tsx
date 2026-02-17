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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {PreviewGuildInviteHeader} from '@app/components/auth/InviteHeader';
import styles from '@app/components/modals/InviteAcceptModal.module.css';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import foodPatternUrl from '@app/images/i-like-food.svg';
import type {GuildRecord} from '@app/records/GuildRecord';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import PresenceStore from '@app/stores/PresenceStore';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback, useMemo} from 'react';

interface InviteAcceptModalPreviewProps {
	guild: GuildRecord;
	previewName: string | null | undefined;
	previewIconUrl: string | null;
	hasClearedIcon: boolean;
	previewSplashUrl: string | null;
	hasClearedSplash: boolean;
}

export const InviteAcceptModalPreview = observer(function InviteAcceptModalPreview({
	guild,
	previewName,
	previewIconUrl,
	hasClearedIcon,
	previewSplashUrl,
	hasClearedSplash,
}: InviteAcceptModalPreviewProps) {
	const {t} = useLingui();
	const handleDismiss = useCallback(() => {
		ModalActionCreators.pop();
	}, []);

	const presenceCount = PresenceStore.getPresenceCount(guild.id);
	const memberCount = GuildMemberStore.getMemberCount(guild.id);

	const guildFeatures = useMemo(() => {
		return Array.from(guild.features);
	}, [guild.features]);

	const splashUrl = useMemo(() => {
		if (hasClearedSplash) {
			return null;
		}

		if (previewSplashUrl) {
			return previewSplashUrl;
		}

		if (guild.splash) {
			return AvatarUtils.getGuildSplashURL({
				id: guild.id,
				splash: guild.splash,
			});
		}

		return null;
	}, [guild.id, guild.splash, hasClearedSplash, previewSplashUrl]);

	return (
		<Modal.Root size="large" className={styles.root} centered onClose={handleDismiss}>
			<Modal.ScreenReaderLabel text={t`Invite modal preview`} />
			<Modal.InsetCloseButton onClick={handleDismiss} disabled={false} />

			<div className={styles.background} aria-hidden>
				{splashUrl ? (
					<div className={styles.splashImage} style={{backgroundImage: `url(${splashUrl})`}} />
				) : (
					<div className={styles.patternImage} style={{backgroundImage: `url(${foodPatternUrl})`}} />
				)}
			</div>

			<div className={styles.cardHost}>
				<div className={styles.card}>
					<div className={styles.cardInner}>
						<PreviewGuildInviteHeader
							guildId={guild.id}
							guildName={guild.name}
							guildIcon={guild.icon}
							features={guildFeatures}
							presenceCount={presenceCount}
							memberCount={memberCount}
							previewIconUrl={hasClearedIcon ? null : previewIconUrl}
							previewName={previewName}
						/>

						<div className={styles.actions}>
							<Button disabled={true}>
								<Trans>Join Community</Trans>
							</Button>
						</div>
					</div>
				</div>
			</div>
		</Modal.Root>
	);
});
