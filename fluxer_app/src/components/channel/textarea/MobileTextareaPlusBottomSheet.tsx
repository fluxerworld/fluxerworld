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
import {MenuBottomSheet, type MenuGroupType} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import RuntimeConfigStore from '@app/stores/RuntimeConfigStore';
import {useLingui} from '@lingui/react/macro';
import {GiftIcon, PaperclipIcon, UploadSimpleIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useMemo} from 'react';

interface MobileTextareaPlusBottomSheetProps {
	isOpen: boolean;
	onClose: () => void;
	onUploadFile: () => void;
	textareaValue?: string;
	onUploadAsFile?: () => void;
}

export const MobileTextareaPlusBottomSheet = observer(
	({isOpen, onClose, onUploadFile, textareaValue, onUploadAsFile}: MobileTextareaPlusBottomSheetProps) => {
		const {t} = useLingui();
		const isSelfHosted = RuntimeConfigStore.isSelfHosted();

		const groups: Array<MenuGroupType> = useMemo(() => {
			const items = [
				{
					icon: <PaperclipIcon weight="bold" />,
					label: t`Upload File`,
					onClick: () => {
						onUploadFile();
						onClose();
					},
				},
			];

			const hasTextContent = textareaValue && textareaValue.trim().length > 0;
			if (hasTextContent && onUploadAsFile) {
				items.push({
					icon: <UploadSimpleIcon />,
					label: t`Upload your message as a file`,
					onClick: () => {
						onUploadAsFile();
						onClose();
					},
				});
			}

			if (!isSelfHosted) {
				items.push({
					icon: <GiftIcon />,
					label: t`Send Gift`,
					onClick: () => {
						PremiumModalActionCreators.open(true);
						onClose();
					},
				});
			}

			return [{items}];
		}, [isSelfHosted, onClose, onUploadFile, textareaValue, onUploadAsFile, t]);

		return <MenuBottomSheet isOpen={isOpen} onClose={onClose} groups={groups} />;
	},
);

MobileTextareaPlusBottomSheet.displayName = 'MobileTextareaPlusBottomSheet';
