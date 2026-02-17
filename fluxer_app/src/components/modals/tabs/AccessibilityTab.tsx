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
import {Message} from '@app/components/channel/Message';
import {SettingsSection} from '@app/components/modals/shared/SettingsSection';
import {SettingsTabContainer, SettingsTabContent} from '@app/components/modals/shared/SettingsTabLayout';
import styles from '@app/components/modals/tabs/AccessibilityTab.module.css';
import {AnimationTabContent} from '@app/components/modals/tabs/accessibility_tab/AnimationTab';
import {KeyboardTabContent} from '@app/components/modals/tabs/accessibility_tab/KeyboardTab';
import {MotionTabContent} from '@app/components/modals/tabs/accessibility_tab/MotionTab';
import {VisualTabContent} from '@app/components/modals/tabs/accessibility_tab/VisualTab';
import {Button} from '@app/components/uikit/button/Button';
import {MockAvatar} from '@app/components/uikit/MockAvatar';
import {Slider} from '@app/components/uikit/Slider';
import {ChannelRecord} from '@app/records/ChannelRecord';
import {MessageRecord} from '@app/records/MessageRecord';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import ChannelStore from '@app/stores/ChannelStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import UserStore from '@app/stores/UserStore';
import TtsUtils from '@app/utils/TtsUtils';
import {MessagePreviewContext, MessageStates, MessageTypes} from '@fluxer/constants/src/ChannelConstants';
import {StatusTypes} from '@fluxer/constants/src/StatusConstants';
import {useLingui} from '@lingui/react/macro';
import {PauseIcon, PlayIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';

export const AccessibilityTabPreview = observer(() => {
	const {t} = useLingui();
	const alwaysUnderlineLinks = AccessibilityStore.alwaysUnderlineLinks;

	const fakeData = useMemo(() => {
		const tabOpenedAt = new Date();
		const currentUser = UserStore.getCurrentUser();
		const author = currentUser?.toJSON() || {
			id: '1000000000000000050',
			username: 'PreviewUser',
			discriminator: '0000',
			global_name: 'Preview User',
			avatar: null,
			avatar_color: null,
			bot: false,
			system: false,
			flags: 0,
		};

		const fakeChannel = new ChannelRecord({
			id: '1000000000000000051',
			type: 0,
			name: 'accessibility-preview',
			position: 0,
			parent_id: null,
			topic: null,
			url: null,
			nsfw: false,
			last_message_id: null,
			last_pin_timestamp: null,
			bitrate: null,
			user_limit: null,
			permission_overwrites: [],
		});

		const fakeMessage = new MessageRecord(
			{
				id: '1000000000000000052',
				channel_id: '1000000000000000051',
				author,
				type: MessageTypes.DEFAULT,
				flags: 0,
				pinned: false,
				mention_everyone: false,
				content: t`This shows how links appear: https://fluxer.app`,
				timestamp: tabOpenedAt.toISOString(),
				state: MessageStates.SENT,
			},
			{skipUserCache: true},
		);

		return {fakeChannel, fakeMessage};
	}, []);

	useEffect(() => {
		ChannelStore.handleChannelCreate({channel: fakeData.fakeChannel.toJSON()});
		return () => {
			ChannelStore.handleChannelDelete({channel: fakeData.fakeChannel.toJSON()});
		};
	}, [fakeData.fakeChannel]);

	return (
		<div className={styles.previewWrapper}>
			<div className={styles.previewContainer}>
				<div className={styles.previewActionsRow}>
					<Button small={true} onClick={() => {}}>
						{t`Preview Button`}
					</Button>
					<div className={styles.previewAvatarsRow}>
						<MockAvatar size={32} status={StatusTypes.ONLINE} />
						<MockAvatar size={32} status={StatusTypes.DND} />
						<MockAvatar size={32} status={StatusTypes.IDLE} />
					</div>
				</div>
				<div className={styles.previewMessageContainer}>
					<Message
						channel={fakeData.fakeChannel}
						message={fakeData.fakeMessage}
						previewContext={MessagePreviewContext.SETTINGS}
						previewOverrides={{
							usernameColor: '#e91e63',
							...(alwaysUnderlineLinks
								? {
										linkStyle: 'always-underline',
									}
								: {}),
						}}
					/>
				</div>
			</div>
		</div>
	);
});

const TTS_RATE_MARKERS = [0.1, 0.5, 1.0, 1.5, 2.0];
const TTS_RATE_LABEL_ID = 'tts-rate-slider-label';

export const AccessibilityTab: React.FC = observer(() => {
	const {t} = useLingui();
	const ttsRate = AccessibilityStore.ttsRate;
	const [isSpeaking, setIsSpeaking] = useState(false);
	const previewMessage = t`Doc, I'm from the future. I came here in a time machine that you invented. Now, I need your help to get back to the year 1985.`;

	const speechReady = TtsUtils.isSupported() && TtsUtils.hasVoices();

	const handlePreviewToggle = useCallback(() => {
		if (isSpeaking) {
			TtsUtils.stop();
			setIsSpeaking(false);
			return;
		}

		if (!speechReady) return;

		TtsUtils.speak(previewMessage, {
			rate: ttsRate,
			onEnd: () => setIsSpeaking(false),
		});
		setIsSpeaking(true);
	}, [isSpeaking, previewMessage, speechReady, ttsRate]);

	const handleRateChange = useCallback(
		(value: number) => {
			AccessibilityActionCreators.update({ttsRate: value});
			if (isSpeaking) {
				TtsUtils.stop();
				setIsSpeaking(false);
			}
		},
		[isSpeaking],
	);

	const renderMarkerLabel = useCallback(
		(value: number) => {
			if (value === 0.1) return t`Slower`;
			if (value === 1.0) return `x${value.toFixed(1)}`;
			if (value === 2.0) return t`Faster`;
			return null;
		},
		[t],
	);

	useEffect(() => {
		return () => {
			TtsUtils.stop();
		};
	}, []);

	return (
		<SettingsTabContainer>
			{!MobileLayoutStore.enabled && <AccessibilityTabPreview />}
			<SettingsTabContent>
				<SettingsSection
					id="visual"
					title={t`Visual`}
					description={t`Customize visual elements to improve visibility and readability.`}
				>
					<VisualTabContent />
				</SettingsSection>

				<SettingsSection
					id="tts"
					title={t`Text-to-speech`}
					description={t`Control how text is spoken and preview the reading rate.`}
				>
					<div className={styles.ttsSection}>
						<div className={styles.ttsSliderRow}>
							<div>
								<p id={TTS_RATE_LABEL_ID} className={styles.ttsSliderLabel}>
									{t`Speech playback speed`}
								</p>
								<p className={styles.ttsSliderDescription}>
									{t`Slide toward a relaxed cadence or a brisk delivery for any spoken text.`}
								</p>
							</div>
							<Slider
								className={styles.ttsSlider}
								defaultValue={ttsRate}
								value={ttsRate}
								minValue={0.1}
								maxValue={2.0}
								factoryDefaultValue={1.0}
								markers={TTS_RATE_MARKERS}
								markerPosition="above"
								ariaLabelledBy={TTS_RATE_LABEL_ID}
								onValueChange={handleRateChange}
								asValueChanges={handleRateChange}
								onValueRender={(value) => `x${value.toFixed(1)}`}
								onMarkerRender={renderMarkerLabel}
							/>
						</div>
						<div className={styles.ttsPreviewRow}>
							<Button
								className={styles.ttsPreviewButton}
								leftIcon={isSpeaking ? <PauseIcon size={16} weight="fill" /> : <PlayIcon size={16} weight="fill" />}
								onClick={handlePreviewToggle}
								disabled={!isSpeaking && !speechReady}
								small={true}
							>
								{isSpeaking ? t`Silence sample` : t`Play sample`}
							</Button>
							<p className={styles.ttsPreviewDescription}>
								{speechReady
									? t`Hear the sample line spoken with your chosen speed.`
									: t`Speech synthesis is unavailable in your browser.`}
							</p>
						</div>
					</div>
				</SettingsSection>

				<SettingsSection id="keyboard" title={t`Keyboard`} description={t`Customize keyboard navigation behavior.`}>
					<KeyboardTabContent />
				</SettingsSection>

				<SettingsSection
					id="animation"
					title={t`Animation`}
					description={t`Control animated content throughout the app.`}
				>
					<AnimationTabContent />
				</SettingsSection>

				<SettingsSection
					id="motion"
					title={t`Motion`}
					description={t`Control animations and transitions throughout the app.`}
				>
					<MotionTabContent />
				</SettingsSection>
			</SettingsTabContent>
		</SettingsTabContainer>
	);
});
