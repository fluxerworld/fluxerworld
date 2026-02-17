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

import * as MessageActionCreators from '@app/actions/MessageActionCreators';
import * as PrivateChannelActionCreators from '@app/actions/PrivateChannelActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {Input} from '@app/components/form/Input';
import * as Modal from '@app/components/modals/Modal';
import styles from '@app/components/modals/ShareThemeModal.module.css';
import {CopyLinkSection} from '@app/components/modals/shared/CopyLinkSection';
import type {RecipientItem} from '@app/components/modals/shared/RecipientList';
import {RecipientList, useRecipientItems} from '@app/components/modals/shared/RecipientList';
import selectorStyles from '@app/components/modals/shared/SelectorModalStyles.module.css';
import {Spinner} from '@app/components/uikit/Spinner';
import {Endpoints} from '@app/Endpoints';
import HttpClient from '@app/lib/HttpClient';
import {Logger} from '@app/lib/Logger';
import {Routes} from '@app/Routes';
import RuntimeConfigStore from '@app/stores/RuntimeConfigStore';
import {useCopyLinkHandler} from '@app/utils/CopyLinkHandlers';
import * as SnowflakeUtils from '@fluxer/snowflake/src/SnowflakeUtils';
import {Trans, useLingui} from '@lingui/react/macro';
import {MagnifyingGlassIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useEffect, useState} from 'react';

const logger = new Logger('ShareThemeModal');

export const ShareThemeModal = observer(({themeCss}: {themeCss: string}) => {
	const {t} = useLingui();
	const [themeUrl, setThemeUrl] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [sentTo, setSentTo] = useState(new Map<string, boolean>());
	const [sendingTo, setSendingTo] = useState(new Set<string>());
	const recipients = useRecipientItems();
	const [searchQuery, setSearchQuery] = useState('');

	useEffect(() => {
		let cancelled = false;

		const createShareLink = async () => {
			setLoading(true);
			setThemeUrl(null);

			try {
				const response = await HttpClient.post<{id: string}>({
					url: Endpoints.USER_THEMES,
					body: {
						css: themeCss,
					},
				});

				const themeId = response.body?.id;
				if (!themeId) {
					throw new Error('Missing theme id');
				}

				if (cancelled) return;

				const origin = RuntimeConfigStore.webAppBaseUrl;
				setThemeUrl(`${origin.replace(/\/$/, '')}${Routes.theme(themeId)}`);
			} catch (error) {
				logger.error('Failed to create theme share link:', error);
				if (!cancelled) {
					ToastActionCreators.error(t`Failed to generate theme link.`);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		};

		void createShareLink();

		return () => {
			cancelled = true;
		};
	}, [themeCss, RuntimeConfigStore.webAppBaseUrl]);

	const handleCopy = useCopyLinkHandler(themeUrl, true);

	const handleSendTheme = async (item: RecipientItem) => {
		if (!themeUrl) return;

		const userId = item.type === 'group_dm' ? item.id : item.user.id;

		setSendingTo((prev) => new Set(prev).add(userId));

		let targetChannelId: string;
		if (item.channelId) {
			targetChannelId = item.channelId;
		} else {
			targetChannelId = await PrivateChannelActionCreators.ensureDMChannel(item.user.id);
		}

		try {
			const result = await MessageActionCreators.send(targetChannelId, {
				content: `${t`Check out my custom theme!`}\n${themeUrl}`,
				nonce: SnowflakeUtils.fromTimestamp(Date.now()),
			});

			if (result) {
				setSentTo((prev) => new Map(prev).set(userId, true));
			}
		} catch (error) {
			logger.error('Failed to send theme link:', error);
			ToastActionCreators.error(t`Failed to send theme link. Please try again.`);
		} finally {
			setSendingTo((prev) => {
				const next = new Set(prev);
				next.delete(userId);
				return next;
			});
		}
	};

	return (
		<Modal.Root size="small" centered>
			<Modal.Header title={t`Share Your Theme`}>
				<div className={selectorStyles.headerSearch}>
					<Input
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder={t`Search friends`}
						leftIcon={<MagnifyingGlassIcon size={20} weight="bold" className={selectorStyles.searchIcon} />}
						className={selectorStyles.headerSearchInput}
					/>
				</div>
			</Modal.Header>
			<Modal.Content className={selectorStyles.selectorContent}>
				{loading ? (
					<div className={styles.loadingContainer}>
						<Spinner />
					</div>
				) : (
					<RecipientList
						recipients={recipients}
						sendingTo={sendingTo}
						sentTo={sentTo}
						onSend={handleSendTheme}
						defaultButtonLabel={t`Send`}
						sentButtonLabel={t`Sent`}
						buttonClassName={styles.sendButton}
						scrollerKey="share-theme-modal-friend-list-scroller"
						searchQuery={searchQuery}
						onSearchQueryChange={setSearchQuery}
						showSearchInput={false}
					/>
				)}
			</Modal.Content>
			<Modal.Footer>
				<CopyLinkSection
					label={<Trans>Or copy the link:</Trans>}
					value={themeUrl || ''}
					onCopy={handleCopy}
					onInputClick={(e) => e.currentTarget.select()}
				/>
			</Modal.Footer>
		</Modal.Root>
	);
});
