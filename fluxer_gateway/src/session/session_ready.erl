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

-module(session_ready).

-export([
    process_guild_state/2,
    mark_guild_unavailable/2,
    check_readiness/1,
    dispatch_ready_data/1,
    update_ready_guilds/2
]).

-type session_state() :: session:session_state().
-type guild_id() :: session:guild_id().
-type channel_id() :: session:channel_id().
-type user_id() :: session:user_id().

-spec process_guild_state(map(), session_state()) -> {noreply, session_state()}.
process_guild_state(GuildState, State) ->
    Ready = maps:get(ready, State),
    CollectedGuilds = maps:get(collected_guild_states, State),
    case Ready of
        undefined ->
            Event = guild_state_event(GuildState),
            session_dispatch:handle_dispatch(Event, GuildState, State);
        _ ->
            NewCollectedGuilds = [GuildState | CollectedGuilds],
            NewState = maps:put(collected_guild_states, NewCollectedGuilds, State),
            check_readiness(update_ready_guilds(GuildState, NewState))
    end.

-spec mark_guild_unavailable(guild_id(), session_state()) -> {noreply, session_state()}.
mark_guild_unavailable(GuildId, State) ->
    CollectedGuilds = maps:get(collected_guild_states, State),
    Ready = maps:get(ready, State),
    UnavailableState = #{<<"id">> => integer_to_binary(GuildId), <<"unavailable">> => true},
    NewCollectedGuilds = [UnavailableState | CollectedGuilds],
    NewState = maps:put(collected_guild_states, NewCollectedGuilds, State),
    case Ready of
        undefined -> {noreply, NewState};
        _ -> {noreply, update_ready_guilds(UnavailableState, NewState)}
    end.

-spec check_readiness(session_state()) -> {noreply, session_state()}.
check_readiness(State) ->
    Ready = maps:get(ready, State),
    PresencePid = maps:get(presence_pid, State, undefined),
    Guilds = maps:get(guilds, State),
    case Ready of
        undefined ->
            {noreply, State};
        _ when PresencePid =/= undefined ->
            AllGuildsReady = lists:all(fun({_, V}) -> V =/= undefined end, maps:to_list(Guilds)),
            case AllGuildsReady of
                true -> dispatch_ready_data(State);
                false -> {noreply, State}
            end;
        _ ->
            {noreply, State}
    end.

-spec dispatch_ready_data(session_state()) ->
    {noreply, session_state()} | {stop, normal, session_state()}.
dispatch_ready_data(State) ->
    Ready = maps:get(ready, State),
    CollectedGuilds = maps:get(collected_guild_states, State),
    CollectedSessions = maps:get(collected_sessions, State),
    CollectedPresences = collect_ready_presences(State, CollectedGuilds),
    Users = collect_ready_users(State, CollectedGuilds),
    Version = maps:get(version, State),
    UserId = maps:get(user_id, State),
    SessionId = maps:get(id, State),
    SocketPid = maps:get(socket_pid, State, undefined),
    Guilds = maps:get(guilds, State),
    IsBot = maps:get(bot, State, false),
    ReadyData =
        case Ready of
            undefined -> #{<<"guilds">> => []};
            R -> R
        end,
    ReadyDataWithStrippedRelationships = strip_user_from_relationships(ReadyData),
    ReadyDataBotStripped =
        case IsBot of
            true -> maps:put(<<"guilds">>, [], ReadyDataWithStrippedRelationships);
            false -> ReadyDataWithStrippedRelationships
        end,
    UnavailableGuilds = [
        #{<<"id">> => integer_to_binary(GuildId), <<"unavailable">> => true}
     || {GuildId, undefined} <- maps:to_list(Guilds)
    ],
    StrippedGuilds = [strip_users_from_guild_members(G) || G <- lists:reverse(CollectedGuilds)],
    AllGuildStates = StrippedGuilds ++ UnavailableGuilds,
    ReadyDataWithoutGuildIds = maps:remove(<<"guild_ids">>, ReadyDataBotStripped),
    GuildsForReady =
        case IsBot of
            true -> [];
            false -> AllGuildStates
        end,
    FinalReadyData = maps:merge(ReadyDataWithoutGuildIds, #{
        <<"guilds">> => GuildsForReady,
        <<"sessions">> => CollectedSessions,
        <<"presences">> => CollectedPresences,
        <<"users">> => Users,
        <<"version">> => Version,
        <<"session_id">> => SessionId
    }),
    case SocketPid of
        undefined ->
            {stop, normal, State};
        Pid when is_pid(Pid) ->
            otel_metrics:counter(<<"gateway.ready">>, 1, #{}),
            StateAfterReady = dispatch_event(ready, FinalReadyData, State),
            SessionCount = length(CollectedSessions),
            GuildCount = length(GuildsForReady),
            PresenceCount = length(CollectedPresences),
            Dimensions = #{
                <<"session_id">> => SessionId,
                <<"user_id">> => integer_to_binary(UserId),
                <<"bot">> => bool_to_binary(IsBot)
            },
            otel_metrics:gauge(<<"gateway.sessions.active">>, SessionCount, Dimensions),
            otel_metrics:gauge(<<"gateway.guilds.active">>, GuildCount, Dimensions),
            otel_metrics:gauge(<<"gateway.presences.active">>, PresenceCount, Dimensions),
            StateAfterGuildCreates =
                case IsBot of
                    true ->
                        lists:foldl(
                            fun(GuildState, AccState) ->
                                dispatch_event(guild_state_event(GuildState), GuildState, AccState)
                            end,
                            StateAfterReady,
                            AllGuildStates
                        );
                    false ->
                        StateAfterReady
                end,
            PrivateChannels = get_private_channels(StateAfterGuildCreates),
            SessionPid = self(),
            spawn(fun() ->
                dispatch_call_creates_for_channels(
                    PrivateChannels, SessionId, SessionPid
                )
            end),
            FinalState = maps:merge(StateAfterGuildCreates, #{
                ready => undefined,
                collected_guild_states => [],
                collected_sessions => []
            }),
            {noreply, FinalState}
    end.

-spec is_unavailable_guild_state(map()) -> boolean().
is_unavailable_guild_state(GuildState) ->
    maps:get(<<"unavailable">>, GuildState, false) =:= true.

-spec guild_state_event(map()) -> guild_create | guild_delete.
guild_state_event(GuildState) ->
    case is_unavailable_guild_state(GuildState) of
        true ->
            guild_delete;
        false ->
            guild_create
    end.

-spec dispatch_event(atom(), map(), session_state()) -> session_state().
dispatch_event(Event, Data, State) ->
    Seq = maps:get(seq, State),
    SocketPid = maps:get(socket_pid, State, undefined),
    NewSeq = Seq + 1,
    case SocketPid of
        undefined -> ok;
        Pid when is_pid(Pid) -> Pid ! {dispatch, Event, Data, NewSeq}
    end,
    maps:put(seq, NewSeq, State).

-spec update_ready_guilds(map(), session_state()) -> session_state().
update_ready_guilds(GuildState, State) ->
    case maps:get(bot, State, false) of
        true ->
            State;
        false ->
            Ready = maps:get(ready, State),
            case is_map(Ready) of
                true ->
                    Guilds = maps:get(<<"guilds">>, Ready, []),
                    NewGuilds = Guilds ++ [GuildState],
                    NewReady = maps:put(<<"guilds">>, NewGuilds, Ready),
                    maps:put(ready, NewReady, State);
                false ->
                    State
            end
    end.

-spec collect_ready_users(session_state(), [map()]) -> [map()].
collect_ready_users(State, CollectedGuilds) ->
    case maps:get(bot, State, false) of
        true -> [];
        false -> collect_ready_users_nonbot(State, CollectedGuilds)
    end.

-spec collect_ready_users_nonbot(session_state(), [map()]) -> [map()].
collect_ready_users_nonbot(State, CollectedGuilds) ->
    Ready = maps:get(ready, State, #{}),
    Relationships = map_utils:ensure_list(map_utils:get_safe(Ready, <<"relationships">>, [])),
    RelUsers = [
        user_utils:normalize_user(maps:get(<<"user">>, Rel, undefined))
     || Rel <- Relationships
    ],
    Channels = maps:get(channels, State, #{}),
    ChannelUsers = collect_channel_users(maps:values(Channels)),
    GuildUsers = collect_guild_users(CollectedGuilds),
    Users0 = [U || U <- RelUsers ++ ChannelUsers ++ GuildUsers, is_map(U)],
    dedup_users(Users0).

-spec collect_ready_presences(session_state(), [map()]) -> [map()].
collect_ready_presences(State, _CollectedGuilds) ->
    CurrentUserId = maps:get(user_id, State),
    IsBot = maps:get(bot, State, false),
    {FriendIds, GdmIds} =
        case IsBot of
            true ->
                {[], []};
            false ->
                FIds = presence_targets:friend_ids_from_state(State),
                GdmMap = presence_targets:group_dm_recipients_from_state(State),
                GIds = lists:append([
                    maps:keys(Recipients)
                 || {_Cid, Recipients} <- maps:to_list(GdmMap)
                ]),
                {FIds, GIds}
        end,
    Targets = lists:usort(FriendIds ++ GdmIds) -- [CurrentUserId],
    case Targets of
        [] ->
            [];
        _ ->
            Cached = presence_cache:bulk_get(Targets),
            Visible = [P || P <- Cached, presence_visible(P)],
            dedup_presences(Visible)
    end.

-spec presence_user_id(map()) -> user_id() | undefined.
presence_user_id(P) when is_map(P) ->
    User = maps:get(<<"user">>, P, #{}),
    map_utils:get_integer(User, <<"id">>, undefined);
presence_user_id(_) ->
    undefined.

-spec presence_visible(map()) -> boolean().
presence_visible(P) ->
    Status = maps:get(<<"status">>, P, <<"offline">>),
    Status =/= <<"offline">> andalso Status =/= <<"invisible">>.

-spec dedup_presences([map()]) -> [map()].
dedup_presences(Presences) ->
    Map = lists:foldl(
        fun(P, Acc) ->
            case presence_user_id(P) of
                undefined -> Acc;
                Id -> maps:put(Id, P, Acc)
            end
        end,
        #{},
        Presences
    ),
    maps:values(Map).

-spec collect_channel_users([map()]) -> [map()].
collect_channel_users(Channels) ->
    lists:foldl(
        fun(Channel, Acc) ->
            Type = maps:get(<<"type">>, Channel, 0),
            case Type =:= 1 orelse Type =:= 3 of
                true ->
                    RecipientsRaw = map_utils:ensure_list(maps:get(<<"recipients">>, Channel, [])),
                    Recipients = [user_utils:normalize_user(R) || R <- RecipientsRaw],
                    Recipients ++ Acc;
                false ->
                    Acc
            end
        end,
        [],
        Channels
    ).

-spec collect_guild_users([map()]) -> [map()].
collect_guild_users(GuildStates) ->
    lists:foldl(
        fun(GuildState, Acc) ->
            Members = map_utils:ensure_list(maps:get(<<"members">>, GuildState, [])),
            MemberUsers = [
                user_utils:normalize_user(maps:get(<<"user">>, M, undefined))
             || M <- Members
            ],
            MemberUsers ++ Acc
        end,
        [],
        ensure_list(GuildStates)
    ).

-spec dedup_users([map()]) -> [map()].
dedup_users(Users) ->
    Map = lists:foldl(
        fun(U, Acc) ->
            Id = maps:get(<<"id">>, U, undefined),
            case Id of
                undefined -> Acc;
                _ -> maps:put(Id, U, Acc)
            end
        end,
        #{},
        Users
    ),
    maps:values(Map).

-spec ensure_list([term()]) -> [term()].
ensure_list(List) -> List.

-spec strip_users_from_guild_members(map()) -> map().
strip_users_from_guild_members(GuildState) ->
    case maps:get(<<"unavailable">>, GuildState, false) of
        true ->
            GuildState;
        false ->
            Members = map_utils:ensure_list(maps:get(<<"members">>, GuildState, [])),
            StrippedMembers = [strip_user_from_member(M) || M <- Members],
            maps:put(<<"members">>, StrippedMembers, GuildState)
    end.

-spec strip_user_from_member(map()) -> map().
strip_user_from_member(Member) when is_map(Member) ->
    case maps:get(<<"user">>, Member, undefined) of
        undefined ->
            Member;
        User when is_map(User) ->
            UserId = maps:get(<<"id">>, User, undefined),
            maps:put(<<"user">>, #{<<"id">> => UserId}, Member);
        _ ->
            Member
    end;
strip_user_from_member(Member) ->
    Member.

-spec strip_user_from_relationships(map()) -> map().
strip_user_from_relationships(ReadyData) when is_map(ReadyData) ->
    Relationships = map_utils:ensure_list(maps:get(<<"relationships">>, ReadyData, [])),
    StrippedRelationships = [strip_user_from_relationship(R) || R <- Relationships],
    maps:put(<<"relationships">>, StrippedRelationships, ReadyData);
strip_user_from_relationships(ReadyData) ->
    ReadyData.

-spec strip_user_from_relationship(map()) -> map().
strip_user_from_relationship(Relationship) when is_map(Relationship) ->
    case maps:get(<<"user">>, Relationship, undefined) of
        undefined ->
            Relationship;
        User when is_map(User) ->
            UserId = maps:get(<<"id">>, User, undefined),
            RelWithoutUser = maps:remove(<<"user">>, Relationship),
            case maps:get(<<"id">>, RelWithoutUser, undefined) of
                undefined -> maps:put(<<"id">>, UserId, RelWithoutUser);
                _ -> RelWithoutUser
            end;
        _ ->
            Relationship
    end;
strip_user_from_relationship(Relationship) ->
    Relationship.

-spec get_private_channels(session_state()) -> #{channel_id() => map()}.
get_private_channels(State) ->
    Channels = maps:get(channels, State, #{}),
    maps:filter(
        fun(_ChannelId, Channel) ->
            ChannelType = maps:get(<<"type">>, Channel, 0),
            ChannelType =:= 1 orelse ChannelType =:= 3
        end,
        Channels
    ).

-spec dispatch_call_creates_for_channels(#{channel_id() => map()}, binary(), pid()) -> ok.
dispatch_call_creates_for_channels(PrivateChannels, SessionId, SessionPid) ->
    lists:foreach(
        fun({ChannelId, _Channel}) ->
            dispatch_call_create_for_channel(ChannelId, SessionId, SessionPid)
        end,
        maps:to_list(PrivateChannels)
    ).

-spec dispatch_call_create_for_channel(channel_id(), binary(), pid()) -> ok.
dispatch_call_create_for_channel(ChannelId, SessionId, SessionPid) ->
    try
        case gen_server:call(call_manager, {lookup, ChannelId}, 5000) of
            {ok, CallPid} ->
                dispatch_call_create_from_pid(CallPid, ChannelId, SessionId, SessionPid);
            _ ->
                ok
        end
    catch
        _:_ -> ok
    end.

-spec dispatch_call_create_from_pid(pid(), channel_id(), binary(), pid()) -> ok.
dispatch_call_create_from_pid(CallPid, ChannelId, SessionId, SessionPid) ->
    case gen_server:call(CallPid, {get_state}, 5000) of
        {ok, CallData} ->
            gen_server:cast(SessionPid, {call_monitor, ChannelId, CallPid}),
            gen_server:cast(SessionPid, {dispatch, call_create, CallData}),
            otel_metrics:counter(<<"gateway.calls.total">>, 1, #{
                <<"channel_id">> => integer_to_binary(ChannelId),
                <<"session_id">> => SessionId,
                <<"status">> => <<"create">>
            }),
            ok;
        _ ->
            ok
    end.

-spec bool_to_binary(boolean()) -> binary().
bool_to_binary(true) -> <<"true">>;
bool_to_binary(false) -> <<"false">>.

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").

ensure_list_test() ->
    ?assertEqual([1, 2, 3], ensure_list([1, 2, 3])),
    ?assertEqual([], ensure_list([])),
    ok.

bool_to_binary_test() ->
    ?assertEqual(<<"true">>, bool_to_binary(true)),
    ?assertEqual(<<"false">>, bool_to_binary(false)),
    ok.

presence_visible_test() ->
    ?assertEqual(true, presence_visible(#{<<"status">> => <<"online">>})),
    ?assertEqual(true, presence_visible(#{<<"status">> => <<"idle">>})),
    ?assertEqual(true, presence_visible(#{<<"status">> => <<"dnd">>})),
    ?assertEqual(false, presence_visible(#{<<"status">> => <<"offline">>})),
    ?assertEqual(false, presence_visible(#{<<"status">> => <<"invisible">>})),
    ?assertEqual(false, presence_visible(#{})),
    ok.

dedup_users_test() ->
    Users = [
        #{<<"id">> => <<"1">>, <<"username">> => <<"alice">>},
        #{<<"id">> => <<"2">>, <<"username">> => <<"bob">>},
        #{<<"id">> => <<"1">>, <<"username">> => <<"alice_duplicate">>}
    ],
    Result = dedup_users(Users),
    ?assertEqual(2, length(Result)),
    ok.

strip_user_from_member_test() ->
    Member = #{
        <<"user">> => #{<<"id">> => <<"123">>, <<"username">> => <<"test">>},
        <<"nick">> => <<"nickname">>
    },
    Stripped = strip_user_from_member(Member),
    ?assertEqual(#{<<"id">> => <<"123">>}, maps:get(<<"user">>, Stripped)),
    ?assertEqual(<<"nickname">>, maps:get(<<"nick">>, Stripped)),
    ok.

strip_user_from_relationship_test() ->
    Rel = #{
        <<"user">> => #{<<"id">> => <<"100">>, <<"username">> => <<"friend">>}, <<"type">> => 1
    },
    Stripped = strip_user_from_relationship(Rel),
    ?assertEqual(undefined, maps:get(<<"user">>, Stripped, undefined)),
    ?assertEqual(<<"100">>, maps:get(<<"id">>, Stripped)),
    ?assertEqual(1, maps:get(<<"type">>, Stripped)),
    ok.

process_guild_state_unavailable_dispatches_guild_delete_test() ->
    State0 = base_state_for_guild_dispatch_test(),
    GuildState = #{<<"id">> => <<"123">>, <<"unavailable">> => true},
    {noreply, State1} = process_guild_state(GuildState, State0),
    Buffer = maps:get(buffer, State1),
    ?assertEqual(1, length(Buffer)),
    FirstEvent = maps:get(event, hd(Buffer)),
    ?assertEqual(guild_delete, FirstEvent),
    ok.

process_guild_state_available_dispatches_guild_create_test() ->
    State0 = base_state_for_guild_dispatch_test(),
    GuildState = #{
        <<"id">> => <<"123">>,
        <<"unavailable">> => false,
        <<"channels">> => [],
        <<"members">> => []
    },
    {noreply, State1} = process_guild_state(GuildState, State0),
    Buffer = maps:get(buffer, State1),
    ?assertEqual(1, length(Buffer)),
    FirstEvent = maps:get(event, hd(Buffer)),
    ?assertEqual(guild_create, FirstEvent),
    ok.

dispatch_ready_data_bot_unavailable_dispatches_guild_delete_test() ->
    drain_mailbox(),
    UnavailableGuild = #{<<"id">> => <<"987">>, <<"unavailable">> => true},
    State0 = #{
        id => <<"session-ready-test">>,
        user_id => 42,
        version => 1,
        ready => #{<<"v">> => 9, <<"guilds">> => []},
        bot => true,
        guilds => #{987 => cached_unavailable},
        channels => #{},
        relationships => #{},
        collected_guild_states => [UnavailableGuild],
        collected_sessions => [],
        seq => 0,
        buffer => [],
        socket_pid => self(),
        ignored_events => #{},
        suppress_presence_updates => false,
        pending_presences => [],
        debounce_reactions => false,
        reaction_buffer => [],
        reaction_buffer_timer => undefined,
        presence_pid => undefined
    },
    {noreply, _State1} = dispatch_ready_data(State0),
    receive
        {dispatch, ready, ReadyData, _ReadySeq} ->
            ?assertEqual([], maps:get(<<"guilds">>, ReadyData, []));
        OtherReady ->
            ?assert(false, {unexpected_ready_message, OtherReady})
    after 1000 ->
        ?assert(false, ready_not_dispatched)
    end,
    receive
        {dispatch, guild_delete, GuildDeleteData, _GuildDeleteSeq} ->
            ?assertEqual(<<"987">>, maps:get(<<"id">>, GuildDeleteData)),
            ?assertEqual(true, maps:get(<<"unavailable">>, GuildDeleteData));
        OtherDelete ->
            ?assert(false, {unexpected_guild_event, OtherDelete})
    after 1000 ->
        ?assert(false, guild_delete_not_dispatched)
    end,
    receive
        {dispatch, guild_create, _GuildCreateData, _GuildCreateSeq} ->
            ?assert(false, unexpected_guild_create_for_unavailable_guild)
    after 100 ->
        ok
    end.

dispatch_ready_data_nonbot_includes_unavailable_guild_test() ->
    drain_mailbox(),
    UnavailableGuild = #{<<"id">> => <<"654">>, <<"unavailable">> => true},
    State0 = #{
        id => <<"session-ready-nonbot-test">>,
        user_id => 43,
        version => 1,
        ready => #{<<"v">> => 9, <<"guilds">> => []},
        bot => false,
        guilds => #{654 => cached_unavailable},
        channels => #{},
        relationships => #{},
        collected_guild_states => [UnavailableGuild],
        collected_sessions => [],
        seq => 0,
        buffer => [],
        socket_pid => self(),
        ignored_events => #{},
        suppress_presence_updates => false,
        pending_presences => [],
        debounce_reactions => false,
        reaction_buffer => [],
        reaction_buffer_timer => undefined,
        presence_pid => undefined
    },
    {noreply, _State1} = dispatch_ready_data(State0),
    receive
        {dispatch, ready, ReadyData, _ReadySeq} ->
            ReadyGuilds = maps:get(<<"guilds">>, ReadyData, []),
            ?assertEqual(1, length(ReadyGuilds)),
            ReadyGuild = hd(ReadyGuilds),
            ?assertEqual(<<"654">>, maps:get(<<"id">>, ReadyGuild)),
            ?assertEqual(true, maps:get(<<"unavailable">>, ReadyGuild));
        OtherReady ->
            ?assert(false, {unexpected_ready_message, OtherReady})
    after 1000 ->
        ?assert(false, ready_not_dispatched)
    end,
    receive
        {dispatch, guild_create, _GuildCreateData, _GuildCreateSeq} ->
            ?assert(false, unexpected_guild_create_for_nonbot_ready)
    after 100 ->
        ok
    end,
    receive
        {dispatch, guild_delete, _GuildDeleteData, _GuildDeleteSeq} ->
            ?assert(false, unexpected_guild_delete_for_nonbot_ready)
    after 100 ->
        ok
    end.

dispatch_call_create_from_pid_always_casts_to_session_test() ->
    ChannelId = 1234,
    SessionId = <<"session-ready-call-test">>,
    CallData = #{
        channel_id => integer_to_binary(ChannelId),
        message_id => <<"9001">>,
        region => null,
        ringing => [],
        recipients => [],
        voice_states => [],
        created_at => erlang:system_time(millisecond)
    },
    CallPid = spawn(fun() -> call_state_stub_loop(CallData) end),
    ok = dispatch_call_create_from_pid(CallPid, ChannelId, SessionId, self()),
    receive
        {'$gen_cast', {call_monitor, ChannelId, CallPid}} ->
            ok
    after 1000 ->
        ?assert(false, call_monitor_not_cast_to_session)
    end,
    receive
        {'$gen_cast', {dispatch, call_create, DispatchData}} ->
            ?assertEqual(CallData, DispatchData)
    after 1000 ->
        ?assert(false, call_create_not_cast_to_session)
    end,
    exit(CallPid, kill),
    ok.

-spec call_state_stub_loop(map()) -> ok.
call_state_stub_loop(CallData) ->
    receive
        {'$gen_call', From, {get_state}} ->
            gen_server:reply(From, {ok, CallData}),
            call_state_stub_loop(CallData);
        _ ->
            call_state_stub_loop(CallData)
    end.

-spec drain_mailbox() -> ok.
drain_mailbox() ->
    receive
        _Message ->
            drain_mailbox()
    after 0 ->
        ok
    end.

-spec base_state_for_guild_dispatch_test() -> session_state().
base_state_for_guild_dispatch_test() ->
    #{
        ready => undefined,
        seq => 0,
        buffer => [],
        socket_pid => undefined,
        ignored_events => #{},
        channels => #{},
        relationships => #{},
        suppress_presence_updates => false,
        pending_presences => [],
        presence_pid => undefined,
        debounce_reactions => false,
        reaction_buffer => [],
        reaction_buffer_timer => undefined,
        collected_guild_states => []
    }.

-endif.
