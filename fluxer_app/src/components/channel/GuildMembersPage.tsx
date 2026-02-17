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

import * as ContextMenuActionCreators from '@app/actions/ContextMenuActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import * as UserProfileActionCreators from '@app/actions/UserProfileActionCreators';
import {ChannelHeader} from '@app/components/channel/ChannelHeader';
import {ChannelViewScaffold} from '@app/components/channel/channel_view/ChannelViewScaffold';
import styles from '@app/components/channel/GuildMembersPage.module.css';
import {Input} from '@app/components/form/Input';
import {Select, type SelectOption} from '@app/components/form/Select';
import {GuildMembersDateRangeModal} from '@app/components/modals/guild_tabs/GuildMembersDateRangeModal';
import {BaseAvatar} from '@app/components/uikit/BaseAvatar';
import {Button} from '@app/components/uikit/button/Button';
import {CheckboxItem, ContextMenuCloseProvider, MenuItem} from '@app/components/uikit/context_menu/ContextMenu';
import {GuildMemberContextMenu} from '@app/components/uikit/context_menu/GuildMemberContextMenu';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItemRadio} from '@app/components/uikit/context_menu/MenuItemRadio';
import {Scroller} from '@app/components/uikit/Scroller';
import {StatusAwareAvatar} from '@app/components/uikit/StatusAwareAvatar';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {Endpoints} from '@app/Endpoints';
import {useFluxerDocumentTitle} from '@app/hooks/useFluxerDocumentTitle';
import http from '@app/lib/HttpClient';
import {Logger} from '@app/lib/Logger';
import {formatTimestamp} from '@app/lib/markdown/utils/DateFormatter';
import type {GuildMemberRecord} from '@app/records/GuildMemberRecord';
import type {GuildRoleRecord} from '@app/records/GuildRoleRecord';
import type {UserRecord} from '@app/records/UserRecord';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import GuildStore from '@app/stores/GuildStore';
import UserStore from '@app/stores/UserStore';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import * as ColorUtils from '@app/utils/ColorUtils';
import * as NicknameUtils from '@app/utils/NicknameUtils';
import {JoinSourceTypes} from '@fluxer/constants/src/GuildConstants';
import {TimestampStyle} from '@fluxer/markdown_parser/src/types/Enums';
import {extractTimestampFromSnowflakeAsDate} from '@fluxer/snowflake/src/SnowflakeUtils';
import {Trans, useLingui} from '@lingui/react/macro';
import {
	CrownIcon,
	DotsThreeVerticalIcon,
	FunnelIcon,
	MagnifyingGlassIcon,
	SortAscendingIcon,
	UsersIcon,
} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {motion} from 'framer-motion';
import debounce from 'lodash/debounce';
import {DateTime} from 'luxon';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

const logger = new Logger('GuildMembersPage');

const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_PAGE_SIZE = 25;
const INDEXING_POLL_INTERVAL_MS = 5000;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

interface SearchableGuildMemberSupplemental {
	join_source_type: number | null;
	source_invite_code: string | null;
	inviter_id: string | null;
}

interface SearchableGuildMember {
	id: string;
	guild_id: string;
	user_id: string;
	username: string;
	discriminator: string;
	global_name: string | null;
	nickname: string | null;
	role_ids: Array<string>;
	joined_at: number;
	supplemental: SearchableGuildMemberSupplemental;
	is_bot: boolean;
}

interface GuildMemberSearchResponse {
	guild_id: string;
	members: Array<SearchableGuildMember>;
	page_result_count: number;
	total_result_count: number;
	indexing: boolean;
}

interface SearchParams {
	query?: string;
	limit?: number;
	offset?: number;
	role_ids?: Array<string>;
	sort_by?: string;
	sort_order?: string;
	joined_at_gte?: number;
	joined_at_lte?: number;
	join_source_type?: Array<number>;
	source_invite_code?: Array<string>;
	user_created_at_gte?: number;
	user_created_at_lte?: number;
}

async function searchGuildMembers(guildId: string, params: SearchParams): Promise<GuildMemberSearchResponse> {
	const response = await http.post<GuildMemberSearchResponse>(Endpoints.GUILD_MEMBERS_SEARCH(guildId), params);
	return response.body;
}

interface MemberDisplayData {
	userId: string;
	displayName: string;
	tag: string;
	username: string;
	discriminator: string;
	nickname: string | null;
	roleIds: Array<string>;
	joinedAt: Date;
	isBot: boolean;
	user: UserRecord | null;
	member: GuildMemberRecord | null;
	joinSourceType: number | null;
	sourceInviteCode: string | null;
	inviterId: string | null;
	userCreatedAt: Date;
}

function toMemberDisplayData(searchMember: SearchableGuildMember, guildId: string): MemberDisplayData {
	const user = UserStore.getUser(searchMember.user_id);
	const member = GuildMemberStore.getMember(guildId, searchMember.user_id);

	const displayName = member?.nick ?? searchMember.nickname ?? searchMember.global_name ?? searchMember.username;
	const tag = user ? user.tag : `${searchMember.username}#${searchMember.discriminator}`;

	return {
		userId: searchMember.user_id,
		displayName,
		tag,
		username: searchMember.username,
		discriminator: searchMember.discriminator,
		nickname: searchMember.nickname,
		roleIds: searchMember.role_ids,
		joinedAt: new Date(searchMember.joined_at * 1000),
		isBot: searchMember.is_bot,
		user: user ?? null,
		member: member ?? null,
		joinSourceType: searchMember.supplemental.join_source_type,
		sourceInviteCode: searchMember.supplemental.source_invite_code,
		inviterId: searchMember.supplemental.inviter_id,
		userCreatedAt: extractTimestampFromSnowflakeAsDate(searchMember.user_id),
	};
}

type SortMode = 'newest' | 'oldest';

interface DateRangeFilter {
	gte?: number;
	lte?: number;
}

interface JoinMethodFilter {
	sourceType?: Array<number>;
	inviteCode?: Array<string>;
}

interface MemberTableRowProps {
	data: MemberDisplayData;
	guildId: string;
	isOwner: boolean;
	activeMenuMemberId: string | null;
	contextMenuMemberId: string | null;
	onActionsClick: (data: MemberDisplayData, event: React.MouseEvent<HTMLElement>) => void;
	onContextMenu: (data: MemberDisplayData, event: React.MouseEvent<HTMLElement>) => void;
	onRowClick: (data: MemberDisplayData) => void;
}

const MemberTableRow: React.FC<MemberTableRowProps> = observer(
	({data, guildId, isOwner, activeMenuMemberId, contextMenuMemberId, onActionsClick, onContextMenu, onRowClick}) => {
		const {t, i18n} = useLingui();
		const isActionsMenuActive = activeMenuMemberId === data.userId;
		const isContextMenuActive = contextMenuMemberId === data.userId;

		const user = UserStore.getUser(data.userId);
		const member = GuildMemberStore.getMember(guildId, data.userId);

		const roleColor = member?.getColorString();
		const roles = GuildStore.getGuildRoles(guildId);

		const memberRoles = useMemo(() => {
			const roleIds = member ? Array.from(member.roles) : data.roleIds;
			return roleIds
				.map((id) => roles.find((r) => r.id === id))
				.filter((r): r is GuildRoleRecord => r != null)
				.sort((a, b) => b.position - a.position);
		}, [member, data.roleIds, roles]);

		const topRole = memberRoles[0];
		const extraRolesCount = memberRoles.length - 1;

		const joinedAt = member?.joinedAt ?? data.joinedAt;
		const joinedAtRelative = useMemo(
			() => formatTimestamp(Math.floor(joinedAt.getTime() / 1000), TimestampStyle.RelativeTime, i18n),
			[joinedAt, i18n],
		);

		const joinedAtAbsolute = useMemo(() => DateTime.fromJSDate(joinedAt).toFormat('d LLLL yyyy, HH:mm'), [joinedAt]);

		const userCreatedAtRelative = useMemo(
			() => formatTimestamp(Math.floor(data.userCreatedAt.getTime() / 1000), TimestampStyle.RelativeTime, i18n),
			[data.userCreatedAt, i18n],
		);

		const userCreatedAtAbsolute = useMemo(
			() => DateTime.fromJSDate(data.userCreatedAt).toFormat('d LLLL yyyy, HH:mm'),
			[data.userCreatedAt],
		);

		const sourceInviteCode = data.sourceInviteCode;
		const joinSourceType = data.joinSourceType;
		const inviterId = data.inviterId;

		const joinMethodLabel = useMemo(() => {
			switch (joinSourceType) {
				case JoinSourceTypes.CREATOR:
					return t`Community Creator`;
				case JoinSourceTypes.INSTANT_INVITE:
					return sourceInviteCode ? t`Invite (${sourceInviteCode})` : t`Invite`;
				case JoinSourceTypes.VANITY_URL:
					return t`Vanity URL`;
				case JoinSourceTypes.BOT_INVITE:
					return t`Bot Invite`;
				case JoinSourceTypes.ADMIN_FORCE_ADD:
					return t`Platform Admin`;
				default:
					return t`Invite`;
			}
		}, [sourceInviteCode, joinSourceType, t]);

		const joinMethodTooltip = useMemo(() => {
			if (joinSourceType === JoinSourceTypes.INSTANT_INVITE && inviterId) {
				const inviterIdValue = inviterId;
				return () => {
					const inviterUser = UserStore.getUser(inviterIdValue);
					const inviterMember = GuildMemberStore.getMember(guildId, inviterIdValue);
					const inviterName = inviterUser ? NicknameUtils.getNickname(inviterUser, guildId) : t`Unknown User`;
					const inviterColor = inviterMember?.getColorString();
					return (
						<span className={styles.inviterTooltip}>
							{t`Invited by`}
							<span className={styles.inviterUser}>
								{inviterUser && <StatusAwareAvatar user={inviterUser} size={16} guildId={guildId} disablePresence />}
								<span style={inviterColor ? {color: inviterColor} : undefined}>{inviterName}</span>
							</span>
						</span>
					);
				};
			}
			if (joinSourceType === JoinSourceTypes.ADMIN_FORCE_ADD) {
				return t`This user was force-added to this community by a platform administrator. Sneaky!`;
			}
			return undefined;
		}, [joinSourceType, inviterId, guildId, t]);

		const handleContextMenu = useCallback(
			(event: React.MouseEvent<HTMLElement>) => {
				event.preventDefault();
				onContextMenu(data, event);
			},
			[data, onContextMenu],
		);

		const handleActionsClick = useCallback(
			(event: React.MouseEvent<HTMLElement>) => {
				event.stopPropagation();
				onActionsClick(data, event);
			},
			[data, onActionsClick],
		);

		const handleRowClick = useCallback(() => {
			onRowClick(data);
		}, [data, onRowClick]);

		const handleOverflowRolesClick = useCallback(
			(event: React.MouseEvent<HTMLButtonElement>) => {
				event.stopPropagation();
				ContextMenuActionCreators.openFromElementBottomRight(event, ({onClose}) => (
					<ContextMenuCloseProvider value={onClose}>
						<MenuGroup>
							{memberRoles.map((role) => (
								<MenuItem key={role.id} label={role.name} closeOnSelect={false}>
									<div className={styles.readonlyRoleItem}>
										<div className={styles.readonlyRoleLabel}>
											<span
												className={styles.readonlyRoleDot}
												style={{
													backgroundColor: role.color ? ColorUtils.int2rgb(role.color) : 'var(--text-tertiary)',
												}}
											/>
											<span>{role.name}</span>
										</div>
										<div className={styles.readonlyRoleSpacer} />
									</div>
								</MenuItem>
							))}
						</MenuGroup>
					</ContextMenuCloseProvider>
				));
			},
			[memberRoles],
		);

		const topRoleColor = topRole?.color ? ColorUtils.int2rgb(topRole.color) : undefined;
		const rolePillBg = topRoleColor
			? `color-mix(in srgb, ${topRoleColor} 20%, var(--background-secondary-alt))`
			: 'var(--background-secondary)';

		const displayName = member?.nick ?? data.nickname ?? data.displayName;
		const tag = user?.tag ?? data.tag;

		return (
			<tr
				className={styles.tr}
				data-menu-active={isContextMenuActive || isActionsMenuActive ? '' : undefined}
				onContextMenu={handleContextMenu}
				onClick={handleRowClick}
			>
				<td className={clsx(styles.td, styles.nameCol)}>
					<div className={styles.nameCell}>
						{user ? (
							<StatusAwareAvatar user={user} size={32} guildId={guildId} disablePresence />
						) : (
							<BaseAvatar
								size={32}
								avatarUrl={AvatarUtils.getUserAvatarURL({id: data.userId, avatar: null}, false)}
								userTag={tag}
							/>
						)}
						<div className={styles.nameInfo}>
							<div className={styles.nameRow}>
								<span className={styles.displayName} style={roleColor ? {color: roleColor} : undefined}>
									{displayName}
								</span>
								{isOwner && (
									<Tooltip text={t`Community Owner`}>
										<CrownIcon className={styles.ownerIcon} weight="fill" />
									</Tooltip>
								)}
							</div>
							<span className={styles.tag}>{tag}</span>
						</div>
					</div>
				</td>
				<td className={clsx(styles.td, styles.dateCol)}>
					<div className={styles.cellContent}>
						<Tooltip text={joinedAtAbsolute}>
							<span className={styles.timestampText}>{joinedAtRelative}</span>
						</Tooltip>
					</div>
				</td>
				<td className={clsx(styles.td, styles.dateCol)}>
					<div className={styles.cellContent}>
						<Tooltip text={userCreatedAtAbsolute}>
							<span className={styles.timestampText}>{userCreatedAtRelative}</span>
						</Tooltip>
					</div>
				</td>
				<td className={clsx(styles.td, styles.joinMethodCol)}>
					<div className={styles.cellContent}>
						{joinMethodTooltip ? (
							<Tooltip text={joinMethodTooltip}>
								<span className={styles.pill}>{joinMethodLabel}</span>
							</Tooltip>
						) : (
							<span className={styles.pill}>{joinMethodLabel}</span>
						)}
					</div>
				</td>
				<td className={clsx(styles.td, styles.rolesCol)}>
					<div className={styles.rolesCell}>
						{topRole && (
							<span className={styles.rolePill} style={{backgroundColor: rolePillBg}}>
								<span className={styles.roleDot} style={{backgroundColor: topRoleColor ?? 'var(--text-tertiary)'}} />
								{topRole.name}
							</span>
						)}
						{extraRolesCount > 0 && (
							<Tooltip text={t`View All Roles`}>
								<button type="button" className={styles.overflowPill} onClick={handleOverflowRolesClick}>
									+{extraRolesCount}
								</button>
							</Tooltip>
						)}
					</div>
				</td>
				<td className={clsx(styles.td, styles.actionsCol)}>
					<button
						type="button"
						className={styles.actionsButton}
						data-menu-active={isActionsMenuActive ? '' : undefined}
						onClick={handleActionsClick}
					>
						<DotsThreeVerticalIcon weight="bold" size={18} />
					</button>
				</td>
			</tr>
		);
	},
);

const PAGE_SIZE_OPTIONS: Array<SelectOption<number>> = [
	{value: 12, label: '12'},
	{value: 25, label: '25'},
	{value: 50, label: '50'},
	{value: 100, label: '100'},
];

interface RolesFilterMenuContentProps {
	roles: ReadonlyArray<GuildRoleRecord>;
	initialRoleFilter: ReadonlyArray<string>;
	setRoleFilter: React.Dispatch<React.SetStateAction<Array<string>>>;
	onClose: () => void;
}

function RolesFilterMenuContent({roles, initialRoleFilter, setRoleFilter, onClose}: RolesFilterMenuContentProps) {
	const {t} = useLingui();
	const [localFilter, setLocalFilter] = useState<Array<string>>(() => [...initialRoleFilter]);

	const handleClear = useCallback(() => {
		setLocalFilter([]);
		setRoleFilter([]);
	}, [setRoleFilter]);

	const handleToggle = useCallback(
		(roleId: string) => {
			const updater = (prev: Array<string>) =>
				prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId];
			setLocalFilter(updater);
			setRoleFilter(updater);
		},
		[setRoleFilter],
	);

	return (
		<ContextMenuCloseProvider value={onClose}>
			<MenuGroup>
				<MenuItem
					label={t`Clear All`}
					closeOnSelect={false}
					disabled={localFilter.length === 0}
					onSelect={handleClear}
				/>
			</MenuGroup>
			<MenuGroup>
				{roles.map((role) => (
					<CheckboxItem
						key={role.id}
						checked={localFilter.includes(role.id)}
						onCheckedChange={() => handleToggle(role.id)}
					>
						<div className={styles.roleFilterItem}>
							<span
								className={styles.roleFilterDot}
								style={{backgroundColor: role.color ? ColorUtils.int2rgb(role.color) : 'var(--text-tertiary)'}}
							/>
							{role.name}
						</div>
					</CheckboxItem>
				))}
			</MenuGroup>
		</ContextMenuCloseProvider>
	);
}

function isPresetMatch(filter: DateRangeFilter, durationMs: number): boolean {
	if (filter.gte == null || filter.lte != null) return false;
	const expected = Math.floor((Date.now() - durationMs) / 1000);
	return Math.abs(filter.gte - expected) < 60;
}

const MembersTableView: React.FC<{guildId: string}> = observer(({guildId}) => {
	const {t} = useLingui();
	const guild = GuildStore.getGuild(guildId);

	const [searchQuery, setSearchQuery] = useState('');
	const [sortMode, setSortMode] = useState<SortMode>('newest');
	const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
	const [memberSinceFilter, setMemberSinceFilter] = useState<DateRangeFilter>({});
	const [joinedFluxerFilter, setJoinedFluxerFilter] = useState<DateRangeFilter>({});
	const [joinMethodFilter, setJoinMethodFilter] = useState<JoinMethodFilter>({});
	const [roleFilter, setRoleFilter] = useState<Array<string>>([]);

	const [activeMenuMemberId, setActiveMenuMemberId] = useState<string | null>(null);
	const [contextMenuMemberId, setContextMenuMemberId] = useState<string | null>(null);

	const [searchMembers, setSearchMembers] = useState<Array<MemberDisplayData>>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [offset, setOffset] = useState(0);
	const [isLoading, setIsLoading] = useState(false);
	const [isSearching, setIsSearching] = useState(false);
	const [indexing, setIndexing] = useState(false);
	const [hasMore, setHasMore] = useState(true);
	const [initialLoadDone, setInitialLoadDone] = useState(false);
	const [searchError, setSearchError] = useState(false);

	const isLoadingRef = useRef(false);
	const abortControllerRef = useRef<AbortController | null>(null);

	const roles = GuildStore.getGuildRoles(guildId);

	const performSearch = useCallback(
		async (params: {query?: string; offsetVal?: number; append?: boolean}) => {
			const {query, offsetVal = 0, append = false} = params;

			if (isLoadingRef.current && !append) {
				abortControllerRef.current?.abort();
			}

			const controller = new AbortController();
			abortControllerRef.current = controller;

			if (append) {
				setIsLoading(true);
			} else {
				setIsSearching(true);
			}
			isLoadingRef.current = true;

			try {
				const searchParams: SearchParams = {
					limit: pageSize,
					offset: offsetVal,
					sort_by: 'joinedAt',
					sort_order: sortMode === 'newest' ? 'desc' : 'asc',
				};

				if (query) {
					searchParams.query = query;
				}

				if (roleFilter.length > 0) {
					searchParams.role_ids = roleFilter;
				}

				if (memberSinceFilter.gte != null) {
					searchParams.joined_at_gte = memberSinceFilter.gte;
				}
				if (memberSinceFilter.lte != null) {
					searchParams.joined_at_lte = memberSinceFilter.lte;
				}

				if (joinedFluxerFilter.gte != null) {
					searchParams.user_created_at_gte = joinedFluxerFilter.gte;
				}
				if (joinedFluxerFilter.lte != null) {
					searchParams.user_created_at_lte = joinedFluxerFilter.lte;
				}

				if (joinMethodFilter.sourceType && joinMethodFilter.sourceType.length > 0) {
					searchParams.join_source_type = joinMethodFilter.sourceType;
				}
				if (joinMethodFilter.inviteCode && joinMethodFilter.inviteCode.length > 0) {
					searchParams.source_invite_code = joinMethodFilter.inviteCode;
				}

				const response = await searchGuildMembers(guildId, searchParams);

				if (controller.signal.aborted) {
					return;
				}

				setSearchError(false);
				setIndexing(response.indexing);
				setTotalCount(response.total_result_count);

				const displayMembers = response.members.map((m) => toMemberDisplayData(m, guildId));

				if (append) {
					setSearchMembers((prev) => [...prev, ...displayMembers]);
				} else {
					setSearchMembers(displayMembers);
				}

				setOffset(offsetVal + response.page_result_count);
				setHasMore(offsetVal + response.page_result_count < response.total_result_count);
				setInitialLoadDone(true);
			} catch (error) {
				if (controller.signal.aborted) {
					return;
				}
				logger.error('Failed to search guild members:', error);
				setSearchError(true);
				setHasMore(false);
				setInitialLoadDone(true);
			} finally {
				if (!controller.signal.aborted) {
					setIsLoading(false);
					setIsSearching(false);
					isLoadingRef.current = false;
				}
			}
		},
		[guildId, sortMode, pageSize, roleFilter, memberSinceFilter, joinedFluxerFilter, joinMethodFilter],
	);

	useEffect(() => {
		setOffset(0);
		setHasMore(false);
		setSearchError(false);
		performSearch({query: searchQuery || undefined, offsetVal: 0});
	}, [performSearch, searchQuery]);

	useEffect(() => {
		if (!indexing) return;
		const interval = setInterval(() => {
			performSearch({offsetVal: 0});
		}, INDEXING_POLL_INTERVAL_MS);
		return () => clearInterval(interval);
	}, [indexing, performSearch]);

	const [membersVerified, setMembersVerified] = useState(false);

	useEffect(() => {
		setMembersVerified(false);

		if (searchMembers.length === 0) {
			setMembersVerified(true);
			return;
		}

		const allUserIds = searchMembers.map((m) => m.userId);
		const inviterIds = searchMembers.map((m) => m.inviterId).filter((id): id is string => id != null);
		const idsToLoad = [...new Set([...allUserIds, ...inviterIds])];

		GuildMemberStore.ensureMembersLoaded(guildId, idsToLoad)
			.catch((error) => {
				logger.error('Failed to fetch guild members:', error);
			})
			.finally(() => {
				setMembersVerified(true);
			});
	}, [searchMembers, guildId]);

	const debouncedSetQuery = useMemo(
		() =>
			debounce((query: string) => {
				setSearchQuery(query);
			}, SEARCH_DEBOUNCE_MS),
		[],
	);

	useEffect(() => {
		return () => {
			debouncedSetQuery.cancel();
			abortControllerRef.current?.abort();
		};
	}, [debouncedSetQuery]);

	const [inputValue, setInputValue] = useState('');

	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			setInputValue(value);
			debouncedSetQuery(value);
		},
		[debouncedSetQuery],
	);

	const loadMore = useCallback(() => {
		if (isLoadingRef.current || !hasMore) {
			return;
		}
		performSearch({query: searchQuery || undefined, offsetVal: offset, append: true});
	}, [hasMore, searchQuery, offset, performSearch]);

	const handlePageSizeChange = useCallback((value: number) => {
		setPageSize(value);
	}, []);

	const handleSortMenuOpen = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>) => {
			ContextMenuActionCreators.openFromElementBottomRight(event, ({onClose}) => (
				<ContextMenuCloseProvider value={onClose}>
					<MenuGroup>
						<MenuItemRadio selected={sortMode === 'newest'} closeOnSelect onSelect={() => setSortMode('newest')}>
							{t`Newest First`}
						</MenuItemRadio>
						<MenuItemRadio selected={sortMode === 'oldest'} closeOnSelect onSelect={() => setSortMode('oldest')}>
							{t`Oldest First`}
						</MenuItemRadio>
					</MenuGroup>
				</ContextMenuCloseProvider>
			));
		},
		[sortMode, t],
	);

	const openDateRangeFilter = useCallback(
		(
			event: React.MouseEvent<HTMLButtonElement>,
			currentFilter: DateRangeFilter,
			setFilter: (filter: DateRangeFilter) => void,
		) => {
			const presets = [
				{label: t`All`, duration: 0},
				{label: t`Past 1 Hour`, duration: HOUR_MS},
				{label: t`Past 24 Hours`, duration: 24 * HOUR_MS},
				{label: t`Past 7 Days`, duration: 7 * DAY_MS},
				{label: t`Past 2 Weeks`, duration: 14 * DAY_MS},
				{label: t`Past 3 Weeks`, duration: 21 * DAY_MS},
				{label: t`Past 4 Weeks`, duration: 28 * DAY_MS},
				{label: t`Past 3 Months`, duration: 90 * DAY_MS},
			];

			const isAll = currentFilter.gte == null && currentFilter.lte == null;
			const isCustom = !isAll && !presets.some((p) => p.duration > 0 && isPresetMatch(currentFilter, p.duration));

			ContextMenuActionCreators.openFromElementBottomRight(event, ({onClose}) => (
				<ContextMenuCloseProvider value={onClose}>
					<MenuGroup>
						{presets.map((preset) => {
							const selected = preset.duration === 0 ? isAll : isPresetMatch(currentFilter, preset.duration);
							return (
								<MenuItemRadio
									key={preset.duration}
									selected={selected}
									closeOnSelect
									onSelect={() => {
										if (preset.duration === 0) {
											setFilter({});
										} else {
											setFilter({gte: Math.floor((Date.now() - preset.duration) / 1000)});
										}
									}}
								>
									{preset.label}
								</MenuItemRadio>
							);
						})}
						<MenuItemRadio
							selected={isCustom}
							closeOnSelect
							onSelect={() => {
								ModalActionCreators.push(
									ModalActionCreators.modal(() => (
										<GuildMembersDateRangeModal
											onApply={(gte, lte) => setFilter({gte, lte})}
											initialGte={currentFilter.gte}
											initialLte={currentFilter.lte}
										/>
									)),
								);
							}}
						>
							{t`Custom Range...`}
						</MenuItemRadio>
					</MenuGroup>
				</ContextMenuCloseProvider>
			));
		},
		[t],
	);

	const handleMemberSinceFilterOpen = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>) => {
			openDateRangeFilter(event, memberSinceFilter, setMemberSinceFilter);
		},
		[openDateRangeFilter, memberSinceFilter],
	);

	const handleJoinedFluxerFilterOpen = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>) => {
			openDateRangeFilter(event, joinedFluxerFilter, setJoinedFluxerFilter);
		},
		[openDateRangeFilter, joinedFluxerFilter],
	);

	const handleJoinMethodFilterOpen = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>) => {
			const inviteCodes = new Set<string>();
			for (const m of searchMembers) {
				if (m.sourceInviteCode) {
					inviteCodes.add(m.sourceInviteCode);
				}
			}

			const vanityCode = guild?.vanityURLCode;
			const isAll =
				(joinMethodFilter.inviteCode == null || joinMethodFilter.inviteCode.length === 0) &&
				(joinMethodFilter.sourceType == null || joinMethodFilter.sourceType.length === 0);

			ContextMenuActionCreators.openFromElementBottomRight(event, ({onClose}) => (
				<ContextMenuCloseProvider value={onClose}>
					<MenuGroup>
						<MenuItemRadio selected={isAll} closeOnSelect onSelect={() => setJoinMethodFilter({})}>
							{t`All`}
						</MenuItemRadio>
						{vanityCode && (
							<MenuItemRadio
								selected={joinMethodFilter.inviteCode?.includes(vanityCode) ?? false}
								closeOnSelect
								onSelect={() => setJoinMethodFilter({inviteCode: [vanityCode]})}
							>
								{t`Vanity URL`}
							</MenuItemRadio>
						)}
						{Array.from(inviteCodes).map((code) => (
							<MenuItemRadio
								key={code}
								selected={joinMethodFilter.inviteCode?.includes(code) ?? false}
								closeOnSelect
								onSelect={() => setJoinMethodFilter({inviteCode: [code]})}
							>
								{code}
							</MenuItemRadio>
						))}
					</MenuGroup>
				</ContextMenuCloseProvider>
			));
		},
		[searchMembers, guild?.vanityURLCode, joinMethodFilter, t],
	);

	const handleRolesFilterOpen = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>) => {
			ContextMenuActionCreators.openFromElementBottomRight(event, ({onClose}) => (
				<RolesFilterMenuContent
					roles={roles}
					initialRoleFilter={roleFilter}
					setRoleFilter={setRoleFilter}
					onClose={onClose}
				/>
			));
		},
		[roles, roleFilter],
	);

	const handleRowClick = useCallback(
		(data: MemberDisplayData) => {
			UserProfileActionCreators.openUserProfile(data.userId, guildId);
		},
		[guildId],
	);

	const handleRowContextMenu = useCallback(
		(data: MemberDisplayData, event: React.MouseEvent<HTMLElement>) => {
			const user = data.user ?? UserStore.getUser(data.userId);
			if (!user) return;

			setContextMenuMemberId(data.userId);
			ContextMenuActionCreators.openFromEvent(
				event,
				({onClose}) => (
					<GuildMemberContextMenu
						user={user}
						onClose={() => {
							onClose();
							setContextMenuMemberId(null);
						}}
						guildId={guildId}
					/>
				),
				{onClose: () => setContextMenuMemberId(null)},
			);
		},
		[guildId],
	);

	const handleActionsClick = useCallback(
		(data: MemberDisplayData, event: React.MouseEvent<HTMLElement>) => {
			const user = data.user ?? UserStore.getUser(data.userId);
			if (!user) return;

			setActiveMenuMemberId(data.userId);
			ContextMenuActionCreators.openFromElementBottomRight(
				event,
				({onClose}) => (
					<GuildMemberContextMenu
						user={user}
						onClose={() => {
							onClose();
							setActiveMenuMemberId(null);
						}}
						guildId={guildId}
					/>
				),
				{onClose: () => setActiveMenuMemberId(null)},
			);
		},
		[guildId],
	);

	if (!guild) {
		return null;
	}

	const displayedMembers = membersVerified
		? searchMembers.filter((m) => GuildMemberStore.getMember(guildId, m.userId) != null)
		: searchMembers;

	const dataReady = initialLoadDone && membersVerified && !isSearching && !indexing;
	const showProgress = !dataReady;
	const showEmptySearch = dataReady && displayedMembers.length === 0 && !searchError;
	const showError = dataReady && searchError;
	const memberSinceActive = memberSinceFilter.gte != null || memberSinceFilter.lte != null;
	const joinedFluxerActive = joinedFluxerFilter.gte != null || joinedFluxerFilter.lte != null;
	const joinMethodActive =
		(joinMethodFilter.sourceType != null && joinMethodFilter.sourceType.length > 0) ||
		(joinMethodFilter.inviteCode != null && joinMethodFilter.inviteCode.length > 0);
	const rolesActive = roleFilter.length > 0;

	return (
		<div className={styles.pageContainer}>
			<div className={styles.content}>
				<div className={styles.toolbar}>
					<div className={styles.toolbarLeft}>
						<h2 className={styles.toolbarTitle}>
							<Trans>Recent Members</Trans>
						</h2>
					</div>
					<div className={styles.toolbarRight}>
						<Input
							type="text"
							placeholder={t`Search by username or ID`}
							value={inputValue}
							onChange={handleInputChange}
							disabled={indexing}
							leftIcon={<MagnifyingGlassIcon size={16} weight="bold" />}
							className={styles.searchInput}
						/>
						<Button
							variant="secondary"
							leftIcon={<SortAscendingIcon size={16} weight="bold" />}
							className={styles.sortButton}
							onClick={handleSortMenuOpen}
							disabled={indexing}
						>
							{t`Sort`}
						</Button>
					</div>
				</div>

				<div className={styles.tableWrapper}>
					<Scroller fade={false} scrollbar="thin">
						<Scroller orientation="horizontal" fade={false} scrollbar="thin">
							<table className={styles.table}>
								<thead className={styles.tableHead}>
									<tr className={styles.tableHeadRow}>
										<th className={clsx(styles.th, styles.nameCol)}>
											<Trans>Name</Trans>
										</th>
										<th className={clsx(styles.th, styles.dateCol)}>
											<div className={styles.thContent}>
												<Trans>Member Since</Trans>
												<button
													type="button"
													className={clsx(styles.filterButton, memberSinceActive && styles.filterButtonActive)}
													onClick={handleMemberSinceFilterOpen}
												>
													<FunnelIcon size={12} weight={memberSinceActive ? 'fill' : 'bold'} />
												</button>
											</div>
										</th>
										<th className={clsx(styles.th, styles.dateCol)}>
											<div className={styles.thContent}>
												<Trans>Joined Fluxer</Trans>
												<button
													type="button"
													className={clsx(styles.filterButton, joinedFluxerActive && styles.filterButtonActive)}
													onClick={handleJoinedFluxerFilterOpen}
												>
													<FunnelIcon size={12} weight={joinedFluxerActive ? 'fill' : 'bold'} />
												</button>
											</div>
										</th>
										<th className={clsx(styles.th, styles.joinMethodCol)}>
											<div className={styles.thContent}>
												<Trans>Join Method</Trans>
												<button
													type="button"
													className={clsx(styles.filterButton, joinMethodActive && styles.filterButtonActive)}
													onClick={handleJoinMethodFilterOpen}
												>
													<FunnelIcon size={12} weight={joinMethodActive ? 'fill' : 'bold'} />
												</button>
											</div>
										</th>
										<th className={clsx(styles.th, styles.rolesCol)}>
											<div className={styles.thContent}>
												<Trans>Roles</Trans>
												<button
													type="button"
													className={clsx(styles.filterButton, rolesActive && styles.filterButtonActive)}
													onClick={handleRolesFilterOpen}
												>
													<FunnelIcon size={12} weight={rolesActive ? 'fill' : 'bold'} />
												</button>
											</div>
										</th>
										<th className={clsx(styles.th, styles.actionsCol)} />
									</tr>
									{showProgress && (
										<tr className={styles.progressRow}>
											<th colSpan={6} className={styles.progressCell}>
												<div className={styles.progressTrack}>
													<motion.div
														className={styles.progressBar}
														animate={{x: ['-100%', '333%']}}
														transition={{
															duration: 1.4,
															repeat: Infinity,
															ease: 'easeInOut',
														}}
													/>
												</div>
											</th>
										</tr>
									)}
								</thead>
								<tbody>
									{showProgress ? null : showError ? (
										<tr>
											<td colSpan={6} className={styles.td}>
												<div className={styles.emptyState}>
													<p className={styles.emptyStateText}>
														<Trans>Something went wrong loading members. Try again later.</Trans>
													</p>
												</div>
											</td>
										</tr>
									) : showEmptySearch ? (
										<tr>
											<td colSpan={6} className={styles.td}>
												<div className={styles.emptyState}>
													<p className={styles.emptyStateText}>
														<Trans>No members found matching your search.</Trans>
													</p>
												</div>
											</td>
										</tr>
									) : (
										displayedMembers.map((data) => (
											<MemberTableRow
												key={data.userId}
												data={data}
												guildId={guildId}
												isOwner={guild.ownerId === data.userId}
												activeMenuMemberId={activeMenuMemberId}
												contextMenuMemberId={contextMenuMemberId}
												onActionsClick={handleActionsClick}
												onContextMenu={handleRowContextMenu}
												onRowClick={handleRowClick}
											/>
										))
									)}
								</tbody>
							</table>
						</Scroller>
						{initialLoadDone && hasMore && (
							<div className={styles.loadMoreContainer}>
								<Button variant="secondary" compact onClick={loadMore} submitting={isLoading}>
									<Trans>Load More</Trans>
								</Button>
							</div>
						)}
					</Scroller>
					{totalCount > 0 && (
						<div className={styles.footer}>
							<Trans>Showing</Trans>
							<div className={styles.pageSizeSelect}>
								<Select<number> value={pageSize} options={PAGE_SIZE_OPTIONS} onChange={handlePageSizeChange} />
							</div>
							<Trans>members of {totalCount}</Trans>
						</div>
					)}
				</div>
			</div>
		</div>
	);
});

interface GuildMembersPageProps {
	guildId: string;
}

export const GuildMembersPage: React.FC<GuildMembersPageProps> = observer(({guildId}) => {
	const {t} = useLingui();
	const guild = GuildStore.getGuild(guildId);

	useFluxerDocumentTitle(useMemo(() => [t`Members`, guild?.name], [t, guild?.name]));

	const headerLeftContent = useMemo(
		() => (
			<div className={styles.headerLeftContent}>
				<UsersIcon className={styles.headerIcon} size={20} />
				<span className={styles.headerLabel}>{t`Members`}</span>
			</div>
		),
		[t],
	);

	return (
		<ChannelViewScaffold
			header={<ChannelHeader leftContent={headerLeftContent} showMembersToggle={false} showPins={false} />}
			chatArea={<MembersTableView guildId={guildId} />}
		/>
	);
});
