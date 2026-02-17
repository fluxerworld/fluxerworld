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
import {SettingsTabSection} from '@app/components/modals/shared/SettingsTabLayout';
import styles from '@app/components/modals/tabs/chat_settings_tab/InputTab.module.css';
import {KeyboardKey} from '@app/components/uikit/KeyboardKey';
import {SwitchGroup, SwitchGroupItem} from '@app/components/uikit/SwitchGroup';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useMemo} from 'react';

export const InputTabContent: React.FC = observer(() => {
	const {t} = useLingui();
	const mobileLayout = MobileLayoutStore;

	const isMac = useMemo(() => {
		return /Mac|iPhone|iPad|iPod/.test(navigator.platform) || /Macintosh/.test(navigator.userAgent);
	}, []);

	const modifierKey = isMac ? '⌘' : 'Ctrl';

	const {
		showGifButton,
		showMemesButton,
		showStickersButton,
		showEmojiButton,
		showMessageSendButton,
		showDefaultEmojisInExpressionAutocomplete,
		showCustomEmojisInExpressionAutocomplete,
		showStickersInExpressionAutocomplete,
		showMemesInExpressionAutocomplete,
	} = AccessibilityStore;

	return (
		<>
			<SettingsTabSection
				title={t`Expression autocomplete (colon autocomplete)`}
				description={t`Control what appears in the expression autocomplete when you type colon. Customize what suggestions show up to match your preferences.`}
			>
				<div className={styles.sectionContent}>
					<SwitchGroup>
						<SwitchGroupItem
							label={t`Show default emojis in expression autocomplete`}
							value={showDefaultEmojisInExpressionAutocomplete}
							onChange={(value) =>
								AccessibilityActionCreators.update({showDefaultEmojisInExpressionAutocomplete: value})
							}
						/>
						<SwitchGroupItem
							label={t`Show custom emojis in expression autocomplete`}
							value={showCustomEmojisInExpressionAutocomplete}
							onChange={(value) =>
								AccessibilityActionCreators.update({showCustomEmojisInExpressionAutocomplete: value})
							}
						/>
						<SwitchGroupItem
							label={t`Show stickers in expression autocomplete`}
							value={showStickersInExpressionAutocomplete}
							onChange={(value) => AccessibilityActionCreators.update({showStickersInExpressionAutocomplete: value})}
						/>
						<SwitchGroupItem
							label={t`Show saved media in expression autocomplete`}
							value={showMemesInExpressionAutocomplete}
							onChange={(value) => AccessibilityActionCreators.update({showMemesInExpressionAutocomplete: value})}
						/>
					</SwitchGroup>
				</div>
			</SettingsTabSection>

			{!mobileLayout.enabled && (
				<SettingsTabSection
					title={t`Message Input Buttons`}
					description={t`Customize which buttons are visible in the message input area. Keyboard shortcuts will continue to work even if buttons are hidden.`}
				>
					<div className={styles.sectionContent}>
						<SwitchGroup>
							<SwitchGroupItem
								label={t`Show GIFs Button`}
								value={showGifButton}
								onChange={(value) => AccessibilityActionCreators.update({showGifButton: value})}
								shortcut={
									<>
										<KeyboardKey>{modifierKey}</KeyboardKey>
										<KeyboardKey>G</KeyboardKey>
									</>
								}
							/>
							<SwitchGroupItem
								label={t`Show Media Button`}
								value={showMemesButton}
								onChange={(value) => AccessibilityActionCreators.update({showMemesButton: value})}
								shortcut={
									<>
										<KeyboardKey>{modifierKey}</KeyboardKey>
										<KeyboardKey>M</KeyboardKey>
									</>
								}
							/>
							<SwitchGroupItem
								label={t`Show Stickers Button`}
								value={showStickersButton}
								onChange={(value) => AccessibilityActionCreators.update({showStickersButton: value})}
								shortcut={
									<>
										<KeyboardKey>{modifierKey}</KeyboardKey>
										<KeyboardKey>S</KeyboardKey>
									</>
								}
							/>
							<SwitchGroupItem
								label={t`Show Emoji Button`}
								value={showEmojiButton}
								onChange={(value) => AccessibilityActionCreators.update({showEmojiButton: value})}
								shortcut={
									<>
										<KeyboardKey>{modifierKey}</KeyboardKey>
										<KeyboardKey>E</KeyboardKey>
									</>
								}
							/>
							<SwitchGroupItem
								label={t`Show Send Button`}
								value={showMessageSendButton}
								onChange={(value) => AccessibilityActionCreators.update({showMessageSendButton: value})}
								shortcut={<KeyboardKey>↵</KeyboardKey>}
							/>
						</SwitchGroup>
					</div>
				</SettingsTabSection>
			)}
		</>
	);
});
