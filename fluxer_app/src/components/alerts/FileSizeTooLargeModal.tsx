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
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import UserStore from '@app/stores/UserStore';
import {formatFileSize} from '@app/utils/FileUtils';
import {Limits} from '@app/utils/limits/UserLimits';
import {shouldShowPremiumFeatures} from '@app/utils/PremiumUtils';
import {ATTACHMENT_MAX_SIZE_PREMIUM} from '@fluxer/constants/src/LimitConstants';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback} from 'react';

interface FileSizeTooLargeModalProps {
	oversizedFileCount?: number;
}

export const FileSizeTooLargeModal = observer(({oversizedFileCount}: FileSizeTooLargeModalProps) => {
	const {t} = useLingui();
	const user = UserStore.currentUser;
	const showPremium = shouldShowPremiumFeatures();
	const maxAttachmentFileSize = user?.maxAttachmentFileSize ?? 25 * 1024 * 1024;
	const premiumMaxAttachmentFileSize = Limits.getPremiumValue('max_attachment_file_size', ATTACHMENT_MAX_SIZE_PREMIUM);
	const canUpgradeAttachmentLimit = maxAttachmentFileSize < premiumMaxAttachmentFileSize;
	const maxSizeFormatted = formatFileSize(maxAttachmentFileSize);
	const hasKnownOversizedFileCount = oversizedFileCount != null;
	const hasMultipleOversizedFiles = (oversizedFileCount ?? 0) > 1;
	const handleGetPlutoniumClick = useCallback(() => {
		window.setTimeout(() => {
			PremiumModalActionCreators.open();
		}, 0);
	}, []);

	const baseDescription = hasKnownOversizedFileCount
		? hasMultipleOversizedFiles
			? t`Some files you're trying to upload exceed the maximum size limit of ${maxSizeFormatted} per file.`
			: t`The file you're trying to upload exceeds the maximum size limit of ${maxSizeFormatted}.`
		: t`One or more files you're trying to upload exceed the maximum size limit of ${maxSizeFormatted} per file.`;

	if (!showPremium || !canUpgradeAttachmentLimit) {
		return (
			<ConfirmModal
				title={t`File size too large`}
				description={
					!showPremium ? (
						<Trans>{baseDescription} This limit is configured by your instance administrator.</Trans>
					) : (
						baseDescription
					)
				}
				primaryText={t`Understood`}
				onPrimary={() => {}}
			/>
		);
	}

	return (
		<ConfirmModal
			title={t`File size limit exceeded`}
			description={
				<Trans>
					{baseDescription} With Plutonium, your per-file upload limit increases to{' '}
					{formatFileSize(premiumMaxAttachmentFileSize)}, plus animated avatars, longer messages, and many other premium
					features.
				</Trans>
			}
			primaryText={t`Get Plutonium`}
			primaryVariant="primary"
			onPrimary={handleGetPlutoniumClick}
			secondaryText={t`Cancel`}
		/>
	);
});
