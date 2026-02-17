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

-module(session).
-behaviour(gen_server).

-export([start_link/1]).
-export([init/1, handle_call/3, handle_cast/2, handle_info/2, terminate/2, code_change/3]).

-type session_id() :: binary().
-type user_id() :: integer().
-type guild_id() :: integer().
-type channel_id() :: integer().
-type seq() :: non_neg_integer().
-type status() :: online | offline | idle | dnd.
-type guild_ref() :: {pid(), reference()} | undefined | cached_unavailable.
-type call_ref() :: {pid(), reference()}.

-type session_state() :: #{
    id := session_id(),
    user_id := user_id(),
    user_data := map(),
    custom_status := map() | null,
    version := non_neg_integer(),
    token_hash := binary(),
    auth_session_id_hash := binary(),
    buffer := [map()],
    seq := seq(),
    ack_seq := seq(),
    properties := map(),
    status := status(),
    afk := boolean(),
    mobile := boolean(),
    presence_pid := pid() | undefined,
    presence_mref := reference() | undefined,
    socket_pid := pid() | undefined,
    socket_mref := reference() | undefined,
    guilds := #{guild_id() => guild_ref()},
    calls := #{channel_id() => call_ref()},
    channels := #{channel_id() => map()},
    ready := map() | undefined,
    bot := boolean(),
    ignored_events := #{binary() => true},
    initial_guild_id := guild_id() | undefined,
    collected_guild_states := [map()],
    collected_sessions := [map()],
    collected_presences := [map()],
    relationships := #{user_id() => integer()},
    suppress_presence_updates := boolean(),
    pending_presences := [map()],
    guild_connect_inflight := #{guild_id() => non_neg_integer()},
    voice_queue := queue:queue(),
    voice_queue_timer := reference() | undefined,
    debounce_reactions := boolean(),
    reaction_buffer := [map()],
    reaction_buffer_timer := reference() | undefined
}.

-export_type([session_state/0, session_id/0, user_id/0, guild_id/0, channel_id/0, seq/0]).

-spec start_link(map()) -> {ok, pid()} | {error, term()}.
start_link(SessionData) ->
    gen_server:start_link(?MODULE, SessionData, []).

-spec init(map()) -> {ok, session_state()}.
init(SessionData) ->
    process_flag(trap_exit, true),
    Id = maps:get(id, SessionData),
    UserId = maps:get(user_id, SessionData),
    UserData = maps:get(user_data, SessionData),
    Version = maps:get(version, SessionData),
    TokenHash = maps:get(token_hash, SessionData),
    AuthSessionIdHash = maps:get(auth_session_id_hash, SessionData),
    Properties = maps:get(properties, SessionData),
    Status = maps:get(status, SessionData),
    Afk = maps:get(afk, SessionData, false),
    Mobile = maps:get(mobile, SessionData, false),
    SocketPid = maps:get(socket_pid, SessionData),
    GuildIds = maps:get(guilds, SessionData),
    Ready0 = maps:get(ready, SessionData),
    Bot = maps:get(bot, SessionData, false),
    InitialGuildId = maps:get(initial_guild_id, SessionData, undefined),
    Ready =
        case Bot of
            true -> ensure_bot_ready_map(Ready0);
            false -> Ready0
        end,
    IgnoredEvents = build_ignored_events_map(maps:get(ignored_events, SessionData, [])),
    DebounceReactions = maps:get(debounce_reactions, SessionData, false),
    Channels = load_private_channels(Ready),
    VoiceQueueState = session_voice:init_voice_queue(),
    State = #{
        id => Id,
        user_id => UserId,
        user_data => UserData,
        custom_status => maps:get(custom_status, SessionData, null),
        version => Version,
        token_hash => TokenHash,
        auth_session_id_hash => AuthSessionIdHash,
        buffer => [],
        seq => 0,
        ack_seq => 0,
        properties => Properties,
        status => Status,
        afk => Afk,
        mobile => Mobile,
        presence_pid => undefined,
        presence_mref => undefined,
        socket_pid => SocketPid,
        socket_mref => monitor(process, SocketPid),
        guilds => maps:from_list([{Gid, undefined} || Gid <- GuildIds]),
        calls => #{},
        channels => Channels,
        ready => Ready,
        bot => Bot,
        ignored_events => IgnoredEvents,
        initial_guild_id => InitialGuildId,
        collected_guild_states => [],
        collected_sessions => [],
        collected_presences => [],
        relationships => load_relationships(Ready),
        suppress_presence_updates => true,
        pending_presences => [],
        guild_connect_inflight => #{},
        debounce_reactions => DebounceReactions,
        reaction_buffer => [],
        reaction_buffer_timer => undefined
    },
    StateWithVoiceQueue = maps:merge(State, VoiceQueueState),
    self() ! {presence_connect, 0},
    case Bot of
        true -> self() ! bot_initial_ready;
        false -> ok
    end,
    lists:foreach(fun(Gid) -> self() ! {guild_connect, Gid, 0} end, GuildIds),
    erlang:send_after(3000, self(), premature_readiness),
    erlang:send_after(200, self(), enable_presence_updates),
    {ok, StateWithVoiceQueue}.

-spec handle_call(Request, From, State) -> Result when
    Request ::
        {token_verify, binary()}
        | {heartbeat_ack, seq()}
        | {resume, seq(), pid()}
        | {get_state}
        | {voice_state_update, map()}
        | term(),
    From :: gen_server:from(),
    State :: session_state(),
    Result :: {reply, term(), session_state()}.
handle_call({token_verify, Token}, _From, State) ->
    TokenHash = maps:get(token_hash, State),
    HashedInput = utils:hash_token(Token),
    IsValid = HashedInput =:= TokenHash,
    {reply, IsValid, State};
handle_call({heartbeat_ack, Seq}, _From, State) ->
    AckSeq = maps:get(ack_seq, State),
    Buffer = maps:get(buffer, State),
    if
        Seq < AckSeq ->
            {reply, false, State};
        true ->
            NewBuffer = [Event || Event <- Buffer, maps:get(seq, Event) > Seq],
            {reply, true, maps:merge(State, #{ack_seq => Seq, buffer => NewBuffer})}
    end;
handle_call({resume, Seq, SocketPid}, _From, State) ->
    CurrentSeq = maps:get(seq, State),
    Buffer = maps:get(buffer, State),
    PresencePid = maps:get(presence_pid, State, undefined),
    SessionId = maps:get(id, State),
    Status = maps:get(status, State),
    Afk = maps:get(afk, State),
    Mobile = maps:get(mobile, State),
    if
        Seq > CurrentSeq ->
            {reply, invalid_seq, State};
        true ->
            MissedEvents = [Event || Event <- Buffer, maps:get(seq, Event) > Seq],
            NewState = maps:merge(State, #{
                socket_pid => SocketPid,
                socket_mref => monitor(process, SocketPid)
            }),
            case PresencePid of
                undefined ->
                    ok;
                Pid when is_pid(Pid) ->
                    spawn(fun() ->
                        gen_server:call(
                            Pid,
                            {session_connect, #{
                                session_id => SessionId,
                                status => Status,
                                afk => Afk,
                                mobile => Mobile
                            }},
                            10000
                        )
                    end)
            end,
            {reply, {ok, MissedEvents}, NewState}
    end;
handle_call({get_state}, _From, State) ->
    SerializedState = serialize_state(State),
    {reply, SerializedState, State};
handle_call({voice_state_update, Data}, _From, State) ->
    session_voice:handle_voice_state_update(Data, State);
handle_call(_, _From, State) ->
    {reply, ok, State}.

-spec handle_cast(Request, State) -> Result when
    Request ::
        {presence_update, map()}
        | {dispatch, atom(), map()}
        | {initial_global_presences, [map()]}
        | {guild_join, guild_id()}
        | {guild_leave, guild_id()}
        | {guild_leave, guild_id(), forced_unavailable}
        | {terminate, [binary()]}
        | {terminate_force}
        | {call_monitor, channel_id(), pid()}
        | {call_unmonitor, channel_id()}
        | {call_force_disconnect, channel_id(), binary() | undefined}
        | term(),
    State :: session_state(),
    Result :: {noreply, session_state()} | {stop, normal, session_state()}.
handle_cast({presence_update, Update}, State) ->
    PresencePid = maps:get(presence_pid, State, undefined),
    SessionId = maps:get(id, State),
    Status = maps:get(status, State),
    Afk = maps:get(afk, State),
    Mobile = maps:get(mobile, State),
    NewStatus = maps:get(status, Update, Status),
    NewAfk = maps:get(afk, Update, Afk),
    NewMobile = maps:get(mobile, Update, Mobile),
    NewState = maps:merge(State, #{status => NewStatus, afk => NewAfk, mobile => NewMobile}),
    case PresencePid of
        undefined ->
            ok;
        Pid when is_pid(Pid) ->
            gen_server:cast(
                Pid,
                {presence_update, #{
                    session_id => SessionId, status => NewStatus, afk => NewAfk, mobile => NewMobile
                }}
            )
    end,
    {noreply, NewState};
handle_cast({dispatch, Event, Data}, State) ->
    session_dispatch:handle_dispatch(Event, Data, State);
handle_cast({initial_global_presences, Presences}, State) ->
    NewState = lists:foldl(
        fun(Presence, AccState) ->
            {noreply, UpdatedState} = session_dispatch:handle_dispatch(
                presence_update, Presence, AccState
            ),
            UpdatedState
        end,
        State,
        Presences
    ),
    {noreply, NewState};
handle_cast({guild_join, GuildId}, State) ->
    self() ! {guild_connect, GuildId, 0},
    {noreply, State};
handle_cast({guild_leave, GuildId, forced_unavailable}, State) ->
    Guilds = maps:get(guilds, State),
    case maps:get(GuildId, Guilds, undefined) of
        {Pid, Ref} when is_pid(Pid) ->
            demonitor(Ref, [flush]);
        _ ->
            ok
    end,
    NewGuilds = maps:put(GuildId, cached_unavailable, Guilds),
    {noreply, State1} = session_dispatch:handle_dispatch(
        guild_delete,
        #{<<"id">> => integer_to_binary(GuildId), <<"unavailable">> => true},
        State
    ),
    self() ! {guild_connect, GuildId, 0},
    {noreply, maps:put(guilds, NewGuilds, State1)};
handle_cast({guild_leave, GuildId}, State) ->
    Guilds = maps:get(guilds, State),
    case maps:get(GuildId, Guilds, undefined) of
        {Pid, Ref} when is_pid(Pid) ->
            demonitor(Ref, [flush]),
            NewGuilds = maps:put(GuildId, undefined, Guilds),
            session_dispatch:handle_dispatch(
                guild_delete, #{<<"id">> => integer_to_binary(GuildId)}, State
            ),
            {noreply, maps:put(guilds, NewGuilds, State)};
        _ ->
            {noreply, State}
    end;
handle_cast({terminate, SessionIdHashes}, State) ->
    AuthHash = maps:get(auth_session_id_hash, State),
    DecodedHashes = [base64url:decode(Hash) || Hash <- SessionIdHashes],
    case lists:member(AuthHash, DecodedHashes) of
        true -> {stop, normal, State};
        false -> {noreply, State}
    end;
handle_cast({terminate_force}, State) ->
    {stop, normal, State};
handle_cast({call_monitor, ChannelId, CallPid}, State) ->
    Calls = maps:get(calls, State, #{}),
    case maps:get(ChannelId, Calls, undefined) of
        undefined ->
            Ref = monitor(process, CallPid),
            NewCalls = maps:put(ChannelId, {CallPid, Ref}, Calls),
            {noreply, maps:put(calls, NewCalls, State)};
        {OldPid, OldRef} when OldPid =/= CallPid ->
            demonitor(OldRef, [flush]),
            Ref = monitor(process, CallPid),
            NewCalls = maps:put(ChannelId, {CallPid, Ref}, Calls),
            {noreply, maps:put(calls, NewCalls, State)};
        _ ->
            {noreply, State}
    end;
handle_cast({call_unmonitor, ChannelId}, State) ->
    Calls = maps:get(calls, State, #{}),
    case maps:get(ChannelId, Calls, undefined) of
        {_Pid, Ref} ->
            demonitor(Ref, [flush]),
            NewCalls = maps:remove(ChannelId, Calls),
            {noreply, maps:put(calls, NewCalls, State)};
        undefined ->
            {noreply, State}
    end;
handle_cast({call_force_disconnect, ChannelId, ConnectionId}, State) ->
    NewState = force_disconnect_dm_call(ChannelId, ConnectionId, State),
    {noreply, NewState};
handle_cast(_, State) ->
    {noreply, State}.

-spec handle_info(Info, State) -> Result when
    Info ::
        {presence_connect, non_neg_integer()}
        | {guild_connect, guild_id(), non_neg_integer()}
        | {guild_connect_result, guild_id(), non_neg_integer(), term()}
        | {guild_connect_timeout, guild_id(), non_neg_integer()}
        | {call_reconnect, channel_id(), non_neg_integer()}
        | enable_presence_updates
        | premature_readiness
        | bot_initial_ready
        | resume_timeout
        | flush_reaction_buffer
        | {process_voice_queue}
        | {'DOWN', reference(), process, pid(), term()}
        | term(),
    State :: session_state(),
    Result :: {noreply, session_state()} | {stop, normal, session_state()}.
handle_info({presence_connect, Attempt}, State) ->
    PresencePid = maps:get(presence_pid, State, undefined),
    case PresencePid of
        undefined -> session_connection:handle_presence_connect(Attempt, State);
        _ -> {noreply, State}
    end;
handle_info({guild_connect, GuildId, Attempt}, State) ->
    session_connection:handle_guild_connect(GuildId, Attempt, State);
handle_info({guild_connect_result, GuildId, Attempt, Result}, State) ->
    session_connection:handle_guild_connect_result(GuildId, Attempt, Result, State);
handle_info({guild_connect_timeout, GuildId, Attempt}, State) ->
    session_connection:handle_guild_connect_timeout(GuildId, Attempt, State);
handle_info({call_reconnect, ChannelId, Attempt}, State) ->
    session_connection:handle_call_reconnect(ChannelId, Attempt, State);
handle_info(enable_presence_updates, State) ->
    FlushedState = session_dispatch:flush_all_pending_presences(State),
    {noreply, maps:put(suppress_presence_updates, false, FlushedState)};
handle_info(premature_readiness, State) ->
    Ready = maps:get(ready, State),
    case Ready of
        undefined -> {noreply, State};
        _ -> session_ready:dispatch_ready_data(State)
    end;
handle_info(bot_initial_ready, State) ->
    Ready = maps:get(ready, State, undefined),
    case Ready of
        undefined -> {noreply, State};
        _ -> session_ready:dispatch_ready_data(State)
    end;
handle_info(resume_timeout, State) ->
    SocketPid = maps:get(socket_pid, State, undefined),
    case SocketPid of
        undefined -> {stop, normal, State};
        _ -> {noreply, State}
    end;
handle_info({process_voice_queue}, State) ->
    NewState = session_voice:process_voice_queue(State),
    VoiceQueue = maps:get(voice_queue, NewState, queue:new()),
    case queue:is_empty(VoiceQueue) of
        false ->
            Timer = erlang:send_after(100, self(), {process_voice_queue}),
            {noreply, maps:put(voice_queue_timer, Timer, NewState)};
        true ->
            {noreply, NewState}
    end;
handle_info(flush_reaction_buffer, State) ->
    NewState = session_dispatch:flush_reaction_buffer(State),
    {noreply, NewState};
handle_info({'DOWN', Ref, process, _Pid, Reason}, State) ->
    session_monitor:handle_process_down(Ref, Reason, State);
handle_info(_Info, State) ->
    {noreply, State}.

-spec terminate(term(), session_state()) -> ok.
terminate(_Reason, _State) ->
    ok.

-spec code_change(term(), session_state(), term()) -> {ok, session_state()}.
code_change(_OldVsn, State, _Extra) ->
    {ok, State}.

-spec force_disconnect_dm_call(channel_id(), binary() | undefined, session_state()) -> session_state().
force_disconnect_dm_call(ChannelId, ConnectionId, State) ->
    UserId = maps:get(user_id, State),
    SessionId = maps:get(id, State),
    EffectiveConnectionId = resolve_dm_connection_id_for_channel(ChannelId, ConnectionId, UserId, State),
    gen_server:cast(self(), {call_unmonitor, ChannelId}),
    case EffectiveConnectionId of
        undefined ->
            State;
        _ ->
            Request = #{
                user_id => UserId,
                channel_id => null,
                session_id => SessionId,
                connection_id => EffectiveConnectionId,
                self_mute => false,
                self_deaf => false,
                self_video => false,
                self_stream => false,
                viewer_stream_keys => [],
                is_mobile => false,
                latitude => null,
                longitude => null
            },
            StateWithSessionPid = maps:put(session_pid, self(), State),
            case dm_voice:voice_state_update(Request, StateWithSessionPid) of
                {reply, #{success := true}, NewState} ->
                    maps:remove(session_pid, NewState);
                _ ->
                    {reply, #{success := true}, FallbackState} =
                        dm_voice:disconnect_voice_user(UserId, StateWithSessionPid),
                    maps:remove(session_pid, FallbackState)
            end
    end.

-spec resolve_dm_connection_id_for_channel(
    channel_id(), binary() | undefined, user_id(), session_state()
) -> binary() | undefined.
resolve_dm_connection_id_for_channel(_ChannelId, ConnectionId, _UserId, _State)
    when is_binary(ConnectionId) ->
    ConnectionId;
resolve_dm_connection_id_for_channel(ChannelId, _ConnectionId, UserId, State) ->
    VoiceStates = maps:get(dm_voice_states, State, #{}),
    UserIdBin = integer_to_binary(UserId),
    ChannelIdBin = integer_to_binary(ChannelId),
    maps:fold(
        fun
            (ConnId, VoiceState, undefined) ->
                case
                    {
                        maps:get(<<"user_id">>, VoiceState, undefined),
                        maps:get(<<"channel_id">>, VoiceState, undefined)
                    }
                of
                    {UserIdBin, ChannelIdBin} ->
                        ConnId;
                    _ ->
                        undefined
                end;
            (_ConnId, _VoiceState, ExistingConnId) ->
                ExistingConnId
        end,
        undefined,
        VoiceStates
    ).

-spec serialize_state(session_state()) -> map().
serialize_state(State) ->
    #{
        id => maps:get(id, State),
        session_id => maps:get(id, State),
        user_id => integer_to_binary(maps:get(user_id, State)),
        user_data => maps:get(user_data, State),
        version => maps:get(version, State),
        seq => maps:get(seq, State),
        ack_seq => maps:get(ack_seq, State),
        properties => maps:get(properties, State),
        status => maps:get(status, State),
        afk => maps:get(afk, State),
        mobile => maps:get(mobile, State),
        buffer => maps:get(buffer, State),
        ready => maps:get(ready, State),
        guilds => maps:get(guilds, State, #{}),
        collected_guild_states => maps:get(collected_guild_states, State),
        collected_sessions => maps:get(collected_sessions, State),
        collected_presences => maps:get(collected_presences, State, [])
    }.

-spec build_ignored_events_map([binary()]) -> #{binary() => true}.
build_ignored_events_map(Events) when is_list(Events) ->
    maps:from_list([{Event, true} || Event <- Events]);
build_ignored_events_map(_) ->
    #{}.

-spec load_private_channels(map() | undefined) -> #{channel_id() => map()}.
load_private_channels(Ready) when is_map(Ready) ->
    PrivateChannels = maps:get(<<"private_channels">>, Ready, []),
    maps:from_list([
        {type_conv:extract_id(Channel, <<"id">>), Channel}
     || Channel <- PrivateChannels
    ]);
load_private_channels(_) ->
    #{}.

-spec load_relationships(map() | undefined) -> #{user_id() => integer()}.
load_relationships(Ready) when is_map(Ready) ->
    Relationships = maps:get(<<"relationships">>, Ready, []),
    maps:from_list(
        [
            {type_conv:extract_id(Rel, <<"id">>), maps:get(<<"type">>, Rel, 0)}
         || Rel <- Relationships, type_conv:extract_id(Rel, <<"id">>) =/= undefined
        ]
    );
load_relationships(_) ->
    #{}.

-spec ensure_bot_ready_map(map() | undefined) -> map().
ensure_bot_ready_map(undefined) ->
    #{<<"guilds">> => []};
ensure_bot_ready_map(Ready) when is_map(Ready) ->
    maps:merge(Ready, #{<<"guilds">> => []});
ensure_bot_ready_map(_) ->
    #{<<"guilds">> => []}.

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").

build_ignored_events_map_test() ->
    ?assertEqual(#{}, build_ignored_events_map([])),
    ?assertEqual(#{<<"TYPING_START">> => true}, build_ignored_events_map([<<"TYPING_START">>])),
    ?assertEqual(
        #{<<"TYPING_START">> => true, <<"PRESENCE_UPDATE">> => true},
        build_ignored_events_map([<<"TYPING_START">>, <<"PRESENCE_UPDATE">>])
    ),
    ?assertEqual(#{}, build_ignored_events_map(not_a_list)),
    ok.

load_private_channels_test() ->
    ?assertEqual(#{}, load_private_channels(undefined)),
    ?assertEqual(#{}, load_private_channels(#{})),
    Ready = #{
        <<"private_channels">> => [
            #{<<"id">> => <<"123">>, <<"type">> => 1},
            #{<<"id">> => <<"456">>, <<"type">> => 3}
        ]
    },
    Channels = load_private_channels(Ready),
    ?assertEqual(2, maps:size(Channels)),
    ?assert(maps:is_key(123, Channels)),
    ?assert(maps:is_key(456, Channels)),
    ok.

load_relationships_test() ->
    ?assertEqual(#{}, load_relationships(undefined)),
    ?assertEqual(#{}, load_relationships(#{})),
    Ready = #{
        <<"relationships">> => [
            #{<<"id">> => <<"100">>, <<"type">> => 1},
            #{<<"id">> => <<"200">>, <<"type">> => 3}
        ]
    },
    Rels = load_relationships(Ready),
    ?assertEqual(2, maps:size(Rels)),
    ?assertEqual(1, maps:get(100, Rels)),
    ?assertEqual(3, maps:get(200, Rels)),
    ok.

ensure_bot_ready_map_test() ->
    ?assertEqual(#{<<"guilds">> => []}, ensure_bot_ready_map(undefined)),
    ?assertEqual(
        #{<<"guilds">> => [], <<"user">> => #{}}, ensure_bot_ready_map(#{<<"user">> => #{}})
    ),
    ?assertEqual(#{<<"guilds">> => []}, ensure_bot_ready_map(not_a_map)),
    ok.

serialize_state_test() ->
    State = #{
        id => <<"session123">>,
        user_id => 12345,
        user_data => #{<<"username">> => <<"test">>},
        version => 9,
        seq => 10,
        ack_seq => 5,
        properties => #{},
        status => online,
        afk => false,
        mobile => false,
        buffer => [],
        ready => undefined,
        guilds => #{},
        collected_guild_states => [],
        collected_sessions => [],
        collected_presences => []
    },
    Serialized = serialize_state(State),
    ?assertEqual(<<"session123">>, maps:get(id, Serialized)),
    ?assertEqual(<<"12345">>, maps:get(user_id, Serialized)),
    ?assertEqual(10, maps:get(seq, Serialized)),
    ok.

handle_cast_forced_unavailable_guild_leave_schedules_retry_test() ->
    GuildId = 123,
    State0 = #{
        id => <<"session-force-unavailable">>,
        user_id => 1,
        user_data => #{},
        custom_status => null,
        version => 1,
        token_hash => <<>>,
        auth_session_id_hash => <<>>,
        buffer => [],
        seq => 0,
        ack_seq => 0,
        properties => #{},
        status => online,
        afk => false,
        mobile => false,
        presence_pid => undefined,
        presence_mref => undefined,
        socket_pid => undefined,
        socket_mref => undefined,
        guilds => #{GuildId => {self(), make_ref()}},
        calls => #{},
        channels => #{},
        ready => undefined,
        bot => false,
        ignored_events => #{},
        initial_guild_id => undefined,
        collected_guild_states => [],
        collected_sessions => [],
        collected_presences => [],
        relationships => #{},
        suppress_presence_updates => false,
        pending_presences => [],
        guild_connect_inflight => #{},
        voice_queue => queue:new(),
        voice_queue_timer => undefined,
        debounce_reactions => false,
        reaction_buffer => [],
        reaction_buffer_timer => undefined
    },
    {noreply, State1} = handle_cast({guild_leave, GuildId, forced_unavailable}, State0),
    Guilds = maps:get(guilds, State1),
    ?assertEqual(cached_unavailable, maps:get(GuildId, Guilds)),
    Buffer = maps:get(buffer, State1),
    ?assertEqual(1, length(Buffer)),
    [LastEvent] = Buffer,
    ?assertEqual(guild_delete, maps:get(event, LastEvent)),
    EventData = maps:get(data, LastEvent),
    ?assertEqual(true, maps:get(<<"unavailable">>, EventData)),
    receive
        {guild_connect, GuildId, 0} -> ok
    after 100 ->
        ?assert(false, forced_unavailable_retry_not_scheduled)
    end.

-endif.
