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

import * as AccessibilityActionCreators from '@app/actions/AccessibilityActionCreators';
import * as PremiumModalActionCreators from '@app/actions/PremiumModalActionCreators';
import {CheckboxItem} from '@app/components/uikit/context_menu/ContextMenu';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {MenuItemSubmenu} from '@app/components/uikit/context_menu/MenuItemSubmenu';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import RuntimeConfigStore from '@app/stores/RuntimeConfigStore';
import {useLingui} from '@lingui/react/macro';
import {GiftIcon, PaperclipIcon, SlidersIcon, UploadSimpleIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';

interface TextareaPlusMenuProps {
	onUploadFile: () => void;
	onSchedule?: () => void;
	canSchedule?: boolean;
	canAttachFiles: boolean;
	canSendMessages: boolean;
	textareaValue?: string;
	onUploadAsFile?: () => void;
}

export const TextareaPlusMenu = observer(
	({onUploadFile, canAttachFiles, canSendMessages, textareaValue, onUploadAsFile}: TextareaPlusMenuProps) => {
		const {t} = useLingui();
		const showGifButton = AccessibilityStore.showGifButton;
		const showMemesButton = AccessibilityStore.showMemesButton;
		const showStickersButton = AccessibilityStore.showStickersButton;
		const showEmojiButton = AccessibilityStore.showEmojiButton;
		const showMessageSendButton = AccessibilityStore.showMessageSendButton;
		const isSelfHosted = RuntimeConfigStore.isSelfHosted();
		const hasTextContent = textareaValue && textareaValue.trim().length > 0;
		const cannotSendMessagesHint = t`You do not have permission to send messages in this channel.`;
		const cannotUploadFilesHint = t`You do not have permission to upload files in this channel.`;

		let uploadActionHint: string | undefined;
		if (!canSendMessages) {
			uploadActionHint = cannotSendMessagesHint;
		} else if (!canAttachFiles) {
			uploadActionHint = cannotUploadFilesHint;
		}

		const sendGiftHint = !canSendMessages ? cannotSendMessagesHint : undefined;

		return (
			<MenuGroup>
				<MenuItem
					icon={<PaperclipIcon weight="bold" />}
					onClick={onUploadFile}
					disabled={uploadActionHint != null}
					hint={uploadActionHint}
				>
					{t`Upload File`}
				</MenuItem>
				{hasTextContent && onUploadAsFile && (
					<MenuItem
						icon={<UploadSimpleIcon />}
						onClick={onUploadAsFile}
						disabled={uploadActionHint != null}
						hint={uploadActionHint}
					>
						{t`Upload your message as a file`}
					</MenuItem>
				)}
				{!isSelfHosted && (
					<MenuItem
						icon={<GiftIcon />}
						onClick={() => PremiumModalActionCreators.open(true)}
						disabled={sendGiftHint != null}
						hint={sendGiftHint}
					>
						{t`Send Gift`}
					</MenuItem>
				)}
				<MenuItemSubmenu
					label={t`Customize`}
					icon={<SlidersIcon />}
					render={() => (
						<>
							<MenuGroup>
								<CheckboxItem
									checked={showGifButton}
									onCheckedChange={(checked) => AccessibilityActionCreators.update({showGifButton: checked})}
									closeOnChange={false}
								>
									{t`Show GIFs Button`}
								</CheckboxItem>
								<CheckboxItem
									checked={showMemesButton}
									onCheckedChange={(checked) => AccessibilityActionCreators.update({showMemesButton: checked})}
									closeOnChange={false}
								>
									{t`Show Media Button`}
								</CheckboxItem>
								<CheckboxItem
									checked={showStickersButton}
									onCheckedChange={(checked) => AccessibilityActionCreators.update({showStickersButton: checked})}
									closeOnChange={false}
								>
									{t`Show Stickers Button`}
								</CheckboxItem>
								<CheckboxItem
									checked={showEmojiButton}
									onCheckedChange={(checked) => AccessibilityActionCreators.update({showEmojiButton: checked})}
									closeOnChange={false}
								>
									{t`Show Emoji Button`}
								</CheckboxItem>
								<CheckboxItem
									checked={showMessageSendButton}
									onCheckedChange={(checked) => AccessibilityActionCreators.update({showMessageSendButton: checked})}
									closeOnChange={false}
								>
									{t`Show Send Button`}
								</CheckboxItem>
							</MenuGroup>
						</>
					)}
				/>
			</MenuGroup>
		);
	},
);
