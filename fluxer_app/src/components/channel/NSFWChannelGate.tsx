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

import * as GuildNSFWActionCreators from '@app/actions/GuildNSFWActionCreators';
import styles from '@app/components/channel/NSFWChannelGate.module.css';
import {ExternalLink} from '@app/components/common/ExternalLink';
import {Button} from '@app/components/uikit/button/Button';
import {HelpCenterArticleSlug} from '@app/constants/HelpCenterConstants';
import GeoIPStore from '@app/stores/GeoIPStore';
import {NSFWGateReason} from '@app/stores/GuildNSFWAgreeStore';
import {getRegionDisplayName} from '@app/utils/GeoUtils';
import * as HelpCenterUtils from '@app/utils/HelpCenterUtils';
import {Trans, useLingui} from '@lingui/react/macro';
import {WarningIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';

interface Props {
	channelId: string;
	guildId?: string | null;
	reason: NSFWGateReason;
	scope: 'channel' | 'guild';
}

export const NSFWChannelGate = observer(({channelId, guildId, reason, scope}: Props) => {
	const {i18n} = useLingui();
	const handleProceed = () => {
		if (scope === 'guild' && guildId) {
			GuildNSFWActionCreators.agreeToGuild(guildId);
			return;
		}

		GuildNSFWActionCreators.agreeToChannel(channelId);
	};

	const renderContent = () => {
		switch (reason) {
			case NSFWGateReason.GEO_RESTRICTED: {
				const countryCode = GeoIPStore.countryCode;
				const regionCode = GeoIPStore.regionCode;
				const regionName = getRegionDisplayName(i18n, countryCode ?? undefined, regionCode ?? undefined);

				return (
					<>
						<h2 className={styles.title}>
							<Trans>Age-Restricted Content</Trans>
						</h2>
						<p className={styles.description}>
							<Trans>
								Due to age verification laws in {regionName}, you cannot access age-restricted content from this region.
							</Trans>
						</p>
					</>
				);
			}

			case NSFWGateReason.AGE_RESTRICTED:
				return scope === 'guild' ? (
					<>
						<h2 className={styles.title}>
							<Trans>Age-Restricted Community</Trans>
						</h2>
						<p className={styles.description}>
							<Trans>
								You must be 18 or older to view this community.{' '}
								<ExternalLink href={HelpCenterUtils.getURL(HelpCenterArticleSlug.ChangeDateOfBirth)}>
									Learn more
								</ExternalLink>
							</Trans>
						</p>
					</>
				) : (
					<>
						<h2 className={styles.title}>
							<Trans>Age-Restricted Channel</Trans>
						</h2>
						<p className={styles.description}>
							<Trans>
								You must be 18 or older to view this channel.{' '}
								<ExternalLink href={HelpCenterUtils.getURL(HelpCenterArticleSlug.ChangeDateOfBirth)}>
									Learn more
								</ExternalLink>
							</Trans>
						</p>
					</>
				);
			default:
				return scope === 'guild' ? (
					<>
						<h2 className={styles.title}>
							<Trans>Age-Restricted Community</Trans>
						</h2>
						<p className={styles.description}>
							<Trans>
								This community is marked as age-restricted and may contain content that is not safe for work or that may
								be inappropriate for some users.
							</Trans>
						</p>
						<Button onClick={handleProceed} variant="danger-primary">
							<Trans>Proceed</Trans>
						</Button>
					</>
				) : (
					<>
						<h2 className={styles.title}>
							<Trans>NSFW Channel</Trans>
						</h2>
						<p className={styles.description}>
							<Trans>
								This channel is marked as NSFW and may contain content that is not safe for work or that may be
								inappropriate for some users.
							</Trans>
						</p>
						<Button onClick={handleProceed} variant="danger-primary">
							<Trans>Proceed</Trans>
						</Button>
					</>
				);
		}
	};

	return (
		<div className={styles.container}>
			<div className={styles.content}>
				<div className={styles.iconContainer}>
					<WarningIcon className={styles.icon} weight="fill" />
				</div>
				{renderContent()}
			</div>
		</div>
	);
});
