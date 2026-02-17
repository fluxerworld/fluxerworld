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

import * as CallActionCreators from '@app/actions/CallActionCreators';
import styles from '@app/components/channel/CallMessage.module.css';
import {useCallHeaderState} from '@app/components/channel/channel_view/useCallHeaderState';
import {SystemMessage} from '@app/components/channel/SystemMessage';
import {SystemMessageUsername} from '@app/components/channel/SystemMessageUsername';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {useSystemMessageData} from '@app/hooks/useSystemMessageData';
import type {MessageRecord} from '@app/records/MessageRecord';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import {getCurrentLocale} from '@app/utils/LocaleUtils';
import {formatListWithConfig} from '@fluxer/list_utils/src/ListFormatting';
import {formatNumber} from '@fluxer/number_utils/src/NumberFormatting';
import type {I18n, MessageDescriptor} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {PhoneIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback} from 'react';

type DurationUnit = 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute';

const DURATION_UNITS: Array<{unit: DurationUnit; minutes: number}> = [
	{unit: 'year', minutes: 525600},
	{unit: 'month', minutes: 43800},
	{unit: 'week', minutes: 10080},
	{unit: 'day', minutes: 1440},
	{unit: 'hour', minutes: 60},
	{unit: 'minute', minutes: 1},
];

const formatLocalizedNumber = (value: number): string => {
	const locale = getCurrentLocale();
	return formatNumber(value, locale);
};

const replaceCountPlaceholder = (text: string, count: number): string => {
	if (!text.includes('#')) {
		return text;
	}
	return text.replace(/#/g, formatLocalizedNumber(count));
};

const DURATION_UNIT_LABELS: Record<DurationUnit, {singular: MessageDescriptor; plural: MessageDescriptor}> = {
	year: {singular: msg`1 year`, plural: msg`# years`},
	month: {singular: msg`1 month`, plural: msg`# months`},
	week: {singular: msg`1 week`, plural: msg`# weeks`},
	day: {singular: msg`1 day`, plural: msg`# days`},
	hour: {singular: msg`1 hour`, plural: msg`# hours`},
	minute: {singular: msg`a minute`, plural: msg`# minutes`},
};

const formatDurationUnit = (i18n: I18n, value: number, unit: DurationUnit): string => {
	const descriptors = DURATION_UNIT_LABELS[unit] ?? DURATION_UNIT_LABELS.minute;
	const descriptor = value === 1 ? descriptors.singular : descriptors.plural;
	return replaceCountPlaceholder(i18n._(descriptor), value);
};

const FEW_SECONDS_DESCRIPTOR = msg`a few seconds`;

const formatCallDuration = (i18n: I18n, durationSeconds: number): string => {
	if (durationSeconds < 60) {
		return i18n._(FEW_SECONDS_DESCRIPTOR);
	}

	const roundedMinutes = Math.max(1, Math.ceil(durationSeconds / 60));
	const parts: Array<string> = [];
	let remainingMinutes = roundedMinutes;

	for (const {unit, minutes} of DURATION_UNITS) {
		if (remainingMinutes < minutes) continue;
		const count = Math.floor(remainingMinutes / minutes);
		remainingMinutes -= count * minutes;
		parts.push(formatDurationUnit(i18n, count, unit));
	}

	if (parts.length === 0) {
		return i18n._(DURATION_UNIT_LABELS.minute.singular);
	}

	const locale = getCurrentLocale();
	return formatListWithConfig(parts, {locale, style: 'long', type: 'conjunction'});
};

export const CallMessage = observer(({message}: {message: MessageRecord}) => {
	const {t, i18n} = useLingui();
	const {author, channel, guild} = useSystemMessageData(message);
	const currentUserId = AuthenticationStore.currentUserId;
	const callData = message.call;
	const isLocalConnected = channel ? MediaEngineStore.connected && MediaEngineStore.channelId === channel.id : false;
	const callHeaderState = useCallHeaderState(channel);
	const shouldShowJoinLink =
		!isLocalConnected &&
		!callHeaderState.isDeviceInRoomForChannelCall &&
		!callHeaderState.isDeviceConnectingToChannelCall &&
		callHeaderState.callExistsAndOngoing &&
		callHeaderState.controlsVariant === 'join';

	const handleJoinCall = useCallback(() => {
		if (!channel) return;
		CallActionCreators.joinCall(channel.id);
	}, [channel]);

	if (!channel || !callData) {
		return null;
	}
	const callEnded = callData.endedTimestamp != null;
	const participantIds = callData.participants;
	const includesCurrentUser = Boolean(currentUserId && participantIds.includes(currentUserId));
	const authorIsCurrentUser = author.id === currentUserId;
	const isMissedCall = callEnded && !includesCurrentUser && !authorIsCurrentUser;
	const durationText =
		callEnded && callData.endedTimestamp
			? formatCallDuration(i18n, Math.max(0, (callData.endedTimestamp.getTime() - message.timestamp.getTime()) / 1000))
			: t`a few seconds`;

	let messageContent: React.ReactNode;
	if (!callEnded) {
		messageContent = (
			<>
				<Trans>
					<SystemMessageUsername key={author.id} author={author} guild={guild} message={message} /> started a call.
				</Trans>
				{shouldShowJoinLink && (
					<>
						<span className={styles.separator} aria-hidden="true">
							&nbsp;—&nbsp;
						</span>
						<FocusRing offset={-2}>
							<button type="button" className={styles.callLink} onClick={handleJoinCall}>
								{t`Join the call`}
							</button>
						</FocusRing>
					</>
				)}
			</>
		);
	} else if (isMissedCall) {
		messageContent = durationText ? (
			<Trans>
				You missed a call from <SystemMessageUsername key={author.id} author={author} guild={guild} message={message} />{' '}
				that lasted {durationText}.
			</Trans>
		) : (
			<Trans>
				You missed a call from <SystemMessageUsername key={author.id} author={author} guild={guild} message={message} />
				.
			</Trans>
		);
	} else {
		messageContent = (
			<Trans>
				<SystemMessageUsername key={author.id} author={author} guild={guild} message={message} /> started a call that
				lasted {durationText}.
			</Trans>
		);
	}

	const iconClassname = clsx(
		styles.icon,
		callEnded ? (isMissedCall ? styles.iconMissed : styles.iconEnded) : styles.iconActive,
	);

	return (
		<SystemMessage
			icon={PhoneIcon}
			iconWeight="fill"
			iconClassname={iconClassname}
			message={message}
			messageContent={messageContent}
		/>
	);
});
