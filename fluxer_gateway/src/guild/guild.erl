%% Copyright (C) 2026 Fluxer Contributors
%%
%% This file is part of Fluxer.
%%
%% Fluxer is free software: you can redistribute it and/or modify
%% it under the terms of the GNU Affero General Public License as published by
%% the Free Software Foundation, either version 3 of the License, or
%% (at your option) any later version.
%%
%% Fluxer is distributed in the hope that it will be useful,
%% but WITHOUT ANY WARRANTY; without even the implied warranty of
%% MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
%% GNU Affero General Public License for more details.
%%
%% You should have received a copy of the GNU Affero General Public License
%% along with Fluxer. If not, see <https://www.gnu.org/licenses/>.

-module(guild).
-behaviour(gen_server).

-export([start_link/1, update_counts/1]).
-export([init/1, handle_call/3, handle_cast/2, handle_info/2, terminate/2, code_change/3]).

-define(SESSION_CONNECT_MAX_WORKERS, 2).

-type guild_id() :: integer().
-type user_id() :: integer().
-type session_id() :: binary().
-type channel_id() :: integer().
-type guild_state() :: #{
    id := guild_id(),
    data := map(),
    sessions := map(),
    voice_states := map(),
    presence_subscriptions := map(),
    member_list_subscriptions := map(),
    member_subscriptions := map(),
    member_presence := map(),
    member_count := non_neg_integer(),
    online_count := non_neg_integer(),
    pending_voice_connections => map()
}.

-spec start_link(map()) -> {ok, pid()} | {error, term()}.
start_link(GuildState) ->
    gen_server:start_link(?MODULE, GuildState, []).

-spec init(map()) -> {ok, guild_state()}.
init(GuildState) ->
    process_flag(trap_exit, true),
    Data0 = maps:get(data, GuildState, #{}),
    NormalizedData = guild_data_index:normalize_data(Data0),
    GuildState1 = maps:put(data, NormalizedData, GuildState),
    StateWithVoice =
        case maps:is_key(voice_states, GuildState1) of
            true -> GuildState1;
            false -> maps:put(voice_states, #{}, GuildState1)
        end,
    StateWithPresenceSubs = maps:put(presence_subscriptions, #{}, StateWithVoice),
    StateWithMemberListSubs = maps:put(member_list_subscriptions, #{}, StateWithPresenceSubs),
    StateWithMemberSubs = maps:put(
        member_subscriptions, guild_subscriptions:init_state(), StateWithMemberListSubs
    ),
    StateWithMemberPresence = maps:put(member_presence, #{}, StateWithMemberSubs),
    Data = maps:get(data, StateWithMemberPresence, #{}),
    MemberCount =
        case maps:get(member_count, StateWithMemberPresence, undefined) of
            N when is_integer(N), N >= 0 -> N;
            _ -> guild_data_index:member_count(Data)
        end,
    StateWithCounts = maps:put(member_count, MemberCount, StateWithMemberPresence),
    OnlineCount = guild_member_list:get_online_count(StateWithCounts),
    StateWithCountsAndOnline = maps:put(online_count, OnlineCount, StateWithCounts),
    ok = maybe_put_permission_cache(StateWithCountsAndOnline),
    _ = guild_availability:update_unavailability_cache_for_state(StateWithCountsAndOnline),
    guild_passive_sync:schedule_passive_sync(StateWithCountsAndOnline),
    erlang:send_after(10000, self(), sweep_pending_joins),
    {ok, StateWithCountsAndOnline}.

-spec handle_call(term(), gen_server:from(), guild_state()) ->
    {reply, term(), guild_state()}
    | {noreply, guild_state()}
    | {stop, term(), term(), guild_state()}.
handle_call({session_connect, Request}, {CallerPid, _}, State) ->
    SessionPid = maps:get(session_pid, Request, CallerPid),
    guild_sessions:handle_session_connect(Request, SessionPid, State);
handle_call({very_large_guild_prime_member, Member}, _From, State) when is_map(Member) ->
    Data0 = maps:get(data, State, #{}),
    Data = guild_data_index:put_member(Member, Data0),
    {reply, ok, maps:put(data, Data, State)};
handle_call({very_large_guild_prime_member, _}, _From, State) ->
    {reply, ok, State};
handle_call({very_large_guild_get_members, UserIds}, _From, State) when is_list(UserIds) ->
    Data = maps:get(data, State, #{}),
    MemberMap = guild_data_index:member_map(Data),
    Reply = lists:foldl(
        fun(UserId, Acc) ->
            case maps:get(UserId, MemberMap, undefined) of
                Member when is_map(Member) -> maps:put(UserId, Member, Acc);
                _ -> Acc
            end
        end,
        #{},
        UserIds
    ),
    {reply, Reply, State};
handle_call({get_counts}, _From, State) ->
    MemberCount = maps:get(member_count, State, 0),
    OnlineCount = guild_member_list:get_online_count(State),
    {reply, #{member_count => MemberCount, presence_count => OnlineCount}, State};
handle_call({get_large_guild_metadata}, _From, State) ->
    MemberCount = maps:get(member_count, State, 0),
    Data = maps:get(data, State, #{}),
    Guild = maps:get(<<"guild">>, Data, #{}),
    Features = maps:get(<<"features">>, Guild, []),
    {reply, #{member_count => MemberCount, features => Features}, State};
handle_call({get_users_to_mention_by_roles, Request}, _From, State) ->
    spawn_async_reply(
        _From,
        fun() ->
            {reply, Reply, _} = guild_members:get_users_to_mention_by_roles(Request, State),
            Reply
        end
    ),
    {noreply, State};
handle_call({get_users_to_mention_by_user_ids, Request}, _From, State) ->
    spawn_async_reply(
        _From,
        fun() ->
            {reply, Reply, _} = guild_members:get_users_to_mention_by_user_ids(Request, State),
            Reply
        end
    ),
    {noreply, State};
handle_call({get_all_users_to_mention, Request}, _From, State) ->
    spawn_async_reply(
        _From,
        fun() ->
            {reply, Reply, _} = guild_members:get_all_users_to_mention(Request, State),
            Reply
        end
    ),
    {noreply, State};
handle_call({resolve_all_mentions, Request}, _From, State) ->
    spawn_async_reply(
        _From,
        fun() ->
            {reply, Reply, _} = guild_members:resolve_all_mentions(Request, State),
            Reply
        end
    ),
    {noreply, State};
handle_call({get_members_with_role, Request}, _From, State) ->
    spawn_async_reply(
        _From,
        fun() ->
            {reply, Reply, _} = guild_members:get_members_with_role(Request, State),
            Reply
        end
    ),
    {noreply, State};
handle_call({check_permission, Request}, _From, State) ->
    #{user_id := UserId, permission := Permission, channel_id := ChannelId} = Request,
    true = is_integer(Permission),
    HasPermission =
        case owner_id(State) =:= UserId of
            true ->
                true;
            false ->
                Permissions = guild_permissions:get_member_permissions(UserId, ChannelId, State),
                (Permissions band Permission) =:= Permission
        end,
    {reply, #{has_permission => HasPermission}, State};
handle_call({get_user_permissions, Request}, _From, State) ->
    #{user_id := UserId, channel_id := ChannelId} = Request,
    Permissions = guild_permissions:get_member_permissions(UserId, ChannelId, State),
    {reply, #{permissions => Permissions}, State};
handle_call({can_manage_roles, Request}, _From, State) ->
    guild_members:can_manage_roles(Request, State);
handle_call({can_manage_role, Request}, _From, State) ->
    guild_members:can_manage_role(Request, State);
handle_call({get_guild_data, Request}, _From, State) ->
    guild_data:get_guild_data(Request, State);
handle_call({get_assignable_roles, Request}, _From, State) ->
    guild_members:get_assignable_roles(Request, State);
handle_call({get_user_max_role_position, Request}, _From, State) ->
    #{user_id := UserId} = Request,
    Position = guild_permissions:get_max_role_position(UserId, State),
    {reply, #{position => Position}, State};
handle_call({check_target_member, Request}, _From, State) ->
    guild_members:check_target_member(Request, State);
handle_call({get_viewable_channels, Request}, _From, State) ->
    spawn_async_reply(
        _From,
        fun() ->
            {reply, Reply, _} = guild_members:get_viewable_channels(Request, State),
            Reply
        end
    ),
    {noreply, State};
handle_call({get_guild_member, Request}, _From, State) ->
    guild_data:get_guild_member(Request, State);
handle_call({has_member, Request}, _From, State) ->
    guild_data:has_member(Request, State);
handle_call({list_guild_members, Request}, _From, State) ->
    guild_data:list_guild_members(Request, State);
handle_call({list_guild_members_cursor, Request}, _From, State) ->
    guild_member_list:get_members_cursor(Request, State);
handle_call({get_vanity_url_channel}, _From, State) ->
    guild_data:get_vanity_url_channel(State);
handle_call({get_first_viewable_text_channel}, _From, State) ->
    guild_data:get_first_viewable_text_channel(State);
handle_call({voice_state_update, Request}, _From, State) ->
    guild_voice:voice_state_update(Request, State);
handle_call({get_voice_state, Request}, _From, State) ->
    guild_voice:get_voice_state(Request, State);
handle_call({update_member_voice, Request}, _From, State) ->
    guild_voice:update_member_voice(Request, State);
handle_call({disconnect_voice_user, Request}, _From, State) ->
    guild_voice:disconnect_voice_user(Request, State);
handle_call({disconnect_voice_user_if_in_channel, Request}, _From, State) ->
    guild_voice:disconnect_voice_user_if_in_channel(Request, State);
handle_call({disconnect_all_voice_users_in_channel, Request}, _From, State) ->
    guild_voice:disconnect_all_voice_users_in_channel(Request, State);
handle_call({confirm_voice_connection_from_livekit, Request}, _From, State) ->
    guild_voice:confirm_voice_connection_from_livekit(Request, State);
handle_call({move_member, Request}, _From, State) ->
    guild_voice:move_member(Request, State);
handle_call({switch_voice_region, Request}, _From, State) ->
    guild_voice:switch_voice_region_handler(Request, State);
handle_call({add_virtual_channel_access, UserId, ChannelId}, _From, State) ->
    NewState = guild_virtual_channel_access:add_virtual_access(UserId, ChannelId, State),
    guild_virtual_channel_access:dispatch_channel_visibility_change(
        UserId, ChannelId, add, NewState
    ),
    {reply, ok, NewState};
handle_call({get_sessions}, _From, State) ->
    {reply, State, State};
handle_call({get_push_base_state}, _From, State) ->
    {reply,
        #{
            id => maps:get(id, State, 0),
            data => maps:get(data, State, #{}),
            virtual_channel_access => maps:get(virtual_channel_access, State, #{})
        },
        State};
handle_call({get_cluster_merge_state}, _From, State) ->
    {reply,
        #{
            sessions => maps:get(sessions, State, #{}),
            voice_states => maps:get(voice_states, State, #{}),
            virtual_channel_access => maps:get(virtual_channel_access, State, #{}),
            virtual_channel_access_pending => maps:get(virtual_channel_access_pending, State, #{}),
            virtual_channel_access_preserve => maps:get(virtual_channel_access_preserve, State, #{}),
            virtual_channel_access_move_pending =>
                maps:get(virtual_channel_access_move_pending, State, #{})
        },
        State};
handle_call({get_category_channel_count, Request}, _From, State) ->
    #{category_id := CategoryId} = Request,
    Data = maps:get(data, State),
    Channels = maps:get(<<"channels">>, Data, []),
    Count = length([
        Ch
     || Ch <- Channels,
        map_utils:get_integer(Ch, <<"parent_id">>, undefined) =:= CategoryId
    ]),
    {reply, #{count => Count}, State};
handle_call({get_channel_count}, _From, State) ->
    Data = maps:get(data, State),
    Channels = maps:get(<<"channels">>, Data, []),
    Count = length(Channels),
    {reply, #{count => Count}, State};
handle_call({reload, NewData}, _From, State) ->
    OldData = maps:get(data, State),
    NormalizedNewData0 = guild_data_index:normalize_data(NewData),
    NormalizedNewData = maybe_merge_very_large_guild_member_cache_on_reload(
        OldData, NormalizedNewData0, State
    ),
    NewState0 = maps:put(data, NormalizedNewData, State),
    NewState1 = guild_availability:handle_unavailability_transition(State, NewState0),
    NewState2 = guild_sessions:refresh_all_viewable_channels(NewState1),
    GuildId = maps:get(id, State),
    NewGuild = maps:get(<<"guild">>, NormalizedNewData, #{}),
    Sessions = maps:get(sessions, NewState2, #{}),
    Pids = [
        maps:get(pid, S)
     || {_Sid, S} <- maps:to_list(Sessions),
        maps:get(pending_connect, S, false) =/= true
    ],
    EventData = maps:put(<<"guild_id">>, integer_to_binary(GuildId), NewGuild),
    dispatch_to_pids(Pids, guild_update, EventData),
    NewState = cleanup_removed_member_subscriptions(OldData, NormalizedNewData, NewState2),
    NewStateAfterMemberPrune = maybe_prune_very_large_guild_members(NewState),
    ok = maybe_put_permission_cache(NewStateAfterMemberPrune),
    {reply, ok, NewStateAfterMemberPrune};
handle_call({dispatch, Request}, _From, State) ->
    #{event := Event, data := EventData} = Request,
    ParsedEventData = parse_event_data(EventData),
    {noreply, NewState} = guild_dispatch:handle_dispatch(Event, ParsedEventData, State),
    StateAfterPrune = maybe_prune_invalid_member_subscriptions(Event, NewState),
    StateAfterMemberPrune = maybe_prune_very_large_guild_members(StateAfterPrune),
    ok = maybe_put_permission_cache(StateAfterMemberPrune),
    {reply, ok, StateAfterMemberPrune};
handle_call({terminate}, _From, State) ->
    {stop, normal, ok, State};
handle_call({lazy_subscribe, Request}, _From, State) ->
    handle_lazy_subscribe(Request, State);
handle_call({store_pending_connection, ConnectionId, Metadata}, _From, State) ->
    PendingConnections = maps:get(pending_voice_connections, State, #{}),
    NewPendingConnections = maps:put(ConnectionId, Metadata, PendingConnections),
    NewState = maps:put(pending_voice_connections, NewPendingConnections, State),
    {reply, ok, NewState};
handle_call({get_voice_states_for_channel, ChannelIdBin}, _From, State) ->
    VoiceStates = maps:get(voice_states, State, #{}),
    Filtered = maps:fold(
        fun(ConnId, VS, Acc) ->
            case maps:get(<<"channel_id">>, VS, null) of
                ChannelIdBin ->
                    [#{
                        connection_id => ConnId,
                        user_id => maps:get(<<"user_id">>, VS, null),
                        channel_id => ChannelIdBin
                    } | Acc];
                _ ->
                    Acc
            end
        end,
        [],
        VoiceStates
    ),
    {reply, #{voice_states => Filtered}, State};
handle_call({get_pending_joins_for_channel, ChannelIdBin}, _From, State) ->
    PendingConnections = maps:get(pending_voice_connections, State, #{}),
    ChannelIdInt = binary_to_integer(ChannelIdBin),
    Filtered = maps:fold(
        fun(ConnId, Metadata, Acc) ->
            case maps:get(channel_id, Metadata, undefined) of
                ChannelIdInt ->
                    [#{
                        connection_id => ConnId,
                        user_id => integer_to_binary(maps:get(user_id, Metadata, 0)),
                        token_nonce => maps:get(token_nonce, Metadata, null),
                        expires_at => maps:get(expires_at, Metadata, 0)
                    } | Acc];
                _ ->
                    Acc
            end
        end,
        [],
        PendingConnections
    ),
    {reply, #{pending_joins => Filtered}, State};
handle_call(_, _From, State) ->
    {reply, ok, State}.

-spec handle_cast(term(), guild_state()) -> {noreply, guild_state()}.
handle_cast({dispatch, Request}, State) ->
    #{event := Event, data := EventData} = Request,
    ParsedEventData = parse_event_data(EventData),
    {noreply, NewState} = guild_dispatch:handle_dispatch(Event, ParsedEventData, State),
    StateAfterPrune = maybe_prune_invalid_member_subscriptions(Event, NewState),
    StateAfterMemberPrune = maybe_prune_very_large_guild_members(StateAfterPrune),
    ok = maybe_put_permission_cache(StateAfterMemberPrune),
    {noreply, StateAfterMemberPrune};
handle_cast({session_connect_async, #{guild_id := GuildId, attempt := Attempt, request := Request} = Msg}, State) ->
    {noreply, enqueue_session_connect_async(GuildId, Attempt, Request, Msg, State)};
handle_cast({session_connect_worker_done, SessionId, Attempt, Result0, Computed}, State) ->
    {noreply, finalize_session_connect_async(SessionId, Attempt, Result0, Computed, State)};
handle_cast({very_large_guild_drop_member, UserId}, State) when is_integer(UserId) ->
    Data0 = maps:get(data, State, #{}),
    Data = guild_data_index:remove_member(UserId, Data0),
    {noreply, maps:put(data, Data, State)};
handle_cast({very_large_guild_drop_member, _}, State) ->
    {noreply, State};
handle_cast({very_large_guild_prune_members}, State) ->
    {noreply, maybe_prune_very_large_guild_members(State)};
handle_cast({relay_voice_state_update, VoiceState, OldChannelIdBin}, State) ->
    State1 = relay_upsert_voice_state(VoiceState, State),
    StateNoRelay = maps:remove(very_large_guild_coordinator_pid, State1),
    _ = guild_voice_broadcast:broadcast_voice_state_update(VoiceState, StateNoRelay, OldChannelIdBin),
    {noreply, State1};
handle_cast(
    {relay_voice_server_update, GuildId, ChannelId, SessionId, Token, Endpoint, ConnectionId},
    State
) ->
    StateNoRelay = maps:remove(very_large_guild_coordinator_pid, State),
    _ = guild_voice_broadcast:broadcast_voice_server_update_to_session(
        GuildId,
        ChannelId,
        SessionId,
        Token,
        Endpoint,
        ConnectionId,
        StateNoRelay
    ),
    {noreply, State};
handle_cast({store_pending_connection, ConnectionId, Metadata}, State) ->
    PendingConnections = maps:get(pending_voice_connections, State, #{}),
    NewPendingConnections = maps:put(ConnectionId, Metadata, PendingConnections),
    NewState = maps:put(pending_voice_connections, NewPendingConnections, State),
    {noreply, NewState};
handle_cast({very_large_guild_member_list_deliver, Deliveries}, State) when is_list(Deliveries) ->
    _ = deliver_member_list_updates(Deliveries, State),
    {noreply, State};
handle_cast({add_virtual_channel_access, UserId, ChannelId}, State) ->
    NewState = guild_virtual_channel_access:add_virtual_access(UserId, ChannelId, State),
    guild_virtual_channel_access:dispatch_channel_visibility_change(
        UserId, ChannelId, add, NewState
    ),
    {noreply, NewState};
handle_cast({remove_virtual_channel_access, UserId, ChannelId}, State) ->
    guild_virtual_channel_access:dispatch_channel_visibility_change(
        UserId, ChannelId, remove, State
    ),
    NewState = guild_virtual_channel_access:remove_virtual_access(UserId, ChannelId, State),
    {noreply, NewState};
handle_cast({cleanup_virtual_access_for_user, UserId}, State) ->
    NewState = guild_voice_disconnect:cleanup_virtual_channel_access_for_user(UserId, State),
    {noreply, NewState};
handle_cast({set_session_active, SessionId}, State) ->
    GuildId = maps:get(id, State),
    NewState = guild_sessions:set_session_active_guild(SessionId, GuildId, State),
    {noreply, NewState};
handle_cast({set_session_passive, SessionId}, State) ->
    GuildId = maps:get(id, State),
    NewState = guild_sessions:set_session_passive_guild(SessionId, GuildId, State),
    {noreply, NewState};
handle_cast({update_member_subscriptions, SessionId, MemberIds}, State) ->
    NewState0 = handle_update_member_subscriptions(SessionId, MemberIds, State),
    NewState = maybe_prune_very_large_guild_members(NewState0),
    {noreply, NewState};
handle_cast({set_session_typing_override, SessionId, TypingFlag}, State) ->
    NewState = handle_set_typing_override(SessionId, TypingFlag, State),
    {noreply, NewState};
handle_cast({send_guild_sync, SessionId}, State) ->
    NewState = handle_send_guild_sync(SessionId, State),
    {noreply, NewState};
handle_cast({send_members_chunk, SessionId, ChunkData}, State) ->
    handle_send_members_chunk(SessionId, ChunkData, State),
    {noreply, State};
handle_cast(_, State) ->
    {noreply, State}.

-spec handle_info(term(), guild_state()) ->
    {noreply, guild_state()} | {stop, normal, guild_state()}.
handle_info({presence, UserId, Payload}, State) ->
    guild_presence:handle_bus_presence(UserId, Payload, State);
handle_info({'DOWN', Ref, process, _Pid, Reason}, State) ->
    WorkerRefs = maps:get(session_connect_worker_refs, State, #{}),
    case maps:is_key(Ref, WorkerRefs) of
        true ->
            State1 = maps:put(session_connect_worker_refs, maps:remove(Ref, WorkerRefs), State),
            case Reason of
                normal ->
                    {noreply, State1};
                _ ->
                    State2 = decrement_session_connect_inflight(State1),
                    {noreply, maybe_start_session_connect_workers(State2)}
            end;
        false ->
            guild_sessions:handle_session_down(Ref, State)
    end;
handle_info(passive_sync, State) ->
    guild_passive_sync:handle_passive_sync(State);
handle_info(sweep_pending_joins, State) ->
    NewState = guild_voice_connection:sweep_expired_pending_joins(State),
    erlang:send_after(10000, self(), sweep_pending_joins),
    {noreply, NewState};
handle_info(_, State) ->
    {noreply, State}.

-spec terminate(term(), guild_state() | term()) -> ok.
terminate(Reason, State) when is_map(State) ->
    PresenceSubs = maps:get(presence_subscriptions, State, #{}),
    lists:foreach(fun(UserId) -> presence_bus:unsubscribe(UserId) end, maps:keys(PresenceSubs)),
    GuildId = maps:get(id, State, undefined),
    ok = maybe_delete_permission_cache(GuildId, State),
    maybe_report_crash(Reason, State),
    ok;
terminate(Reason, State) ->
    maybe_report_crash(Reason, State),
    ok.

-spec code_change(term(), guild_state(), term()) -> {ok, guild_state()}.
code_change(_OldVsn, State, _Extra) ->
    {ok, State}.

-spec maybe_put_permission_cache(guild_state()) -> ok.
maybe_put_permission_cache(State) ->
    case maps:get(disable_permission_cache_updates, State, false) of
        true ->
            ok;
        false ->
            guild_permission_cache:put_state(State)
    end.

-spec maybe_delete_permission_cache(term(), guild_state()) -> ok.
maybe_delete_permission_cache(GuildId, State) ->
    case maps:get(disable_permission_cache_updates, State, false) of
        true ->
            ok;
        false ->
            guild_permission_cache:delete(GuildId)
    end.

-spec relay_upsert_voice_state(map(), guild_state()) -> guild_state().
relay_upsert_voice_state(VoiceState, State) when is_map(VoiceState) ->
    ConnectionId = maps:get(<<"connection_id">>, VoiceState, undefined),
    case ConnectionId of
        undefined ->
            State;
        _ ->
            VoiceStates0 = maps:get(voice_states, State, #{}),
            ChannelId = maps:get(<<"channel_id">>, VoiceState, null),
            VoiceStates =
                case ChannelId of
                    null -> maps:remove(ConnectionId, VoiceStates0);
                    _ -> maps:put(ConnectionId, VoiceState, VoiceStates0)
                end,
            maps:put(voice_states, VoiceStates, State)
    end;
relay_upsert_voice_state(_, State) ->
    State.

-spec update_counts(guild_state()) -> guild_state().
update_counts(State) ->
    Data = maps:get(data, State, #{}),
    MemberCount = guild_data_index:member_count(Data),
    OnlineCount = guild_member_list:get_online_count(State),
    maps:put(member_count, MemberCount, maps:put(online_count, OnlineCount, State)).

-spec parse_event_data(binary() | map()) -> map().
parse_event_data(EventData) when is_binary(EventData) ->
    json:decode(EventData);
parse_event_data(EventData) when is_map(EventData) ->
    EventData.

-spec dispatch_to_pids([pid()], atom(), map()) -> ok.
dispatch_to_pids(Pids, Event, EventData) ->
    lists:foreach(
        fun(Pid) -> gen_server:cast(Pid, {dispatch, Event, EventData}) end,
        Pids
    ).

-spec spawn_async_reply(gen_server:from(), fun(() -> term())) -> ok.
spawn_async_reply(From, ReplyFun) ->
    spawn(fun() ->
        Reply =
            try
                ReplyFun()
            catch
                _:_ ->
                    #{error => async_handler_failed}
            end,
        gen_server:reply(From, Reply)
    end),
    ok.

-spec handle_lazy_subscribe(map(), guild_state()) -> {reply, ok, guild_state()}.
handle_lazy_subscribe(Request, State) ->
    case maps:get(disable_member_list_updates, State, false) of
        true ->
            {reply, ok, State};
        false ->
    #{session_id := SessionId, channel_id := ChannelId, ranges := Ranges} = Request,
    Sessions0 = maps:get(sessions, State, #{}),
    SessionUserId = get_session_user_id(SessionId, Sessions0),
    case
        is_integer(SessionUserId) andalso
            guild_permissions:can_view_channel(SessionUserId, ChannelId, undefined, State)
    of
        true ->
            GuildId = maps:get(id, State),
            ListId = guild_member_list:calculate_list_id(ChannelId, State),
            {NewState, ShouldSendSync, NormalizedRanges} =
                guild_member_list:subscribe_ranges(SessionId, ListId, Ranges, State),
            handle_lazy_subscribe_sync(
                ShouldSendSync, NormalizedRanges, GuildId, ListId, ChannelId, SessionId, NewState
            );
        false ->
            {reply, ok, State}
    end
    end.

-spec handle_lazy_subscribe_sync(
    boolean(), list(), guild_id(), term(), channel_id(), session_id(), guild_state()
) ->
    {reply, ok, guild_state()}.
handle_lazy_subscribe_sync(true, [], _GuildId, _ListId, _ChannelId, _SessionId, State) ->
    {reply, ok, State};
handle_lazy_subscribe_sync(true, RangesToSend, GuildId, ListId, ChannelId, SessionId, State) ->
    SyncResponse = guild_member_list:build_sync_response(GuildId, ListId, RangesToSend, State),
    SyncResponseWithChannel = maps:put(
        <<"channel_id">>, integer_to_binary(ChannelId), SyncResponse
    ),
    Sessions = maps:get(sessions, State, #{}),
    case maps:get(SessionId, Sessions, undefined) of
        #{pid := SessionPid} when is_pid(SessionPid) ->
            gen_server:cast(
                SessionPid, {dispatch, guild_member_list_update, SyncResponseWithChannel}
            );
        _ ->
            ok
    end,
    {reply, ok, State};
handle_lazy_subscribe_sync(_, _, _GuildId, _ListId, _ChannelId, _SessionId, State) ->
    {reply, ok, State}.

-spec get_session_user_id(session_id(), map()) -> user_id() | undefined.
get_session_user_id(SessionId, Sessions) ->
    case maps:get(SessionId, Sessions, undefined) of
        #{user_id := Uid} -> Uid;
        _ -> undefined
    end.

-spec handle_update_member_subscriptions(session_id(), [user_id()], guild_state()) -> guild_state().
handle_update_member_subscriptions(SessionId, MemberIds, State) ->
    MemberSubs = maps:get(member_subscriptions, State, guild_subscriptions:init_state()),
    Sessions = maps:get(sessions, State, #{}),
    SessionUserId = get_session_user_id(SessionId, Sessions),
    StateWithPrimedMembers = maybe_prime_very_large_guild_members(MemberIds, State),
    FilteredMemberIds = filter_member_ids_with_mutual_channels(
        SessionUserId, MemberIds, StateWithPrimedMembers
    ),
    OldSubscriptions = guild_subscriptions:get_user_ids_for_session(SessionId, MemberSubs),
    NewMemberSubs = guild_subscriptions:update_subscriptions(
        SessionId, FilteredMemberIds, MemberSubs
    ),
    NewSubscriptions = guild_subscriptions:get_user_ids_for_session(SessionId, NewMemberSubs),
    Added = sets:to_list(sets:subtract(NewSubscriptions, OldSubscriptions)),
    Removed = sets:to_list(sets:subtract(OldSubscriptions, NewSubscriptions)),
    State1 = maps:put(member_subscriptions, NewMemberSubs, StateWithPrimedMembers),
    State2 = handle_added_subscriptions(Added, SessionId, State1),
    handle_removed_subscriptions(Removed, State2).

-spec handle_added_subscriptions([user_id()], session_id(), guild_state()) -> guild_state().
handle_added_subscriptions(Added, SessionId, State) ->
    lists:foldl(
        fun(UserId, Acc) ->
            StateWithPresence = guild_sessions:subscribe_to_user_presence(UserId, Acc),
            guild_presence:send_cached_presence_to_session(UserId, SessionId, StateWithPresence)
        end,
        State,
        Added
    ).

-spec handle_removed_subscriptions([user_id()], guild_state()) -> guild_state().
handle_removed_subscriptions(Removed, State) ->
    lists:foldl(
        fun(UserId, Acc) -> guild_sessions:unsubscribe_from_user_presence(UserId, Acc) end,
        State,
        Removed
    ).

-spec handle_set_typing_override(session_id(), boolean(), guild_state()) -> guild_state().
handle_set_typing_override(SessionId, TypingFlag, State) ->
    GuildId = maps:get(id, State),
    Sessions = maps:get(sessions, State, #{}),
    case maps:get(SessionId, Sessions, undefined) of
        undefined ->
            State;
        SessionData ->
            NewSessionData = session_passive:set_typing_override(GuildId, TypingFlag, SessionData),
            NewSessions = maps:put(SessionId, NewSessionData, Sessions),
            maps:put(sessions, NewSessions, State)
    end.

-spec handle_send_guild_sync(session_id(), guild_state()) -> guild_state().
handle_send_guild_sync(SessionId, State) ->
    GuildId = maps:get(id, State),
    Sessions = maps:get(sessions, State, #{}),
    case maps:get(SessionId, Sessions, undefined) of
        undefined ->
            State;
        SessionData ->
            case session_passive:is_guild_synced(GuildId, SessionData) of
                true ->
                    State;
                false ->
                    UserId = maps:get(user_id, SessionData),
                    SessionPid = maps:get(pid, SessionData),
                    GuildData = guild_data:get_guild_state(UserId, State),
                    gen_server:cast(SessionPid, {dispatch, guild_sync, GuildData}),
                    NewSessionData = session_passive:mark_guild_synced(GuildId, SessionData),
                    NewSessions = maps:put(SessionId, NewSessionData, Sessions),
                    maps:put(sessions, NewSessions, State)
            end
    end.

-spec handle_send_members_chunk(session_id(), map(), guild_state()) -> ok.
handle_send_members_chunk(SessionId, ChunkData, State) ->
    GuildId = maps:get(id, State),
    Sessions = maps:get(sessions, State, #{}),
    case maps:get(SessionId, Sessions, undefined) of
        undefined ->
            ok;
        SessionData ->
            SessionPid = maps:get(pid, SessionData),
            ChunkWithGuildId = maps:put(<<"guild_id">>, integer_to_binary(GuildId), ChunkData),
            gen_server:cast(SessionPid, {dispatch, guild_members_chunk, ChunkWithGuildId})
    end.

-spec filter_member_ids_with_mutual_channels(user_id() | undefined, [user_id()], guild_state()) ->
    [user_id()].
filter_member_ids_with_mutual_channels(undefined, _, _) ->
    [];
filter_member_ids_with_mutual_channels(SessionUserId, MemberIds, State) ->
    SessionChannels = guild_visibility:viewable_channel_set(SessionUserId, State),
    lists:filtermap(
        fun(MemberId) ->
            case MemberId =:= SessionUserId of
                true ->
                    false;
                false ->
                    case has_shared_channels(SessionChannels, MemberId, State) of
                        true -> {true, MemberId};
                        false -> false
                    end
            end
        end,
        MemberIds
    ).

-spec has_shared_channels(sets:set(), user_id(), guild_state()) -> boolean().
has_shared_channels(_, MemberId, _) when not is_integer(MemberId) ->
    false;
has_shared_channels(SessionChannels, MemberId, State) ->
    CandidateChannels = guild_visibility:viewable_channel_set(MemberId, State),
    not sets:is_empty(sets:intersection(SessionChannels, CandidateChannels)).

-spec maybe_prune_invalid_member_subscriptions(atom(), guild_state()) -> guild_state().
maybe_prune_invalid_member_subscriptions(Event, State) ->
    case event_requires_member_subscription_prune(Event) of
        true ->
            prune_invalid_member_subscriptions(State);
        false ->
            State
    end.

-spec maybe_prune_very_large_guild_members(guild_state()) -> guild_state().
maybe_prune_very_large_guild_members(State) ->
    case
        {
            maps:get(very_large_guild_coordinator_pid, State, undefined),
            maps:get(very_large_guild_shard_index, State, undefined)
        }
    of
        {CoordPid, ShardIndex} when is_pid(CoordPid), is_integer(ShardIndex), ShardIndex =/= 0 ->
            prune_member_cache_to_needed_users(State);
        _ ->
            State
    end.

-spec maybe_merge_very_large_guild_member_cache_on_reload(map(), map(), guild_state()) -> map().
maybe_merge_very_large_guild_member_cache_on_reload(OldData, NormalizedNewData, State) ->
    case
        {
            maps:get(very_large_guild_coordinator_pid, State, undefined),
            maps:get(very_large_guild_shard_index, State, undefined)
        }
    of
        {CoordPid, ShardIndex} when is_pid(CoordPid), is_integer(ShardIndex), ShardIndex =/= 0 ->
            CachedMembers = maps:get(<<"members">>, OldData, #{}),
            case is_map(CachedMembers) andalso map_size(CachedMembers) > 0 of
                true ->
                    NewMembers = maps:get(<<"members">>, NormalizedNewData, #{}),
                    MergedMembers = case is_map(NewMembers) of
                        true -> maps:merge(CachedMembers, NewMembers);
                        false -> CachedMembers
                    end,
                    guild_data_index:put_member_map(MergedMembers, NormalizedNewData);
                false -> NormalizedNewData
            end;
        _ ->
            NormalizedNewData
    end.

-spec prune_member_cache_to_needed_users(guild_state()) -> guild_state().
prune_member_cache_to_needed_users(State) ->
    Data0 = maps:get(data, State, #{}),
    Members0 = maps:get(<<"members">>, Data0, #{}),
    case is_map(Members0) of
        false ->
            State;
        true ->
            NeededUserIds = needed_member_cache_user_ids(State),
            NeededSet = sets:from_list(NeededUserIds),
            FilteredMembers = maps:filter(
                fun(UserId, _Member) -> sets:is_element(UserId, NeededSet) end,
                Members0
            ),
            case map_size(FilteredMembers) =:= map_size(Members0) of
                true ->
                    State;
                false ->
                    Data1 = guild_data_index:put_member_map(FilteredMembers, Data0),
                    maps:put(data, Data1, State)
            end
    end.

-spec needed_member_cache_user_ids(guild_state()) -> [user_id()].
needed_member_cache_user_ids(State) ->
    Sessions = maps:get(sessions, State, #{}),
    SessionUserIds = maps:fold(
        fun(_SessionId, SessionData, Acc) ->
            case maps:get(user_id, SessionData, undefined) of
                UserId when is_integer(UserId), UserId > 0 -> [UserId | Acc];
                _ -> Acc
            end
        end,
        [],
        Sessions
    ),
    MemberSubs = maps:get(member_subscriptions, State, guild_subscriptions:init_state()),
    SubscribedUserIds = maps:keys(MemberSubs),
    lists:usort(SessionUserIds ++ SubscribedUserIds).

-spec maybe_prime_very_large_guild_members([user_id()], guild_state()) -> guild_state().
maybe_prime_very_large_guild_members(UserIds, State) when is_list(UserIds) ->
    case
        {
            maps:get(very_large_guild_coordinator_pid, State, undefined),
            maps:get(very_large_guild_shard_index, State, undefined)
        }
    of
        {CoordPid, ShardIndex} when is_pid(CoordPid), is_integer(ShardIndex), ShardIndex =/= 0 ->
            UniqueUserIds = lists:usort([U || U <- UserIds, is_integer(U), U > 0]),
            case UniqueUserIds of
                [] ->
                    State;
                _ ->
                    MembersReply =
                        try gen_server:call(
                            CoordPid, {very_large_guild_get_members, UniqueUserIds}, 10000
                        ) of
                            Reply -> Reply
                        catch
                            _:_ -> #{}
                        end,
                    prime_members_from_reply(MembersReply, State)
            end;
        _ ->
            State
    end;
maybe_prime_very_large_guild_members(_, State) ->
    State.

-spec prime_members_from_reply(term(), guild_state()) -> guild_state().
prime_members_from_reply(MembersReply, State) when is_map(MembersReply) ->
    Data0 = maps:get(data, State, #{}),
    Data = maps:fold(
        fun(_UserId, Member, AccData) ->
            case is_map(Member) of
                true -> guild_data_index:put_member(Member, AccData);
                false -> AccData
            end
        end,
        Data0,
        MembersReply
    ),
    maps:put(data, Data, State);
prime_members_from_reply(_, State) ->
    State.

-spec deliver_member_list_updates([{session_id(), map()}], guild_state()) -> ok.
deliver_member_list_updates(Deliveries, State) ->
    Sessions = maps:get(sessions, State, #{}),
    lists:foreach(
        fun({SessionId, Payload}) ->
            case maps:get(SessionId, Sessions, undefined) of
                #{pid := SessionPid} = SessionData when is_pid(SessionPid), is_map(Payload) ->
                    case maps:get(pending_connect, SessionData, false) of
                        true ->
                            ok;
                        false ->
                            ChannelId = member_list_payload_channel_id(Payload),
                            case can_session_view_channel(SessionData, ChannelId, State) of
                                true ->
                                    gen_server:cast(
                                        SessionPid, {dispatch, guild_member_list_update, Payload}
                                    );
                                false ->
                                    ok
                            end
                    end;
                _ ->
                    ok
            end
        end,
        Deliveries
    ),
    ok.

-spec member_list_payload_channel_id(map()) -> channel_id().
member_list_payload_channel_id(Payload) ->
    ChannelIdBin = maps:get(<<"channel_id">>, Payload, undefined),
    ListIdBin = maps:get(<<"id">>, Payload, <<"0">>),
    case ChannelIdBin of
        Bin when is_binary(Bin) ->
            case type_conv:to_integer(Bin) of
                undefined -> 0;
                Id -> Id
            end;
        _ ->
            case type_conv:to_integer(ListIdBin) of
                undefined -> 0;
                Id -> Id
            end
    end.

-spec can_session_view_channel(map(), channel_id(), guild_state()) -> boolean().
can_session_view_channel(_SessionData, ChannelId, _State) when not is_integer(ChannelId); ChannelId =< 0 ->
    false;
can_session_view_channel(SessionData, ChannelId, State) ->
    case {maps:get(user_id, SessionData, undefined), maps:get(viewable_channels, SessionData, undefined)} of
        {UserId, ViewableChannels} when is_integer(UserId), is_map(ViewableChannels) ->
            maps:is_key(ChannelId, ViewableChannels) orelse
                guild_permissions:can_view_channel(UserId, ChannelId, undefined, State);
        {UserId, _} when is_integer(UserId) ->
            guild_permissions:can_view_channel(UserId, ChannelId, undefined, State);
        _ ->
            false
    end.

-spec ensure_session_connect_queue(term()) -> queue:queue().
ensure_session_connect_queue(Value) ->
    case queue:is_queue(Value) of
        true ->
            Value;
        false when is_list(Value) ->
            queue:from_list(Value);
        false ->
            queue:new()
    end.

-spec enqueue_session_connect_async(integer(), non_neg_integer(), map(), map(), map()) -> map().
enqueue_session_connect_async(GuildId, Attempt, Request, Msg, State) ->
    SessionId = maps:get(session_id, Request, undefined),
    Pending0 = maps:get(session_connect_pending, State, #{}),
    case {SessionId, maps:get(SessionId, Pending0, undefined)} of
        {Sid, PrevAttempt} when is_binary(Sid), is_integer(PrevAttempt), Attempt =< PrevAttempt ->
            State;
        {Sid, PrevAttempt} when is_binary(Sid), is_integer(PrevAttempt), Attempt > PrevAttempt ->
            Queue0 = ensure_session_connect_queue(maps:get(session_connect_queue, State, queue:new())),
            Queue1 = drop_queued_session_connects(Sid, Queue0),
            ReplyViaPid = maps:get(reply_via_pid, Msg, undefined),
            Item = #{
                guild_id => GuildId,
                attempt => Attempt,
                request => Request,
                reply_via_pid => ReplyViaPid
            },
            Pending = maps:put(Sid, Attempt, Pending0),
            Queue2 = queue:in(Item, Queue1),
            State1 = maps:put(
                session_connect_pending,
                Pending,
                maps:put(session_connect_queue, Queue2, State)
            ),
            maybe_start_session_connect_workers(ensure_pending_session_entry(Request, State1));
        {Sid, undefined} when is_binary(Sid) ->
            Queue0 = ensure_session_connect_queue(maps:get(session_connect_queue, State, queue:new())),
            ReplyViaPid = maps:get(reply_via_pid, Msg, undefined),
            Item = #{
                guild_id => GuildId,
                attempt => Attempt,
                request => Request,
                reply_via_pid => ReplyViaPid
            },
            Pending = maps:put(Sid, Attempt, Pending0),
            Queue1 = queue:in(Item, Queue0),
            State1 = maps:put(
                session_connect_pending,
                Pending,
                maps:put(session_connect_queue, Queue1, State)
            ),
            maybe_start_session_connect_workers(ensure_pending_session_entry(Request, State1));
        _ ->
            State
    end.

-spec ensure_pending_session_entry(map(), map()) -> map().
ensure_pending_session_entry(Request, State) ->
    SessionId = maps:get(session_id, Request, undefined),
    UserId = maps:get(user_id, Request, undefined),
    SessionPid = maps:get(session_pid, Request, undefined),
    case {SessionId, UserId, SessionPid} of
        {Sid, Uid, Pid} when is_binary(Sid), is_integer(Uid), is_pid(Pid) ->
            Sessions0 = maps:get(sessions, State, #{}),
            case maps:get(Sid, Sessions0, undefined) of
                undefined ->
                    Ref = monitor(process, Pid),
                    ActiveGuilds = maps:get(active_guilds, Request, sets:new()),
                    Bot = maps:get(bot, Request, false),
                    IsStaff = maps:get(is_staff, Request, false),
                    PendingSessionData = #{
                        session_id => Sid,
                        user_id => Uid,
                        pid => Pid,
                        mref => Ref,
                        active_guilds => ActiveGuilds,
                        bot => Bot,
                        is_staff => IsStaff,
                        pending_connect => true,
                        viewable_channels => #{}
                    },
                    maps:put(sessions, maps:put(Sid, PendingSessionData, Sessions0), State);
                Existing ->
                    Existing1 = maps:put(pending_connect, true, Existing),
                    maps:put(sessions, maps:put(Sid, Existing1, Sessions0), State)
            end;
        _ ->
            State
    end.

-spec drop_queued_session_connects(session_id(), term()) -> queue:queue().
drop_queued_session_connects(SessionId, Queue0) ->
    Queue = ensure_session_connect_queue(Queue0),
    queue:filter(
        fun(Item) ->
            Request = maps:get(request, Item, #{}),
            maps:get(session_id, Request, undefined) =/= SessionId
        end,
        Queue
    ).

-spec maybe_start_session_connect_workers(map()) -> map().
maybe_start_session_connect_workers(State) ->
    Inflight0 = maps:get(session_connect_inflight, State, 0),
    Queue0 = ensure_session_connect_queue(maps:get(session_connect_queue, State, queue:new())),
    case Inflight0 < ?SESSION_CONNECT_MAX_WORKERS of
        false ->
            State;
        true ->
            case queue:out(Queue0) of
                {{value, Next}, Rest} ->
                    State1 = maps:put(session_connect_queue, Rest, State),
                    State2 = maps:put(session_connect_inflight, Inflight0 + 1, State1),
                    maybe_start_session_connect_workers(start_session_connect_worker(Next, State2));
                {empty, _} ->
                    maps:put(session_connect_queue, Queue0, State)
            end
    end.

-spec start_session_connect_worker(map(), map()) -> map().
start_session_connect_worker(Item, State) ->
    Self = self(),
    {_Pid, Ref} = spawn_monitor(fun() ->
        compute_and_send_session_connect_worker_done(Item, Self, State)
    end),
    WorkerRefs = maps:get(session_connect_worker_refs, State, #{}),
    maps:put(session_connect_worker_refs, maps:put(Ref, true, WorkerRefs), State).

-spec compute_and_send_session_connect_worker_done(map(), pid(), map()) -> ok.
compute_and_send_session_connect_worker_done(Item, GuildPid, State) ->
    GuildId = maps:get(id, State, maps:get(guild_id, Item, 0)),
    Attempt = maps:get(attempt, Item, 0),
    Request = maps:get(request, Item, #{}),
    SessionId = maps:get(session_id, Request, undefined),
    {Result0, Computed0} =
        try compute_session_connect_computed(GuildId, Request, State) of
            ComputedTmp ->
                {computed_result_from_payload(ComputedTmp, GuildId), ComputedTmp}
        catch
            _:Reason ->
                {{error, {session_connect_async_failed, Reason}}, #{}}
        end,
    Computed = maps:merge(Item, Computed0),
    gen_server:cast(GuildPid, {session_connect_worker_done, SessionId, Attempt, Result0, Computed}),
    ok.

-spec compute_session_connect_computed(integer(), map(), map()) -> map().
compute_session_connect_computed(GuildId, #{user_id := UserId} = Request, State) when is_integer(UserId) ->
    GuildState = guild_data:get_guild_state(UserId, State),
    InitialLastMessageIds = guild_sessions:build_initial_last_message_ids(GuildState),
    InitialChannelVersions = build_initial_channel_versions(GuildState),
    ViewableChannels = guild_visibility:get_user_viewable_channels(UserId, State),
    ViewableChannelMap = build_viewable_channel_map(ViewableChannels),
    UserRoles = session_passive:get_user_roles_for_guild(UserId, State),
    InitialGuildId = maps:get(initial_guild_id, Request, undefined),
    ShouldMarkSynced = InitialGuildId =:= GuildId,
    Unavailable =
        case guild_availability:is_guild_unavailable_for_user(UserId, State) of
            true ->
                #{<<"id">> => integer_to_binary(GuildId), <<"unavailable">> => true};
            false ->
                undefined
        end,
    #{
        guild_state => GuildState,
        initial_last_message_ids => InitialLastMessageIds,
        initial_channel_versions => InitialChannelVersions,
        viewable_channels => ViewableChannelMap,
        user_roles => UserRoles,
        should_mark_guild_synced => ShouldMarkSynced,
        unavailable_response => Unavailable
    };
compute_session_connect_computed(_GuildId, _Request, _State) ->
    #{}.

-spec computed_result_from_payload(map(), integer()) ->
    {ok, map()} | {ok_unavailable, map()} | {error, term()}.
computed_result_from_payload(Computed, _GuildId) ->
    case maps:get(unavailable_response, Computed, undefined) of
        Unavailable when is_map(Unavailable) ->
            {ok_unavailable, Unavailable};
        _ ->
            case maps:get(guild_state, Computed, undefined) of
                GuildState when is_map(GuildState) -> {ok, GuildState};
                _ -> {error, invalid_guild_state}
            end
    end.

-spec finalize_session_connect_async(
    session_id() | undefined,
    non_neg_integer(),
    {ok, map()} | {ok_unavailable, map()} | {error, term()},
    map(),
    map()
) -> map().
finalize_session_connect_async(undefined, _Attempt, _Result0, _Computed, State) ->
    State1 = decrement_session_connect_inflight(State),
    maybe_start_session_connect_workers(State1);
finalize_session_connect_async(SessionId, Attempt, Result0, Computed, State) ->
    State1 = decrement_session_connect_inflight(State),
    Pending0 = maps:get(session_connect_pending, State1, #{}),
    case maps:get(SessionId, Pending0, undefined) of
        Attempt ->
            Pending = maps:remove(SessionId, Pending0),
            State2 = maps:put(session_connect_pending, Pending, State1),
            Request = maps:get(request, Computed, #{}),
            SessionPid = maps:get(session_pid, Request, undefined),
            ReplyViaPid = maps:get(reply_via_pid, Computed, undefined),
            GuildId = maps:get(id, State2, maps:get(guild_id, Computed, 0)),
            case is_pid(SessionPid) of
                false ->
                    maybe_start_session_connect_workers(State2);
                true ->
                    State3 = upsert_connected_session_from_computed(SessionId, SessionPid, Request, Computed, State2),
                    send_session_connect_result(GuildId, Attempt, Result0, SessionPid, ReplyViaPid),
                    maybe_start_session_connect_workers(State3)
            end;
        _OtherAttempt ->
            maybe_start_session_connect_workers(State1)
    end.

-spec decrement_session_connect_inflight(map()) -> map().
decrement_session_connect_inflight(State) ->
    Inflight0 = maps:get(session_connect_inflight, State, 0),
    Inflight = erlang:max(0, Inflight0 - 1),
    maps:put(session_connect_inflight, Inflight, State).

-spec upsert_connected_session_from_computed(
    session_id(),
    pid(),
    map(),
    map(),
    map()
) -> map().
upsert_connected_session_from_computed(SessionId, SessionPid, Request, Computed, State) ->
    UserId = maps:get(user_id, Request, undefined),
    case is_integer(UserId) of
        false ->
            State;
        true ->
            Sessions0 = maps:get(sessions, State, #{}),
            Existing = maps:get(SessionId, Sessions0, undefined),
            {MRef, Existing1} = resolve_session_monitor(Existing, SessionPid),
            ActiveGuilds = maps:get(active_guilds, Request, sets:new()),
            Bot = maps:get(bot, Request, false),
            IsStaff = maps:get(is_staff, Request, false),
            UserRoles = maps:get(user_roles, Computed, []),
            InitialLastMessageIds = maps:get(initial_last_message_ids, Computed, #{}),
            InitialChannelVersions = maps:get(initial_channel_versions, Computed, #{}),
            ViewableChannels = maps:get(viewable_channels, Computed, #{}),
            GuildId = maps:get(id, State),
            BaseSessionData = #{
                session_id => SessionId,
                user_id => UserId,
                pid => SessionPid,
                mref => MRef,
                active_guilds => ActiveGuilds,
                user_roles => UserRoles,
                bot => Bot,
                is_staff => IsStaff,
                pending_connect => false,
                previous_passive_updates => InitialLastMessageIds,
                previous_passive_channel_versions => InitialChannelVersions,
                previous_passive_voice_states => #{},
                viewable_channels => ViewableChannels
            },
            SessionData =
                case maps:get(should_mark_guild_synced, Computed, false) of
                    true -> session_passive:mark_guild_synced(GuildId, BaseSessionData);
                    false -> BaseSessionData
                end,
            Sessions =
                case Existing1 of
                    undefined -> maps:put(SessionId, SessionData, Sessions0);
                    _ -> maps:put(SessionId, maps:merge(Existing1, SessionData), Sessions0)
                end,
            State1 = maps:put(sessions, Sessions, State),
            State2 = guild_sessions:subscribe_to_user_presence(UserId, State1),
            maybe_notify_very_large_guild_session_connected(SessionId, UserId, State2)
    end.

-spec resolve_session_monitor(map() | undefined, pid()) -> {reference(), map() | undefined}.
resolve_session_monitor(undefined, SessionPid) ->
    {monitor(process, SessionPid), undefined};
resolve_session_monitor(Existing, SessionPid) ->
    ExistingPid = maps:get(pid, Existing, undefined),
    ExistingMRef = maps:get(mref, Existing, undefined),
    case {ExistingPid, ExistingMRef} of
        {SessionPid, Ref} when is_reference(Ref) ->
            {Ref, Existing};
        {_OtherPid, Ref} when is_reference(Ref) ->
            demonitor(Ref, [flush]),
            {monitor(process, SessionPid), Existing};
        _ ->
            {monitor(process, SessionPid), Existing}
    end.

-spec maybe_notify_very_large_guild_session_connected(session_id(), user_id(), map()) -> map().
maybe_notify_very_large_guild_session_connected(SessionId, UserId, State) ->
    case {maps:get(very_large_guild_coordinator_pid, State, undefined),
        maps:get(very_large_guild_shard_index, State, undefined)}
    of
        {CoordPid, ShardIndex} when is_pid(CoordPid), is_integer(ShardIndex) ->
            CoordPid ! {very_large_guild_session_connected, ShardIndex, SessionId, UserId},
            State;
        _ ->
            State
    end.

-spec build_initial_channel_versions(map()) -> #{binary() => integer()}.
build_initial_channel_versions(GuildState) ->
    Channels = maps:get(<<"channels">>, GuildState, []),
    lists:foldl(
        fun(Channel, Acc) ->
            ChannelIdBin = maps:get(<<"id">>, Channel, undefined),
            case ChannelIdBin of
                undefined -> Acc;
                _ ->
                    Version = map_utils:get_integer(Channel, <<"version">>, 0),
                    maps:put(ChannelIdBin, Version, Acc)
            end
        end,
        #{},
        Channels
    ).

-spec build_viewable_channel_map([channel_id()]) -> map().
build_viewable_channel_map(ChannelIds) ->
    lists:foldl(
        fun(ChannelId, Acc) ->
            case is_integer(ChannelId) andalso ChannelId > 0 of
                true -> maps:put(ChannelId, true, Acc);
                false -> Acc
            end
        end,
        #{},
        ChannelIds
    ).

-spec send_session_connect_result(
    integer(),
    non_neg_integer(),
    {ok, map()} | {ok_unavailable, map()} | {error, term()},
    pid(),
    pid() | undefined
) -> ok.
send_session_connect_result(GuildId, Attempt, Result0, SessionPid, ReplyViaPid) ->
    Reply =
        case Result0 of
            {ok, GuildState} -> {ok, self(), GuildState};
            {ok_unavailable, UnavailableResponse} -> {ok_unavailable, self(), UnavailableResponse};
            {error, Reason} -> {error, Reason}
        end,
    case ReplyViaPid of
        Pid when is_pid(Pid) ->
            Pid ! {very_large_guild_session_connect_result, GuildId, Attempt, SessionPid, Result0},
            ok;
        _ ->
            SessionPid ! {guild_connect_result, GuildId, Attempt, Reply},
            ok
    end.

-spec event_requires_member_subscription_prune(atom()) -> boolean().
event_requires_member_subscription_prune(guild_member_remove) -> true;
event_requires_member_subscription_prune(guild_member_update) -> true;
event_requires_member_subscription_prune(guild_role_update) -> true;
event_requires_member_subscription_prune(guild_role_update_bulk) -> true;
event_requires_member_subscription_prune(guild_role_delete) -> true;
event_requires_member_subscription_prune(channel_update) -> true;
event_requires_member_subscription_prune(channel_update_bulk) -> true;
event_requires_member_subscription_prune(channel_delete) -> true;
event_requires_member_subscription_prune(_) -> false.

-spec prune_invalid_member_subscriptions(guild_state()) -> guild_state().
prune_invalid_member_subscriptions(State) ->
    MemberSubs = maps:get(member_subscriptions, State, guild_subscriptions:init_state()),
    Sessions = maps:get(sessions, State, #{}),
    InvalidPairs = build_invalid_subscription_pairs(MemberSubs, Sessions, State),
    lists:foldl(
        fun({SessionId, UserId}, AccState) ->
            remove_member_subscription(SessionId, UserId, AccState)
        end,
        State,
        InvalidPairs
    ).

-spec build_invalid_subscription_pairs(term(), map(), guild_state()) -> [{session_id(), user_id()}].
build_invalid_subscription_pairs(MemberSubs, Sessions, State) ->
    lists:foldl(
        fun({SessionId, SessionData}, Acc) ->
            SessionUserId = maps:get(user_id, SessionData, undefined),
            case SessionUserId of
                undefined ->
                    Acc;
                _ ->
                    SessionChannels = guild_visibility:viewable_channel_set(SessionUserId, State),
                    SubscriptionIds = guild_subscriptions:get_user_ids_for_session(
                        SessionId, MemberSubs
                    ),
                    InvalidIds =
                        [
                            MemberId
                         || MemberId <- sets:to_list(SubscriptionIds),
                            not has_shared_channels(SessionChannels, MemberId, State)
                        ],
                    lists:foldl(
                        fun(MemberId, Pairs) -> [{SessionId, MemberId} | Pairs] end,
                        Acc,
                        InvalidIds
                    )
            end
        end,
        [],
        maps:to_list(Sessions)
    ).

-spec remove_member_subscription(session_id(), user_id(), guild_state()) -> guild_state().
remove_member_subscription(SessionId, UserId, State) ->
    MemberSubs = maps:get(member_subscriptions, State, guild_subscriptions:init_state()),
    NewMemberSubs = guild_subscriptions:unsubscribe(SessionId, UserId, MemberSubs),
    State1 = maps:put(member_subscriptions, NewMemberSubs, State),
    guild_sessions:unsubscribe_from_user_presence(UserId, State1).

-spec cleanup_removed_member_subscriptions(map(), map(), guild_state()) -> guild_state().
cleanup_removed_member_subscriptions(OldData, NewData, State) ->
    OldMemberIds = sets:from_list(guild_data_index:member_ids(OldData)),
    NewMemberIds = sets:from_list(guild_data_index:member_ids(NewData)),
    RemovedIds = sets:subtract(OldMemberIds, NewMemberIds),
    PresenceSubs = maps:get(presence_subscriptions, State, #{}),
    NewPresenceSubs = lists:foldl(
        fun(UserId, Subs) ->
            case maps:is_key(UserId, Subs) of
                true ->
                    presence_bus:unsubscribe(UserId),
                    maps:remove(UserId, Subs);
                false ->
                    Subs
            end
        end,
        PresenceSubs,
        sets:to_list(RemovedIds)
    ),
    maps:put(presence_subscriptions, NewPresenceSubs, State).

-spec owner_id(guild_state()) -> user_id().
owner_id(State) ->
    case resolve_data_map(State) of
        undefined ->
            0;
        Data ->
            Guild = maps:get(<<"guild">>, Data, #{}),
            type_conv:to_integer(maps:get(<<"owner_id">>, Guild, <<"0">>))
    end.

-spec resolve_data_map(guild_state() | map()) -> map() | undefined.
resolve_data_map(State) when is_map(State) ->
    case maps:find(data, State) of
        {ok, Data} when is_map(Data) ->
            Data;
        {ok, Data} when is_map(Data) =:= false ->
            undefined;
        error ->
            case State of
                #{<<"members">> := _} ->
                    State;
                _ ->
                    undefined
            end
    end;
resolve_data_map(_) ->
    undefined.

-spec maybe_report_crash(term(), term()) -> ok.
maybe_report_crash(normal, _State) ->
    ok;
maybe_report_crash(shutdown, _State) ->
    ok;
maybe_report_crash({shutdown, _}, _State) ->
    ok;
maybe_report_crash(Reason, State) ->
    GuildId = extract_guild_id_for_crash(State),
    Stacktrace = iolist_to_binary(io_lib:format("~p", [Reason])),
    otel_metrics:counter(
        <<"gateway.guild.crash">>,
        1,
        #{
            <<"guild_id">> => GuildId,
            <<"reason">> => Stacktrace
        }
    ),
    ok.

-spec extract_guild_id_for_crash(term()) -> binary().
extract_guild_id_for_crash(#{id := Id}) ->
    integer_to_binary(Id);
extract_guild_id_for_crash(#{data := Data}) when is_map(Data) ->
    case maps:get(<<"id">>, Data, undefined) of
        undefined -> <<"unknown">>;
        Id -> Id
    end;
extract_guild_id_for_crash(_) ->
    <<"unknown">>.

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").

-spec member_user_id(map()) -> user_id() | undefined.
member_user_id(Member) ->
    User = maps:get(<<"user">>, Member, #{}),
    map_utils:get_integer(User, <<"id">>, undefined).

update_counts_test() ->
    State = #{
        data => #{
            <<"members">> => [
                #{<<"user">> => #{<<"id">> => <<"1">>}},
                #{<<"user">> => #{<<"id">> => <<"2">>}}
            ]
        },
        sessions => #{}
    },
    Updated = update_counts(State),
    ?assertEqual(2, maps:get(member_count, Updated)).

parse_event_data_binary_test() ->
    Binary = <<"{\"key\":\"value\"}">>,
    Result = parse_event_data(Binary),
    ?assertEqual(#{<<"key">> => <<"value">>}, Result).

parse_event_data_map_test() ->
    Map = #{<<"key">> => <<"value">>},
    Result = parse_event_data(Map),
    ?assertEqual(Map, Result).

member_user_id_extracts_id_test() ->
    Member = #{<<"user">> => #{<<"id">> => <<"123">>}},
    ?assertEqual(123, member_user_id(Member)).

member_user_id_returns_undefined_test() ->
    Member = #{<<"user">> => #{}},
    ?assertEqual(undefined, member_user_id(Member)).

owner_id_returns_owner_test() ->
    State = #{
        data => #{
            <<"guild">> => #{<<"owner_id">> => <<"456">>}
        }
    },
    ?assertEqual(456, owner_id(State)).

filter_member_ids_undefined_session_test() ->
    State = #{data => #{<<"channels">> => []}},
    Result = filter_member_ids_with_mutual_channels(undefined, [1, 2, 3], State),
    ?assertEqual([], Result).

event_requires_member_subscription_prune_test() ->
    ?assertEqual(true, event_requires_member_subscription_prune(guild_role_update)),
    ?assertEqual(true, event_requires_member_subscription_prune(channel_delete)),
    ?assertEqual(false, event_requires_member_subscription_prune(message_create)).

init_populates_unavailability_cache_test() ->
    GuildId = 424242,
    CleanupState = #{
        id => GuildId,
        data => #{
            <<"guild">> => #{
                <<"features">> => []
            }
        }
    },
    _ = guild_availability:update_unavailability_cache_for_state(CleanupState),
    GuildState = #{
        id => GuildId,
        data => #{
            <<"guild">> => #{
                <<"features">> => [<<"UNAVAILABLE_FOR_EVERYONE">>]
            },
            <<"members">> => []
        },
        sessions => #{}
    },
    {ok, _InitializedState} = init(GuildState),
    ?assertEqual(unavailable_for_everyone, guild_availability:get_cached_unavailability_mode(GuildId)),
    _ = guild_availability:update_unavailability_cache_for_state(CleanupState).

drop_queued_session_connects_filters_by_session_id_test() ->
    Q0 = queue:from_list([
        #{request => #{session_id => <<"sid-a">>}, attempt => 1},
        #{request => #{session_id => <<"sid-b">>}, attempt => 1},
        #{request => #{session_id => <<"sid-a">>}, attempt => 2}
    ]),
    Q1 = drop_queued_session_connects(<<"sid-a">>, Q0),
    ?assertEqual(
        [#{request => #{session_id => <<"sid-b">>}, attempt => 1}],
        queue:to_list(Q1)
    ),
    ok.

worker_crash_recovers_inflight_test() ->
    Ref = make_ref(),
    State = #{
        id => 1,
        data => #{},
        sessions => #{},
        session_connect_inflight => 1,
        session_connect_worker_refs => #{Ref => true},
        session_connect_queue => queue:new()
    },
    {noreply, State1} = handle_info({'DOWN', Ref, process, self(), killed}, State),
    ?assertEqual(0, maps:get(session_connect_inflight, State1, 0)),
    ?assertEqual(#{}, maps:get(session_connect_worker_refs, State1, #{})).

resolve_data_map_non_map_returns_undefined_test() ->
    ?assertEqual(undefined, resolve_data_map(#{data => a_tuple_or_atom})),
    ?assertEqual(undefined, resolve_data_map(#{data => [1, 2, 3]})),
    ?assertEqual(undefined, resolve_data_map(#{data => 42})).

merge_member_cache_preserves_new_data_test() ->
    OldMember1 = #{<<"user">> => #{<<"id">> => <<"1">>}, <<"nick">> => <<"old_nick">>},
    OldMember2 = #{<<"user">> => #{<<"id">> => <<"2">>}, <<"nick">> => <<"only_old">>},
    NewMember1 = #{<<"user">> => #{<<"id">> => <<"1">>}, <<"nick">> => <<"new_nick">>},
    NewMember3 = #{<<"user">> => #{<<"id">> => <<"3">>}, <<"nick">> => <<"only_new">>},
    OldData = guild_data_index:normalize_data(#{
        <<"members">> => [OldMember1, OldMember2],
        <<"guild">> => #{},
        <<"channels">> => [],
        <<"roles">> => []
    }),
    NormalizedNewData = guild_data_index:normalize_data(#{
        <<"members">> => [NewMember1, NewMember3],
        <<"guild">> => #{},
        <<"channels">> => [],
        <<"roles">> => []
    }),
    State = #{
        very_large_guild_coordinator_pid => self(),
        very_large_guild_shard_index => 1
    },
    Result = maybe_merge_very_large_guild_member_cache_on_reload(OldData, NormalizedNewData, State),
    ResultMembers = maps:get(<<"members">>, Result, #{}),
    ?assertEqual(NewMember1, maps:get(1, ResultMembers, undefined)),
    ?assertEqual(OldMember2, maps:get(2, ResultMembers, undefined)),
    ?assertEqual(NewMember3, maps:get(3, ResultMembers, undefined)).

enqueue_dedup_supersedes_old_attempt_test() ->
    SessionId = <<"sid-dedup">>,
    Request = #{session_id => SessionId, user_id => 100, session_pid => self()},
    Msg1 = #{guild_id => 1, attempt => 1, request => Request},
    Msg2 = #{guild_id => 1, attempt => 2, request => Request},
    State0 = #{
        id => 1,
        data => #{},
        sessions => #{},
        session_connect_inflight => ?SESSION_CONNECT_MAX_WORKERS,
        session_connect_queue => queue:new(),
        session_connect_pending => #{}
    },
    State1 = enqueue_session_connect_async(1, 1, Request, Msg1, State0),
    State2 = enqueue_session_connect_async(1, 2, Request, Msg2, State1),
    Pending = maps:get(session_connect_pending, State2, #{}),
    ?assertEqual(2, maps:get(SessionId, Pending, undefined)),
    Queue = maps:get(session_connect_queue, State2, queue:new()),
    Items = queue:to_list(Queue),
    SessionItems = [I || I <- Items, maps:get(session_id, maps:get(request, I, #{}), undefined) =:= SessionId],
    ?assertEqual(1, length(SessionItems)),
    [Item] = SessionItems,
    ?assertEqual(2, maps:get(attempt, Item)).

enqueue_stale_attempt_noop_test() ->
    SessionId = <<"sid-stale">>,
    Request = #{session_id => SessionId, user_id => 200, session_pid => self()},
    Msg2 = #{guild_id => 1, attempt => 2, request => Request},
    Msg1 = #{guild_id => 1, attempt => 1, request => Request},
    State0 = #{
        id => 1,
        data => #{},
        sessions => #{},
        session_connect_inflight => ?SESSION_CONNECT_MAX_WORKERS,
        session_connect_queue => queue:new(),
        session_connect_pending => #{}
    },
    State1 = enqueue_session_connect_async(1, 2, Request, Msg2, State0),
    State2 = enqueue_session_connect_async(1, 1, Request, Msg1, State1),
    Pending = maps:get(session_connect_pending, State2, #{}),
    ?assertEqual(2, maps:get(SessionId, Pending, undefined)),
    Queue = maps:get(session_connect_queue, State2, queue:new()),
    Items = queue:to_list(Queue),
    SessionItems = [I || I <- Items, maps:get(session_id, maps:get(request, I, #{}), undefined) =:= SessionId],
    ?assertEqual(1, length(SessionItems)),
    [Item] = SessionItems,
    ?assertEqual(2, maps:get(attempt, Item)).

ensure_session_connect_queue_migration_test() ->
    PlainList = [a, b, c],
    Q1 = ensure_session_connect_queue(PlainList),
    ?assert(queue:is_queue(Q1)),
    ?assertEqual([a, b, c], queue:to_list(Q1)),
    Q2 = ensure_session_connect_queue(Q1),
    ?assert(queue:is_queue(Q2)),
    ?assertEqual([a, b, c], queue:to_list(Q2)),
    Q3 = ensure_session_connect_queue(undefined),
    ?assert(queue:is_queue(Q3)),
    ?assertEqual([], queue:to_list(Q3)).

finalize_stale_attempt_drops_result_and_drains_queue_test() ->
    SessionId = <<"sid-stale-fin">>,
    State0 = #{
        id => 1,
        data => #{},
        sessions => #{},
        session_connect_inflight => 1,
        session_connect_pending => #{SessionId => 5},
        session_connect_queue => queue:new()
    },
    Computed = #{request => #{session_id => SessionId}},
    State1 = finalize_session_connect_async(SessionId, 3, {ok, #{}}, Computed, State0),
    Pending = maps:get(session_connect_pending, State1, #{}),
    ?assertEqual(5, maps:get(SessionId, Pending, undefined)),
    ?assertEqual(0, maps:get(session_connect_inflight, State1, 0)).

finalize_undefined_session_id_decrements_and_drains_test() ->
    State0 = #{
        id => 1,
        data => #{},
        sessions => #{},
        session_connect_inflight => 1,
        session_connect_pending => #{},
        session_connect_queue => queue:new()
    },
    State1 = finalize_session_connect_async(undefined, 0, {error, bad}, #{}, State0),
    ?assertEqual(0, maps:get(session_connect_inflight, State1, 0)).

workers_spawn_up_to_max_test() ->
    Req1 = #{session_id => <<"s1">>, user_id => 1, session_pid => self()},
    Req2 = #{session_id => <<"s2">>, user_id => 2, session_pid => self()},
    Req3 = #{session_id => <<"s3">>, user_id => 3, session_pid => self()},
    Item1 = #{guild_id => 1, attempt => 0, request => Req1},
    Item2 = #{guild_id => 1, attempt => 0, request => Req2},
    Item3 = #{guild_id => 1, attempt => 0, request => Req3},
    Queue = queue:from_list([Item1, Item2, Item3]),
    State0 = #{
        id => 1,
        data => #{},
        sessions => #{},
        session_connect_inflight => 0,
        session_connect_queue => Queue,
        session_connect_pending => #{
            <<"s1">> => 0,
            <<"s2">> => 0,
            <<"s3">> => 0
        }
    },
    State1 = maybe_start_session_connect_workers(State0),
    ?assertEqual(?SESSION_CONNECT_MAX_WORKERS, maps:get(session_connect_inflight, State1, 0)),
    RemainingQueue = maps:get(session_connect_queue, State1, queue:new()),
    ?assertEqual(1, queue:len(RemainingQueue)),
    WorkerRefs = maps:get(session_connect_worker_refs, State1, #{}),
    ?assertEqual(?SESSION_CONNECT_MAX_WORKERS, map_size(WorkerRefs)).

ensure_pending_session_entry_existing_session_test() ->
    SessionId = <<"sid-existing">>,
    ExistingSession = #{
        session_id => SessionId,
        user_id => 1,
        pid => self(),
        mref => make_ref(),
        bot => false,
        is_staff => false,
        pending_connect => false,
        viewable_channels => #{100 => true}
    },
    State0 = #{
        sessions => #{SessionId => ExistingSession}
    },
    Request = #{session_id => SessionId, user_id => 1, session_pid => self()},
    State1 = ensure_pending_session_entry(Request, State0),
    Sessions = maps:get(sessions, State1, #{}),
    Session = maps:get(SessionId, Sessions),
    ?assertEqual(true, maps:get(pending_connect, Session)),
    ?assertEqual(#{100 => true}, maps:get(viewable_channels, Session)).

normal_worker_exit_does_not_double_decrement_inflight_test() ->
    Ref = make_ref(),
    State0 = #{
        id => 1,
        data => #{},
        sessions => #{},
        session_connect_inflight => 1,
        session_connect_worker_refs => #{Ref => true},
        session_connect_queue => queue:new()
    },
    {noreply, State1} = handle_info({'DOWN', Ref, process, self(), normal}, State0),
    ?assertEqual(1, maps:get(session_connect_inflight, State1, 0)),
    ?assertEqual(#{}, maps:get(session_connect_worker_refs, State1, #{})).

reload_skips_pending_sessions_for_guild_update_test() ->
    Parent = self(),
    NormalPid = spawn(fun() -> test_capture_loop(Parent, normal_pid) end),
    PendingPid = spawn(fun() -> test_capture_loop(Parent, pending_pid) end),
    NormalSession = #{
        session_id => <<"s-normal">>,
        user_id => 10,
        pid => NormalPid,
        mref => make_ref(),
        pending_connect => false,
        viewable_channels => #{}
    },
    PendingSession = #{
        session_id => <<"s-pending">>,
        user_id => 11,
        pid => PendingPid,
        mref => make_ref(),
        pending_connect => true,
        viewable_channels => #{}
    },
    ViewPerm = constants:view_channel_permission(),
    GuildId = 77777,
    Data = #{
        <<"guild">> => #{
            <<"id">> => integer_to_binary(GuildId),
            <<"owner_id">> => <<"999">>,
            <<"features">> => []
        },
        <<"roles">> => [
            #{<<"id">> => integer_to_binary(GuildId), <<"permissions">> => integer_to_binary(ViewPerm)}
        ],
        <<"members">> => [
            #{<<"user">> => #{<<"id">> => <<"10">>}, <<"roles">> => []},
            #{<<"user">> => #{<<"id">> => <<"11">>}, <<"roles">> => []}
        ],
        <<"channels">> => []
    },
    NormalizedData = guild_data_index:normalize_data(Data),
    State = #{
        id => GuildId,
        data => NormalizedData,
        sessions => #{<<"s-normal">> => NormalSession, <<"s-pending">> => PendingSession},
        presence_subscriptions => #{10 => 1, 11 => 1},
        member_subscriptions => guild_subscriptions:init_state(),
        member_list_subscriptions => #{},
        disable_permission_cache_updates => true
    },
    {reply, ok, _NewState} = handle_call({reload, Data}, {self(), make_ref()}, State),
    timer:sleep(100),
    NormalReceived = flush_tagged(normal_pid),
    PendingReceived = flush_tagged(pending_pid),
    NormalPid ! stop,
    PendingPid ! stop,
    ?assert(length(NormalReceived) > 0),
    ?assertEqual([], PendingReceived).

test_capture_loop(Parent, Tag) ->
    receive
        stop -> ok;
        {'$gen_cast', Msg} ->
            Parent ! {Tag, Msg},
            test_capture_loop(Parent, Tag);
        _ ->
            test_capture_loop(Parent, Tag)
    end.

flush_tagged(Tag) ->
    flush_tagged(Tag, []).

flush_tagged(Tag, Acc) ->
    receive
        {Tag, Msg} -> flush_tagged(Tag, [Msg | Acc])
    after 0 ->
        lists:reverse(Acc)
    end.

queue_drain_finalize_starts_next_worker_test() ->
    Req = #{session_id => <<"s-queued">>, user_id => 50, session_pid => self()},
    QueuedItem = #{guild_id => 1, attempt => 0, request => Req},
    Queue = queue:from_list([QueuedItem]),
    DoneSessionId = <<"s-done">>,
    State0 = #{
        id => 1,
        data => #{},
        sessions => #{},
        session_connect_inflight => 1,
        session_connect_pending => #{DoneSessionId => 1, <<"s-queued">> => 0},
        session_connect_queue => Queue,
        session_connect_worker_refs => #{}
    },
    Computed = #{request => #{session_id => DoneSessionId, session_pid => undefined}},
    State1 = finalize_session_connect_async(DoneSessionId, 1, {ok, #{}}, Computed, State0),
    ?assertEqual(1, maps:get(session_connect_inflight, State1, 0)),
    RemainingQueue = maps:get(session_connect_queue, State1, queue:new()),
    ?assertEqual(0, queue:len(RemainingQueue)),
    WorkerRefs = maps:get(session_connect_worker_refs, State1, #{}),
    ?assertEqual(1, map_size(WorkerRefs)),
    Pending = maps:get(session_connect_pending, State1, #{}),
    ?assertEqual(undefined, maps:get(DoneSessionId, Pending, undefined)).

send_session_connect_result_direct_test() ->
    GuildId = 99,
    Attempt = 1,
    GuildState = #{<<"id">> => <<"99">>},
    send_session_connect_result(GuildId, Attempt, {ok, GuildState}, self(), undefined),
    receive
        {guild_connect_result, 99, 1, {ok, _, _}} -> ok
    after 100 ->
        error(timeout_waiting_for_direct_result)
    end.

send_session_connect_result_via_reply_pid_test() ->
    Parent = self(),
    GuildId = 99,
    Attempt = 1,
    GuildState = #{<<"id">> => <<"99">>},
    SessionPid = spawn(fun() -> receive _ -> ok end end),
    ReplyPid = spawn(fun() ->
        receive Msg -> Parent ! {relayed, Msg} end
    end),
    send_session_connect_result(GuildId, Attempt, {ok, GuildState}, SessionPid, ReplyPid),
    receive
        {relayed, {very_large_guild_session_connect_result, 99, 1, SessionPid, {ok, _}}} -> ok
    after 100 ->
        error(timeout_waiting_for_relayed_result)
    end.

-endif.
