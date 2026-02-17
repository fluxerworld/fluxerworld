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
import * as GifActionCreators from '@app/actions/GifActionCreators';
import * as HighlightActionCreators from '@app/actions/HighlightActionCreators';
import * as ReactionActionCreators from '@app/actions/ReactionActionCreators';
import {
	type AutocompleteOption,
	type AutocompleteType,
	isChannel,
	isCommand,
	isEmoji,
	isGif,
	isMeme,
	isMentionMember,
	isMentionRole,
	isMentionUser,
	isSpecialMention,
	isSticker,
} from '@app/components/channel/Autocomplete';
import type {Command} from '@app/hooks/useCommands';
import {useCommands} from '@app/hooks/useCommands';
import {ComponentDispatch} from '@app/lib/ComponentDispatch';
import {Logger} from '@app/lib/Logger';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {GuildMemberRecord} from '@app/records/GuildMemberRecord';
import type {GuildStickerRecord} from '@app/records/GuildStickerRecord';
import type {UserRecord} from '@app/records/UserRecord';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import ChannelStore from '@app/stores/ChannelStore';
import EmojiPickerStore from '@app/stores/EmojiPickerStore';
import EmojiStore from '@app/stores/EmojiStore';
import FavoriteMemeStore from '@app/stores/FavoriteMemeStore';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import GuildStore from '@app/stores/GuildStore';
import type {SearchContext} from '@app/stores/MemberSearchStore';
import MemberSearchStore from '@app/stores/MemberSearchStore';
import MemesPickerStore from '@app/stores/MemesPickerStore';
import MessageStore from '@app/stores/MessageStore';
import PermissionStore from '@app/stores/PermissionStore';
import StickerPickerStore from '@app/stores/StickerPickerStore';
import StickerStore from '@app/stores/StickerStore';
import UserStore from '@app/stores/UserStore';
import {filterEmojisForAutocomplete, filterStickersForAutocomplete} from '@app/utils/ExpressionPermissionUtils';
import * as KlipyUtils from '@app/utils/KlipyUtils';
import {toReactionEmoji} from '@app/utils/ReactionUtils';
import {detectAutocompleteTrigger, filterCommandsByQuery, getCommandInsertionText} from '@app/utils/SlashCommandUtils';
import type {MentionSegment} from '@app/utils/TextareaSegmentManager';
import {ChannelTypes, Permissions} from '@fluxer/constants/src/ChannelConstants';
import type {UserId} from '@fluxer/schema/src/branded/WireIds';
import type {I18n} from '@lingui/core';
import {useLingui} from '@lingui/react/macro';
import {matchSorter} from 'match-sorter';
import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';

const logger = new Logger('useTextareaAutocomplete');

interface UseTextareaAutocompleteReturn {
	autocompleteOptions: Array<AutocompleteOption>;
	autocompleteType: AutocompleteType;
	selectedIndex: number;
	isAutocompleteAttached: boolean;
	setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
	onCursorMove: () => void;
	handleSelect: (option: AutocompleteOption) => void;
	autocompleteQuery: string;
	isMemberSearchLoading: boolean;
}

const MEMBER_SEARCH_LIMIT = 25;

interface ParsedMentionQuery {
	usernameQuery: string;
	tagQuery: string | null;
	hasTagSeparator: boolean;
}

function parseMentionQuery(query: string): ParsedMentionQuery {
	const hashIndex = query.indexOf('#');
	if (hashIndex === -1) {
		return {
			usernameQuery: query,
			tagQuery: null,
			hasTagSeparator: false,
		};
	}
	return {
		usernameQuery: query['slice'](0, hashIndex),
		tagQuery: query['slice'](hashIndex + 1),
		hasTagSeparator: true,
	};
}

function filterDMUsers(
	users: Array<UserRecord>,
	parsedQuery: ParsedMentionQuery,
): Array<{type: 'mention'; kind: 'user'; user: UserRecord}> {
	let matchedUsers: typeof users;
	if (parsedQuery.hasTagSeparator) {
		const usernameQueryLower = parsedQuery.usernameQuery.toLowerCase();
		const tagQueryLower = parsedQuery.tagQuery?.toLowerCase() ?? '';
		matchedUsers = users.filter(
			(user) =>
				user.username.toLowerCase().startsWith(usernameQueryLower) &&
				(tagQueryLower === '' || user.discriminator.startsWith(tagQueryLower)),
		);
	} else {
		matchedUsers = matchSorter(users, parsedQuery.usernameQuery, {
			keys: ['username', 'tag'],
		});
	}

	return matchedUsers
		.map((user) => ({
			type: 'mention' as const,
			kind: 'user' as const,
			user,
		}))
		.sort((a, b) => a.user.username.toLowerCase().localeCompare(b.user.username.toLowerCase()))
		.slice(0, 10);
}

function filterGuildMembers(
	membersToUse: Array<GuildMemberRecord>,
	parsedQuery: ParsedMentionQuery,
	shouldCheckAccess: boolean,
	canViewChannel: (userId: string) => boolean,
): Array<{type: 'mention'; kind: 'member'; member: GuildMemberRecord}> {
	let matchedMembers: typeof membersToUse;
	if (parsedQuery.hasTagSeparator) {
		const usernameQueryLower = parsedQuery.usernameQuery.toLowerCase();
		const tagQueryLower = parsedQuery.tagQuery?.toLowerCase() ?? '';
		matchedMembers = membersToUse.filter(
			(member) =>
				(member.user.username.toLowerCase().startsWith(usernameQueryLower) ||
					member.nick?.toLowerCase().startsWith(usernameQueryLower)) &&
				(tagQueryLower === '' || member.user.discriminator.startsWith(tagQueryLower)) &&
				(!shouldCheckAccess || canViewChannel(member.user.id)),
		);
	} else {
		const filteredByAccess = shouldCheckAccess
			? membersToUse.filter((member) => canViewChannel(member.user.id))
			: membersToUse;
		matchedMembers = matchSorter(filteredByAccess, parsedQuery.usernameQuery, {
			keys: ['nick', 'user.username', 'user.tag'],
		});
	}

	return matchedMembers
		.map((member) => ({
			type: 'mention' as const,
			kind: 'member' as const,
			member,
		}))
		.sort((a, b) => a.member.user.username.toLowerCase().localeCompare(b.member.user.username.toLowerCase()))
		.slice(0, 10);
}

const SPECIAL_MENTIONS: ReadonlyArray<{type: 'mention'; kind: '@everyone' | '@here'}> = [
	{type: 'mention' as const, kind: '@everyone' as const},
	{type: 'mention' as const, kind: '@here' as const},
];

interface CommandArgContext {
	channel: ChannelRecord;
	commandName: string;
	matchedText: string | null;
	memberSearchResults: Array<GuildMemberRecord>;
	canManageUser: (otherUserId: string, permission: bigint) => boolean;
	canViewChannel: (userId: string) => boolean;
}

function buildCommandArgOptions(ctx: CommandArgContext): Array<AutocompleteOption> {
	const parsedQuery = parseMentionQuery(ctx.matchedText ?? '');

	if (ctx.commandName === 'msg') {
		if (!ctx.channel.guildId) {
			const users = ctx.channel.recipientIds
				.map((id) => UserStore.getUser(id))
				.filter((user): user is NonNullable<typeof user> => user != null);

			return filterDMUsers(users, parsedQuery);
		}
		const membersToUse =
			ctx.memberSearchResults.length > 0
				? ctx.memberSearchResults
				: GuildMemberStore.getMembers(ctx.channel.guildId ?? '');

		return filterGuildMembers(membersToUse, parsedQuery, true, ctx.canViewChannel);
	}

	const permission = ctx.commandName === 'kick' ? Permissions.KICK_MEMBERS : Permissions.BAN_MEMBERS;

	const membersToUse =
		ctx.memberSearchResults.length > 0
			? ctx.memberSearchResults
			: GuildMemberStore.getMembers(ctx.channel.guildId ?? '');

	const filteredMembers = membersToUse.filter((member) => ctx.canManageUser(member.user.id, permission));

	return filterGuildMembers(filteredMembers, parsedQuery, false, ctx.canViewChannel);
}

interface EmojiReactionContext {
	channel: ChannelRecord | null;
	matchedText: string | null;
	i18n: I18n;
}

function buildEmojiReactionOptions(ctx: EmojiReactionContext): Array<AutocompleteOption> {
	const query = ctx.matchedText?.trim() ?? '';
	const hasQuery = query.length > 0;

	const allEmojis = EmojiStore.search(ctx.channel ?? null, hasQuery ? query : '', hasQuery ? 10 : undefined);
	const filteredEmojis = filterEmojisForAutocomplete(ctx.i18n, allEmojis, ctx.channel ?? null);
	const emojis = hasQuery ? filteredEmojis : EmojiPickerStore.getFrecentEmojis(filteredEmojis, 10);

	return emojis.map((emoji) => ({
		type: 'emoji' as const,
		emoji,
	}));
}

interface EmojiPreferences {
	showDefaultEmojis: boolean;
	showCustomEmojis: boolean;
	showStickers: boolean;
	showMemes: boolean;
}

interface EmojiAutocompleteContext {
	channel: ChannelRecord | null;
	matchedText: string | null;
	i18n: I18n;
	prefs: EmojiPreferences;
}

function buildEmojiAutocompleteOptions(ctx: EmojiAutocompleteContext): Array<AutocompleteOption> {
	const query = ctx.matchedText?.trim() ?? '';
	const hasQuery = query.length > 0;
	const {showDefaultEmojis, showCustomEmojis, showStickers, showMemes} = ctx.prefs;

	const allEmojis =
		showDefaultEmojis || showCustomEmojis
			? EmojiStore.search(ctx.channel ?? null, hasQuery ? query : '', hasQuery ? 10 : undefined)
			: [];
	const permissionFiltered = filterEmojisForAutocomplete(ctx.i18n, allEmojis, ctx.channel ?? null);
	const filteredEmojis = permissionFiltered.filter((emoji) => {
		const isCustom = !!emoji.guildId;
		return (isCustom && showCustomEmojis) || (!isCustom && showDefaultEmojis);
	});

	const emojiResults =
		hasQuery || !(showDefaultEmojis || showCustomEmojis)
			? filteredEmojis
			: EmojiPickerStore.getFrecentEmojis(filteredEmojis, 5);

	const emojiOptions: Array<AutocompleteOption> = emojiResults.map((emoji) => ({
		type: 'emoji' as const,
		emoji,
	}));

	const allStickers = showStickers
		? StickerStore.searchWithChannel(ctx.channel ?? null, hasQuery ? query : '').slice(0, hasQuery ? 5 : undefined)
		: [];
	const filteredStickers = filterStickersForAutocomplete(ctx.i18n, allStickers, ctx.channel ?? null);
	const stickerResults = hasQuery
		? filteredStickers
		: showStickers
			? StickerPickerStore.getFrecentStickers(filteredStickers, 3)
			: [];

	const stickerOptions: Array<AutocompleteOption> = stickerResults.map((sticker) => ({
		type: 'sticker' as const,
		sticker,
	}));

	let memeOptions: Array<AutocompleteOption>;
	if (showMemes) {
		const allMemes = FavoriteMemeStore.getAllMemes();
		if (hasQuery) {
			memeOptions = matchSorter(allMemes, query, {
				keys: ['name', 'altText', 'filename', 'tags'],
				threshold: matchSorter.rankings.CONTAINS,
			})
				.slice(0, 5)
				.map((meme) => ({type: 'meme' as const, meme}));
		} else {
			memeOptions = MemesPickerStore.getFrecentMemes(allMemes, 3).map((meme) => ({type: 'meme' as const, meme}));
		}
	} else {
		memeOptions = [];
	}

	return [...emojiOptions, ...stickerOptions, ...memeOptions];
}

export type TriggerType =
	| 'mention'
	| 'channel'
	| 'emoji'
	| 'emojiReaction'
	| 'command'
	| 'meme'
	| 'gif'
	| 'sticker'
	| 'commandArgMention'
	| 'commandArg';

interface UseTextareaAutocompleteParams {
	channel: ChannelRecord | null;
	value: string;
	setValue: React.Dispatch<React.SetStateAction<string>>;
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
	segmentManagerRef: React.MutableRefObject<{
		displayToActual: (displayText: string) => string;
		insertSegment: (
			currentText: string,
			insertPosition: number,
			displayText: string,
			actualText: string,
			type: MentionSegment['type'],
			id: string,
		) => {newText: string};
		updateSegmentsForTextChange: (changeStart: number, changeEnd: number, replacementLength: number) => void;
		setSegments: (segments: Array<MentionSegment>) => void;
		getSegments: () => Array<MentionSegment>;
	}>;
	previousValueRef: React.MutableRefObject<string>;
	allowedTriggers?: Array<TriggerType>;
	maxActualLength?: number;
	onExceedMaxLength?: () => void;
}

export function useTextareaAutocomplete({
	channel,
	value,
	setValue,
	textareaRef,
	segmentManagerRef,
	previousValueRef,
	allowedTriggers,
	maxActualLength,
	onExceedMaxLength,
}: UseTextareaAutocompleteParams): UseTextareaAutocompleteReturn {
	const {i18n} = useLingui();
	const commands = useCommands();

	const [autocompleteOptions, setAutocompleteOptions] = useState<Array<AutocompleteOption>>([]);
	const [autocompleteType, setAutocompleteType] = useState<AutocompleteType>('mention');
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [valueUpToCursor, setValueUpToCursor] = useState('');
	const [expressionDataVersion, setExpressionDataVersion] = useState(0);

	const [gifState, setGifState] = useState<{
		status: 'idle' | 'loading' | 'success' | 'error';
		query: string;
		results: Array<Gif>;
	}>({
		status: 'idle',
		query: '',
		results: [],
	});

	const [memberSearchResults, setMemberSearchResults] = useState<Array<GuildMemberRecord>>([]);
	const [isMemberSearchLoading, setIsMemberSearchLoading] = useState(false);
	const permissionVersion = useSyncExternalStore(
		PermissionStore.subscribe.bind(PermissionStore),
		() => PermissionStore.version,
	);

	const gifCacheRef = useRef<Map<string, Array<Gif>>>(new Map());
	const currentSearchRef = useRef<string | null>(null);
	const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
	const searchContextRef = useRef<SearchContext | null>(null);
	const hasChannel = channel != null;
	const allowedTriggersToken = useMemo(() => {
		if (!allowedTriggers || allowedTriggers.length === 0) {
			return '';
		}
		return [...allowedTriggers].sort().join('|');
	}, [allowedTriggers]);
	const allowedTriggerSet = useMemo(() => {
		if (allowedTriggersToken.length === 0) {
			return null;
		}
		return new Set<TriggerType>(allowedTriggersToken.split('|') as Array<TriggerType>);
	}, [allowedTriggersToken]);

	const autocompleteTrigger = useMemo(() => {
		const trigger = detectAutocompleteTrigger(valueUpToCursor);
		if (!trigger) return null;

		if (!hasChannel && trigger.type !== 'emoji') {
			return null;
		}

		if (allowedTriggerSet && !allowedTriggerSet.has(trigger.type)) {
			return null;
		}
		return trigger;
	}, [allowedTriggerSet, hasChannel, valueUpToCursor]);
	const autocompleteTriggerType = autocompleteTrigger?.type ?? null;
	const autocompleteTriggerMatchedText = autocompleteTrigger?.matchedText ?? '';
	const autocompleteTriggerMatch2 = autocompleteTrigger?.match[2] ?? '';
	const autocompleteTriggerMatch3 = autocompleteTrigger?.match[3] ?? '';
	const autocompleteTriggerGifQuery = autocompleteTriggerType === 'gif' ? autocompleteTriggerMatch3.trim() : '';
	const autocompleteTriggerToken = autocompleteTrigger
		? `${autocompleteTrigger.type}:${autocompleteTrigger.match.index ?? -1}:${autocompleteTrigger.match[0]}:${autocompleteTrigger.matchedText}`
		: '';

	useEffect(() => {
		function handleExpressionDataUpdated(): void {
			setExpressionDataVersion((version) => version + 1);
		}

		const unsubscribeEmoji = ComponentDispatch.subscribe('EMOJI_PICKER_RERENDER', handleExpressionDataUpdated);
		const unsubscribeSticker = ComponentDispatch.subscribe('STICKER_PICKER_RERENDER', handleExpressionDataUpdated);

		return () => {
			unsubscribeEmoji();
			unsubscribeSticker();
		};
	}, []);

	useEffect(() => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
		}

		if (autocompleteTriggerType === 'gif') {
			const searchQuery = autocompleteTriggerGifQuery;

			if (!searchQuery) {
				currentSearchRef.current = null;
				setGifState({status: 'idle', query: '', results: []});
				return;
			}

			if (currentSearchRef.current === searchQuery) {
				return;
			}

			const cachedResults = gifCacheRef.current.get(searchQuery);
			if (cachedResults) {
				currentSearchRef.current = searchQuery;
				setGifState({status: 'success', query: searchQuery, results: cachedResults});
				return;
			}

			debounceTimerRef.current = setTimeout(() => {
				currentSearchRef.current = searchQuery;
				setGifState({status: 'loading', query: searchQuery, results: []});

				GifActionCreators.search(searchQuery)
					.then((gifs) => {
						gifCacheRef.current.set(searchQuery, gifs);
						setGifState({status: 'success', query: searchQuery, results: gifs});
					})
					.catch((error) => {
						logger.error('GIF search failed', error);
						setGifState({status: 'error', query: searchQuery, results: []});
					});
			}, 300);
		} else {
			currentSearchRef.current = null;
			setGifState((prev) => {
				if (prev.status === 'idle') return prev;
				return {status: 'idle', query: '', results: []};
			});
		}

		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, [autocompleteTriggerGifQuery, autocompleteTriggerType]);

	const currentGuildIdRef = useRef<string | null>(null);
	const memberFetchDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		const context = MemberSearchStore.getSearchContext((results) => {
			const guildId = currentGuildIdRef.current;
			const guildMemberRecords: Array<GuildMemberRecord> = results
				.map((transformed) => {
					if (guildId) {
						const member = GuildMemberStore.getMember(guildId, transformed.id);
						return member ?? null;
					}
					const guilds = GuildStore.getGuilds();
					for (const guild of guilds) {
						const member = GuildMemberStore.getMember(guild.id, transformed.id);
						if (member) {
							return member;
						}
					}
					return null;
				})
				.filter((m): m is GuildMemberRecord => m !== null);

			setMemberSearchResults(guildMemberRecords);
			setIsMemberSearchLoading(false);
		}, MEMBER_SEARCH_LIMIT);

		searchContextRef.current = context;

		return () => {
			context.destroy();
			searchContextRef.current = null;
			if (memberFetchDebounceTimerRef.current) {
				clearTimeout(memberFetchDebounceTimerRef.current);
				memberFetchDebounceTimerRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		const context = searchContextRef.current;
		if (!context) return;

		const isMentionTrigger =
			autocompleteTriggerType === 'mention' ||
			autocompleteTriggerType === 'commandArgMention' ||
			autocompleteTriggerType === 'commandArg';

		if (!isMentionTrigger || !channel?.guildId) {
			currentGuildIdRef.current = null;
			context.clearQuery();
			setMemberSearchResults([]);
			setIsMemberSearchLoading(false);
			if (memberFetchDebounceTimerRef.current) {
				clearTimeout(memberFetchDebounceTimerRef.current);
				memberFetchDebounceTimerRef.current = null;
			}
			return;
		}

		const searchQuery = autocompleteTriggerMatchedText;
		const guildId = channel.guildId;
		const isGuildFullyLoaded = GuildMemberStore.isGuildFullyLoaded(guildId);

		currentGuildIdRef.current = guildId;

		const cachedMembers = GuildMemberStore.getMembers(guildId);
		if (cachedMembers.length > 0) {
			const cachedMatches = matchSorter(cachedMembers, searchQuery, {
				keys: ['nick', 'user.username', 'user.tag'],
			}).slice(0, MEMBER_SEARCH_LIMIT);
			setMemberSearchResults(cachedMatches);
		} else {
			setMemberSearchResults([]);
		}

		if (isGuildFullyLoaded) {
			context.clearQuery();
			setMemberSearchResults([]);
			setIsMemberSearchLoading(false);
			if (memberFetchDebounceTimerRef.current) {
				clearTimeout(memberFetchDebounceTimerRef.current);
				memberFetchDebounceTimerRef.current = null;
			}
			return;
		}

		setIsMemberSearchLoading(true);
		context.setQuery(searchQuery);

		if (memberFetchDebounceTimerRef.current) {
			clearTimeout(memberFetchDebounceTimerRef.current);
		}

		memberFetchDebounceTimerRef.current = setTimeout(() => {
			void MemberSearchStore.fetchMembersInBackground(searchQuery, [guildId]);
			memberFetchDebounceTimerRef.current = null;
		}, 300);
	}, [autocompleteTriggerMatchedText, autocompleteTriggerType, channel?.guildId]);

	const autocompleteQuery = useMemo(() => {
		if (!autocompleteTrigger) return '';
		switch (autocompleteTriggerType) {
			case 'mention':
			case 'channel':
			case 'emoji':
			case 'emojiReaction':
			case 'command':
			case 'commandArg':
			case 'commandArgMention':
				return autocompleteTriggerMatchedText;
			case 'meme':
				return autocompleteTriggerMatch2.trim();
			case 'gif':
				return autocompleteTriggerMatch3.trim();
			case 'sticker':
				return autocompleteTriggerMatch2.trim();
			default:
				return '';
		}
	}, [
		autocompleteTrigger,
		autocompleteTriggerMatchedText,
		autocompleteTriggerMatch2,
		autocompleteTriggerMatch3,
		autocompleteTriggerType,
	]);

	const hasOpenCodeBlock = useCallback(() => {
		const textarea = textareaRef.current;
		const match = textarea?.value.slice(0, textarea.selectionStart).match(/```/g);
		return match != null && match.length > 0 && match.length % 2 !== 0;
	}, [textareaRef]);

	const isAutocompleteAttached = !!autocompleteTrigger && autocompleteOptions.length > 0;

	const matchedText = autocompleteTrigger ? autocompleteTrigger.matchedText : null;

	const onCursorMove = useCallback(() => {
		const position = textareaRef.current?.selectionStart ?? 0;
		const beforeCursor = value.slice(0, position);
		setValueUpToCursor(beforeCursor);
	}, [value, textareaRef]);

	useEffect(() => {
		const handleSelectionChange = () => {
			onCursorMove();
		};

		document.addEventListener('selectionchange', handleSelectionChange);
		return () => {
			document.removeEventListener('selectionchange', handleSelectionChange);
		};
	}, [onCursorMove]);

	useEffect(() => {
		const position = textareaRef.current?.selectionStart ?? value.length;
		setValueUpToCursor(value.slice(0, position));
	}, [value, textareaRef]);

	useEffect(() => {
		if (isAutocompleteAttached) {
			if (autocompleteTriggerType === 'channel') {
				const firstChannel = autocompleteOptions.find(isChannel);
				if (firstChannel) {
					HighlightActionCreators.highlightChannel(firstChannel.channel.id);
				}
			}
		} else {
			HighlightActionCreators.clearChannelHighlight();
		}
		return () => {
			HighlightActionCreators.clearChannelHighlight();
		};
	}, [isAutocompleteAttached, autocompleteOptions, autocompleteTriggerType]);

	const canMentionEveryone = channel ? PermissionStore.can(Permissions.MENTION_EVERYONE, channel) : false;

	const canUseCommand = useCallback(
		(command: Command) => {
			if (command.type === 'simple') return true;
			if (!channel) return false;
			if (command.requiresGuild && !channel.guildId) return false;
			if (command.permission) {
				return PermissionStore.can(command.permission, channel);
			}
			return true;
		},
		[channel],
	);

	const canManageUser = useCallback(
		(otherUserId: string, permission: bigint) => {
			if (!channel || !channel.guildId) return false;

			const currentUserId = AuthenticationStore.currentUserId;
			if (otherUserId === currentUserId) return false;

			const guild = GuildStore.getGuild(channel.guildId);
			if (!guild) return false;

			return PermissionStore.canManageUser(permission, otherUserId as UserId, guild.toJSON());
		},
		[channel],
	);

	const canViewChannel = useCallback(
		(_userId: string): boolean => {
			if (!channel) return false;

			if (
				channel.type === ChannelTypes.DM ||
				channel.type === ChannelTypes.DM_PERSONAL_NOTES ||
				channel.type === ChannelTypes.GROUP_DM
			) {
				return true;
			}

			if (!channel.guildId) return true;

			return PermissionStore.can(Permissions.VIEW_CHANNEL, {guildId: channel.guildId, channelId: channel.id});
		},
		[channel],
	);

	useEffect(() => {
		let options: Array<AutocompleteOption> = [];

		if (!autocompleteTrigger) {
			setAutocompleteOptions([]);
			return;
		}

		switch (autocompleteTrigger.type) {
			case 'commandArgMention':
			case 'commandArg': {
				setAutocompleteType('mention');
				const commandName = autocompleteTrigger.match[2];

				if (!channel || (!channel.guildId && commandName !== 'msg')) {
					setAutocompleteOptions([]);
					return;
				}

				options = buildCommandArgOptions({
					channel,
					commandName,
					matchedText,
					memberSearchResults,
					canManageUser,
					canViewChannel,
				});
				break;
			}

			case 'mention': {
				setAutocompleteType('mention');

				if (!channel || !channel.guildId) {
					if (!channel) {
						setAutocompleteOptions([]);
						return;
					}
					const users = channel.recipientIds
						.map((id) => UserStore.getUser(id))
						.filter((user): user is NonNullable<typeof user> => user != null);

					const parsedQuery = parseMentionQuery(matchedText ?? '');

					const userOptions = filterDMUsers(users, parsedQuery);

					options = [...userOptions, ...SPECIAL_MENTIONS];
				} else {
					const membersToUse =
						memberSearchResults.length > 0 ? memberSearchResults : GuildMemberStore.getMembers(channel.guildId ?? '');

					const parsedQuery = parseMentionQuery(matchedText ?? '');
					const queryForMatching = parsedQuery.usernameQuery.trim();

					const members = filterGuildMembers(membersToUse, parsedQuery, true, canViewChannel);

					const mentionableRoles = GuildStore.getGuildRoles(channel.guildId ?? '').filter(
						(role) => canMentionEveryone || role.mentionable,
					);

					const matchedRoles = queryForMatching
						? matchSorter(mentionableRoles, queryForMatching, {
								keys: ['name'],
								threshold: matchSorter.rankings.CONTAINS,
							})
						: mentionableRoles;

					const roles = matchedRoles
						.sort((a, b) => b.position - a.position)
						.slice(0, 10)
						.map((role) => ({
							type: 'mention' as const,
							kind: 'role' as const,
							role,
						}));

					const specialMentions = canMentionEveryone
						? SPECIAL_MENTIONS.filter((mention) => {
								if (!queryForMatching) return true;
								return mention.kind.toLowerCase().includes(queryForMatching.toLowerCase());
							})
						: [];

					options = [...members, ...specialMentions, ...roles];
				}
				break;
			}

			case 'channel': {
				setAutocompleteType('channel');
				if (!channel) {
					setAutocompleteOptions([]);
					return;
				}
				options = matchSorter(ChannelStore.getGuildChannels(channel.guildId ?? ''), matchedText ?? '', {keys: ['name']})
					.filter((channel) => !channel.isGuildCategory())
					.map((channel) => ({
						type: 'channel' as const,
						channel,
					}))
					.sort((a, b) => a.channel.position! - b.channel.position!)
					.slice(0, 10);
				break;
			}

			case 'emojiReaction': {
				setAutocompleteType('emoji');
				options = buildEmojiReactionOptions({channel: channel ?? null, matchedText, i18n});
				break;
			}

			case 'emoji': {
				setAutocompleteType('emoji');
				options = buildEmojiAutocompleteOptions({
					channel: channel ?? null,
					matchedText,
					i18n,
					prefs: {
						showDefaultEmojis: AccessibilityStore.showDefaultEmojisInExpressionAutocomplete,
						showCustomEmojis: AccessibilityStore.showCustomEmojisInExpressionAutocomplete,
						showStickers: AccessibilityStore.showStickersInExpressionAutocomplete,
						showMemes: AccessibilityStore.showMemesInExpressionAutocomplete,
					},
				});
				break;
			}

			case 'command': {
				setAutocompleteType('command');
				const filteredCommands = filterCommandsByQuery(commands, matchedText ?? '').filter(canUseCommand);
				options = filteredCommands.map((command) => ({
					type: 'command' as const,
					command,
				}));
				break;
			}

			case 'meme': {
				setAutocompleteType('meme');
				const searchQuery = autocompleteTrigger.match[2].trim();
				const allMemes = FavoriteMemeStore.getAllMemes();
				if (searchQuery) {
					const filteredMemes = matchSorter(allMemes, searchQuery, {
						keys: ['name', 'altText', 'filename', 'tags'],
						threshold: matchSorter.rankings.CONTAINS,
					});
					options = filteredMemes.slice(0, 10).map((meme) => ({
						type: 'meme' as const,
						meme,
					}));
				} else {
					options = allMemes.slice(0, 10).map((meme) => ({
						type: 'meme' as const,
						meme,
					}));
				}
				break;
			}

			case 'gif': {
				setAutocompleteType('gif');
				const searchQuery = (autocompleteTrigger.match[3] ?? '').trim();

				if (!searchQuery) {
					options = [];
				} else if (gifState.status === 'success' && gifState.query === searchQuery) {
					options = gifState.results.slice(0, 10).map((gif) => ({
						type: 'gif' as const,
						gif: {
							...gif,
							title: gif.title || KlipyUtils.parseTitleFromUrl(gif.url),
						},
					}));
				} else {
					options = [];
				}
				break;
			}

			case 'sticker': {
				setAutocompleteType('sticker');
				const searchQuery = (autocompleteTrigger.match[2] ?? '').trim();
				let results: ReadonlyArray<GuildStickerRecord>;

				if (!searchQuery) {
					const allStickers = StickerStore.searchWithChannel(channel ?? null, '');
					const filteredStickers = filterStickersForAutocomplete(i18n, allStickers, channel ?? null);
					results = StickerPickerStore.getFrecentStickers(filteredStickers, 10);

					if (results.length < 10) {
						const remainingCount = 10 - results.length;
						const otherStickers = filteredStickers
							.filter((sticker) => !results.some((r) => r.id === sticker.id))
							.slice(0, remainingCount);
						results = [...results, ...otherStickers];
					}
				} else {
					const allStickersSearch = StickerStore.searchWithChannel(channel ?? null, searchQuery);
					results = filterStickersForAutocomplete(i18n, allStickersSearch, channel ?? null);
				}

				options = results.slice(0, 10).map((sticker) => ({
					type: 'sticker' as const,
					sticker,
				}));
				break;
			}
		}

		if (hasOpenCodeBlock()) {
			setAutocompleteOptions([]);
		} else {
			setAutocompleteOptions(options);
		}
	}, [
		channel,
		autocompleteTriggerToken,
		canMentionEveryone,
		matchedText,
		hasOpenCodeBlock,
		gifState,
		canUseCommand,
		canManageUser,
		memberSearchResults,
		i18n,
		expressionDataVersion,
		permissionVersion,
	]);

	const handleSelect = useCallback(
		(option: AutocompleteOption) => {
			if (!textareaRef.current) {
				return;
			}

			const triggerMatch = autocompleteTrigger?.match ?? null;

			if (!triggerMatch) {
				return;
			}

			if (autocompleteTrigger?.type === 'emojiReaction' && isEmoji(option)) {
				if (channel) {
					const messages = MessageStore.getMessages(channel.id).toArray();
					const mostRecentMessage = messages[messages.length - 1];

					if (mostRecentMessage) {
						ReactionActionCreators.addReaction(i18n, channel.id, mostRecentMessage.id, toReactionEmoji(option.emoji));
					}
				}

				setValue('');
				previousValueRef.current = '';
				setSelectedIndex(0);
				return;
			}

			if (isMeme(option)) {
				ComponentDispatch.dispatch('FAVORITE_MEME_SELECT', {meme: option.meme, autoSend: true});
				setValue('');
				previousValueRef.current = '';
				setSelectedIndex(0);
				return;
			}

			if (isGif(option)) {
				ComponentDispatch.dispatch('GIF_SELECT', {gif: option.gif, autoSend: true});
				setValue('');
				previousValueRef.current = '';
				setSelectedIndex(0);
				return;
			}

			if (isSticker(option)) {
				ComponentDispatch.dispatch('STICKER_SELECT', {sticker: option.sticker});
				setValue('');
				previousValueRef.current = '';
				setSelectedIndex(0);
				return;
			}

			const matchStart = triggerMatch.index ?? 0;
			const matchEnd = matchStart + triggerMatch[0].length;

			const capturedWhitespace = triggerMatch[1] || '';
			const hasLeadingSpace = capturedWhitespace.length > 0;

			let beforeMatch = value.slice(0, matchStart + capturedWhitespace.length);
			let afterMatch = value.slice(matchEnd);

			if (autocompleteTrigger?.type === 'commandArg') {
				const commandPart = triggerMatch[0].slice(0, triggerMatch[0].length - (triggerMatch[3]?.length ?? 0));
				const cleanCommandPart = commandPart.slice(capturedWhitespace.length);
				beforeMatch = value.slice(0, matchStart + capturedWhitespace.length + cleanCommandPart.length);
				afterMatch = value.slice(matchEnd);
			}

			const guildBeforeMatch = hasLeadingSpace || beforeMatch.endsWith(' ') ? '' : ' ';
			const insertPosition = beforeMatch.length + guildBeforeMatch.length;

			let displayText = '';
			let actualText = '';
			let segmentType: MentionSegment['type'] = 'user';
			let segmentId = '';

			if (isMentionMember(option)) {
				const user = option.member.user;
				displayText = `@${user.tag}`;
				actualText = `<@${user.id}>`;
				segmentType = 'user';
				segmentId = user.id;
			} else if (isMentionUser(option)) {
				displayText = `@${option.user.tag}`;
				actualText = `<@${option.user.id}>`;
				segmentType = 'user';
				segmentId = option.user.id;
			} else if (isMentionRole(option)) {
				displayText = `@${option.role.name}`;
				actualText = `<@&${option.role.id}>`;
				segmentType = 'role';
				segmentId = option.role.id;
			} else if (isSpecialMention(option)) {
				displayText = option.kind;
				actualText = option.kind;
				segmentType = 'special';
				segmentId = option.kind;
			} else if (isChannel(option)) {
				displayText = `#${option.channel.name}`;
				actualText = `<#${option.channel.id}>`;
				segmentType = 'channel';
				segmentId = option.channel.id;
			} else if (isEmoji(option)) {
				displayText = `:${option.emoji.name}:`;
				actualText = EmojiStore.getEmojiMarkdown(option.emoji);
				segmentType = 'emoji';
				segmentId = option.emoji.id ?? option.emoji.uniqueName;
			} else if (isCommand(option)) {
				if (option.command.type === 'simple') {
					const commandText = option.command.content;

					if (option.command.name === '/me' || option.command.name === '/spoiler') {
						const newValue = `${beforeMatch}${guildBeforeMatch}${commandText}`;
						const newCursorPosition = newValue.length;

						const trimmedValue = newValue.trimStart();
						const trimmedChars = newValue.length - trimmedValue.length;

						if (trimmedChars > 0) {
							const segments = segmentManagerRef.current.getSegments();
							const adjustedSegments = segments.map((seg) => ({
								...seg,
								start: seg.start - trimmedChars,
								end: seg.end - trimmedChars,
							}));
							segmentManagerRef.current.setSegments(adjustedSegments);
						}

						setValue(trimmedValue);
						previousValueRef.current = trimmedValue;
						setSelectedIndex(0);

						setTimeout(() => {
							if (textareaRef.current) {
								textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
								textareaRef.current.focus();
							}
						}, 0);
						return;
					}

					const newValue = `${beforeMatch}${guildBeforeMatch}${commandText} ${afterMatch}`;
					const newCursorPosition = beforeMatch.length + guildBeforeMatch.length + commandText.length + 1;

					const trimmedValue = newValue.trimStart();
					const trimmedChars = newValue.length - trimmedValue.length;

					if (trimmedChars > 0) {
						const segments = segmentManagerRef.current.getSegments();
						const adjustedSegments = segments.map((seg) => ({
							...seg,
							start: seg.start - trimmedChars,
							end: seg.end - trimmedChars,
						}));
						segmentManagerRef.current.setSegments(adjustedSegments);
					}

					setValue(trimmedValue);
					previousValueRef.current = trimmedValue;
					setSelectedIndex(0);

					setTimeout(() => {
						if (textareaRef.current) {
							textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
							textareaRef.current.focus();
						}
					}, 0);
					return;
				} else {
					const insertionText = getCommandInsertionText(option.command);
					const newValue = `${beforeMatch}${guildBeforeMatch}${insertionText}${afterMatch}`;
					const newCursorPosition = beforeMatch.length + guildBeforeMatch.length + insertionText.length;

					const trimmedValue = newValue.trimStart();
					const trimmedChars = newValue.length - trimmedValue.length;

					if (trimmedChars > 0) {
						const segments = segmentManagerRef.current.getSegments();
						const adjustedSegments = segments.map((seg) => ({
							...seg,
							start: seg.start - trimmedChars,
							end: seg.end - trimmedChars,
						}));
						segmentManagerRef.current.setSegments(adjustedSegments);
					}

					setValue(trimmedValue);
					previousValueRef.current = trimmedValue;
					setSelectedIndex(0);

					setTimeout(() => {
						if (textareaRef.current) {
							textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
							textareaRef.current.focus();
						}
					}, 0);
					return;
				}
			}

			const segmentsBeforeInsert = maxActualLength != null ? segmentManagerRef.current.getSegments() : null;

			const changeStart = beforeMatch.length;
			const changeEnd = matchEnd;
			segmentManagerRef.current.updateSegmentsForTextChange(changeStart, changeEnd, guildBeforeMatch.length);

			const tempText = `${beforeMatch}${guildBeforeMatch}`;
			const {newText: updatedText} = segmentManagerRef.current.insertSegment(
				tempText,
				insertPosition,
				displayText,
				actualText,
				segmentType,
				segmentId,
			);

			const spaceInsertPosition = insertPosition + displayText.length;
			segmentManagerRef.current.updateSegmentsForTextChange(spaceInsertPosition, spaceInsertPosition, 1);

			const finalText = `${updatedText} ${afterMatch}`;
			const newCursorPosition = beforeMatch.length + guildBeforeMatch.length + displayText.length + 1;

			const trimmedValue = finalText.trimStart();
			const trimmedChars = finalText.length - trimmedValue.length;

			if (trimmedChars > 0) {
				const segments = segmentManagerRef.current.getSegments();
				const adjustedSegments = segments.map((seg) => ({
					...seg,
					start: seg.start - trimmedChars,
					end: seg.end - trimmedChars,
				}));
				segmentManagerRef.current.setSegments(adjustedSegments);
			}

			if (maxActualLength != null && segmentType === 'emoji') {
				const candidateActualText = segmentManagerRef.current.displayToActual(trimmedValue);
				if (candidateActualText.length > maxActualLength) {
					if (segmentsBeforeInsert) {
						segmentManagerRef.current.setSegments(segmentsBeforeInsert);
					}
					onExceedMaxLength?.();
					return;
				}
			}

			setValue(trimmedValue);
			previousValueRef.current = trimmedValue;
			setSelectedIndex(0);
			HighlightActionCreators.clearChannelHighlight();

			setTimeout(() => {
				if (textareaRef.current) {
					textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
					textareaRef.current.focus();
				}
			}, 0);
		},
		[
			value,
			autocompleteTrigger,
			textareaRef,
			segmentManagerRef,
			previousValueRef,
			setValue,
			i18n,
			maxActualLength,
			onExceedMaxLength,
		],
	);

	return {
		autocompleteOptions,
		autocompleteType,
		selectedIndex,
		isAutocompleteAttached,
		setSelectedIndex,
		onCursorMove,
		handleSelect,
		autocompleteQuery,
		isMemberSearchLoading,
	};
}
