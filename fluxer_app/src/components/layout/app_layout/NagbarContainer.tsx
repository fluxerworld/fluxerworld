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

import {type NagbarState, NagbarType} from '@app/components/layout/app_layout/AppLayoutTypes';
import styles from '@app/components/layout/app_layout/NagbarContainer.module.css';
import {DesktopDownloadNagbar} from '@app/components/layout/app_layout/nagbars/DesktopDownloadNagbar';
import {DesktopNotificationNagbar} from '@app/components/layout/app_layout/nagbars/DesktopNotificationNagbar';
import {EmailVerificationNagbar} from '@app/components/layout/app_layout/nagbars/EmailVerificationNagbar';
import {GiftInventoryNagbar} from '@app/components/layout/app_layout/nagbars/GiftInventoryNagbar';
import {GuildMembershipCtaNagbar} from '@app/components/layout/app_layout/nagbars/GuildMembershipCtaNagbar';
import {MobileDownloadNagbar} from '@app/components/layout/app_layout/nagbars/MobileDownloadNagbar';
import {PendingBulkDeletionNagbar} from '@app/components/layout/app_layout/nagbars/PendingBulkDeletionNagbar';
import {PremiumExpiredNagbar} from '@app/components/layout/app_layout/nagbars/PremiumExpiredNagbar';
import {PremiumGracePeriodNagbar} from '@app/components/layout/app_layout/nagbars/PremiumGracePeriodNagbar';
import {PremiumOnboardingNagbar} from '@app/components/layout/app_layout/nagbars/PremiumOnboardingNagbar';
import {UnclaimedAccountNagbar} from '@app/components/layout/app_layout/nagbars/UnclaimedAccountNagbar';
import {VisionaryMfaNagbar} from '@app/components/layout/app_layout/nagbars/VisionaryMfaNagbar';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import {observer} from 'mobx-react-lite';
import type React from 'react';

interface NagbarContainerProps {
	nagbars: Array<NagbarState>;
}

export const NagbarContainer: React.FC<NagbarContainerProps> = observer(({nagbars}) => {
	const mobileLayout = MobileLayoutStore;

	if (nagbars.length === 0) return null;

	return (
		<div className={styles.container}>
			{nagbars.map((nagbar) => {
				switch (nagbar.type) {
					case NagbarType.UNCLAIMED_ACCOUNT:
						return <UnclaimedAccountNagbar key={nagbar.type} isMobile={mobileLayout.enabled} />;
					case NagbarType.EMAIL_VERIFICATION:
						return <EmailVerificationNagbar key={nagbar.type} isMobile={mobileLayout.enabled} />;
					case NagbarType.BULK_DELETE_PENDING:
						return <PendingBulkDeletionNagbar key={nagbar.type} isMobile={mobileLayout.enabled} />;
					case NagbarType.DESKTOP_NOTIFICATION:
						return <DesktopNotificationNagbar key={nagbar.type} isMobile={mobileLayout.enabled} />;
					case NagbarType.PREMIUM_GRACE_PERIOD:
						return <PremiumGracePeriodNagbar key={nagbar.type} isMobile={mobileLayout.enabled} />;
					case NagbarType.PREMIUM_EXPIRED:
						return <PremiumExpiredNagbar key={nagbar.type} isMobile={mobileLayout.enabled} />;
					case NagbarType.PREMIUM_ONBOARDING:
						return <PremiumOnboardingNagbar key={nagbar.type} isMobile={mobileLayout.enabled} />;
					case NagbarType.GIFT_INVENTORY:
						return <GiftInventoryNagbar key={nagbar.type} isMobile={mobileLayout.enabled} />;
					case NagbarType.DESKTOP_DOWNLOAD:
						return <DesktopDownloadNagbar key={nagbar.type} isMobile={mobileLayout.enabled} />;
					case NagbarType.MOBILE_DOWNLOAD:
						return <MobileDownloadNagbar key={nagbar.type} isMobile={mobileLayout.enabled} />;
					case NagbarType.GUILD_MEMBERSHIP_CTA:
						return <GuildMembershipCtaNagbar key={nagbar.type} isMobile={mobileLayout.enabled} />;
					case NagbarType.VISIONARY_MFA:
						return <VisionaryMfaNagbar key={nagbar.type} isMobile={mobileLayout.enabled} />;
					default:
						return null;
				}
			})}
		</div>
	);
});
