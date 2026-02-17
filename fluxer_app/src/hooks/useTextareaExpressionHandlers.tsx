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

import type {Gif} from '@app/actions/GifActionCreators';
import {ComponentDispatch} from '@app/lib/ComponentDispatch';
import type {FavoriteMemeRecord} from '@app/records/FavoriteMemeRecord';
import type {GuildStickerRecord} from '@app/records/GuildStickerRecord';
import UserStore from '@app/stores/UserStore';
import * as KlipyUtils from '@app/utils/KlipyUtils';
import * as TenorUtils from '@app/utils/TenorUtils';
import type {MentionSegment} from '@app/utils/TextareaSegmentManager';
import type {MessageAttachment, MessageStickerItem} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {useEffect} from 'react';

interface UseTextareaExpressionHandlersOptions {
	setValue: React.Dispatch<React.SetStateAction<string>>;
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
	canSendFavoriteMemeId: boolean;
	insertSegment: (
		text: string,
		position: number,
		displayText: string,
		actualText: string,
		type: MentionSegment['type'],
		id: string,
	) => {newText: string; newSegments: Array<MentionSegment>};
	previousValueRef: React.MutableRefObject<string>;
	sendOptimisticMessage: (
		messageData: {content: string; stickers?: Array<MessageStickerItem>; attachments?: Array<MessageAttachment>},
		sendOptions: {hasAttachments: boolean; favoriteMemeId?: string},
	) => void;
}

export const useTextareaExpressionHandlers = ({
	setValue,
	textareaRef,
	canSendFavoriteMemeId,
	insertSegment,
	previousValueRef,
	sendOptimisticMessage,
}: UseTextareaExpressionHandlersOptions) => {
	useEffect(() => {
		const handleGifSelect = (payload?: unknown) => {
			const {gif, autoSend} = (payload ?? {}) as {gif?: Gif; autoSend?: boolean};
			if (!gif) return;
			const gifUrl = KlipyUtils.resolveKlipyShareUrl({url: gif.url});
			if (autoSend) {
				sendOptimisticMessage({content: gifUrl}, {hasAttachments: false});
			} else {
				setValue((prevValue) => `${prevValue}${prevValue.length === 0 ? '' : ' '}${gifUrl} `);
				textareaRef.current?.focus();
			}
		};

		return ComponentDispatch.subscribe('GIF_SELECT', handleGifSelect);
	}, [sendOptimisticMessage, setValue, textareaRef]);

	useEffect(() => {
		const handleStickerSelect = (payload?: unknown) => {
			const {sticker} = (payload ?? {}) as {sticker?: GuildStickerRecord};
			if (!sticker) return;
			sendOptimisticMessage({content: '', stickers: [sticker.toJSON()]}, {hasAttachments: false});
		};

		return ComponentDispatch.subscribe('STICKER_SELECT', handleStickerSelect);
	}, [sendOptimisticMessage]);

	useEffect(() => {
		const handleFavoriteMemeSelect = (payload?: unknown) => {
			const {meme, autoSend} = (payload ?? {}) as {meme?: FavoriteMemeRecord; autoSend?: boolean};
			if (!meme) return;
			const insertMemeUrl = () => {
				setValue((prevValue) => `${prevValue}${prevValue.length === 0 ? '' : ' '}${meme.url} `);
				textareaRef.current?.focus();
			};

			if (autoSend) {
				if (meme.klipySlug) {
					const klipyUrl = KlipyUtils.buildKlipyShareUrl({slug: meme.klipySlug});
					sendOptimisticMessage({content: klipyUrl}, {hasAttachments: false});
				} else if (meme.tenorSlugId) {
					const tenorUrl = TenorUtils.buildTenorShareUrl(meme.tenorSlugId);
					sendOptimisticMessage({content: tenorUrl}, {hasAttachments: false});
				} else if (canSendFavoriteMemeId) {
					const uploadingAttachment = {
						id: 'uploading',
						filename: meme.filename,
						title: meme.name,
						size: meme.size,
						url: '',
						proxy_url: '',
						content_type: meme.contentType,
						flags: 0x1000,
					};

					sendOptimisticMessage(
						{content: '', attachments: [uploadingAttachment]},
						{hasAttachments: false, favoriteMemeId: meme.id},
					);
				} else {
					insertMemeUrl();
				}
			} else {
				if (meme.klipySlug) {
					const klipyUrl = KlipyUtils.buildKlipyShareUrl({slug: meme.klipySlug});
					setValue((prevValue) => `${prevValue}${prevValue.length === 0 ? '' : ' '}${klipyUrl} `);
				} else if (meme.tenorSlugId) {
					const tenorUrl = TenorUtils.buildTenorShareUrl(meme.tenorSlugId);
					setValue((prevValue) => `${prevValue}${prevValue.length === 0 ? '' : ' '}${tenorUrl} `);
				} else {
					insertMemeUrl();
				}
				textareaRef.current?.focus();
			}
		};

		return ComponentDispatch.subscribe('FAVORITE_MEME_SELECT', handleFavoriteMemeSelect);
	}, [canSendFavoriteMemeId, sendOptimisticMessage, setValue, textareaRef]);

	useEffect(() => {
		const handleInsertMention = (payload?: unknown) => {
			const {userId} = (payload ?? {}) as {userId?: string};
			if (!userId) return;
			setValue((prevValue) => {
				const user = UserStore.getUser(userId);
				if (!user) {
					return prevValue;
				}

				const actualText = `<@${userId}>`;
				const displayText = `@${user.tag}`;
				const needsSpace = prevValue.length > 0 && !prevValue.endsWith(' ');
				const prefix = prevValue.length === 0 ? '' : needsSpace ? ' ' : '';
				const insertPosition = prevValue.length + prefix.length;

				const {newText} = insertSegment(prevValue + prefix, insertPosition, displayText, actualText, 'user', userId);

				if (previousValueRef.current !== null) {
					previousValueRef.current = newText;
				}
				return newText;
			});
			textareaRef.current?.focus();
		};

		return ComponentDispatch.subscribe('INSERT_MENTION', handleInsertMention);
	}, [insertSegment, previousValueRef, setValue, textareaRef]);
};
