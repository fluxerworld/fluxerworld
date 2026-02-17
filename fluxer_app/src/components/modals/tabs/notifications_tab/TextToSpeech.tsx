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
import {Switch} from '@app/components/form/Switch';
import styles from '@app/components/modals/tabs/notifications_tab/TextToSpeech.module.css';
import {RadioGroup, type RadioOption} from '@app/components/uikit/radio_group/RadioGroup';
import {ComponentDispatch} from '@app/lib/ComponentDispatch';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import NotificationStore, {TTSNotificationMode} from '@app/stores/NotificationStore';
import {Trans, useLingui} from '@lingui/react/macro';
import {InfoIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useCallback} from 'react';

export const TextToSpeech = observer(() => {
	const {t} = useLingui();

	const handleToggleTtsCommand = useCallback((value: boolean) => {
		AccessibilityActionCreators.update({enableTTSCommand: value});
	}, []);

	const handleAccessibilityLinkClick = useCallback(() => {
		ComponentDispatch.dispatch('USER_SETTINGS_TAB_SELECT', {tab: 'accessibility'});
	}, []);

	const ttsNotificationMode = NotificationStore.getTTSNotificationMode();

	const ttsNotificationOptions: Array<RadioOption<TTSNotificationMode>> = [
		{
			value: TTSNotificationMode.FOR_ALL_CHANNELS,
			name: t`Every Channel`,
			desc: t`Let every incoming message be spoken, regardless of which channel is open.`,
		},
		{
			value: TTSNotificationMode.FOR_CURRENT_CHANNEL,
			name: t`Only This Channel`,
			desc: t`Only narrate messages that arrive in the channel you are currently in.`,
		},
		{
			value: TTSNotificationMode.NEVER,
			name: t`Never Automatically`,
			desc: t`Remain silent unless someone runs /tts manually.`,
		},
	];

	const handleTtsNotificationChange = useCallback((value: TTSNotificationMode) => {
		NotificationStore.setTTSNotificationMode(value);
	}, []);

	return (
		<div className={styles.container}>
			<Switch
				label={t`Enable /tts Speech Playback`}
				description={t`Let /tts read your message aloud; disabling the setting keeps those commands as regular text.`}
				value={AccessibilityStore.enableTTSCommand}
				onChange={handleToggleTtsCommand}
			/>
			<div className={styles.helperCallout}>
				<InfoIcon size={16} weight="fill" className={styles.helperIcon} />
				<p className={styles.helperText}>
					<Trans>
						Adjust playback speed in{' '}
						<button type="button" className={styles.linkButton} onClick={handleAccessibilityLinkClick}>
							Accessibility
						</button>
						.
					</Trans>
				</p>
			</div>

			<div className={styles.narrationSection}>
				<div className={styles.narrationHeader}>
					<h3 className={styles.narrationTitle}>{t`Automatic message narration`}</h3>
					<p className={styles.narrationDescription}>
						{t`Converts incoming content to speech, regardless of whether it came from /tts.`}
					</p>
				</div>
				<RadioGroup
					options={ttsNotificationOptions}
					value={ttsNotificationMode}
					onChange={handleTtsNotificationChange}
					aria-label={t`Speak all messages out loud`}
				/>
			</div>
		</div>
	);
});
