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

-module(session_dispatch).

-export([
    handle_dispatch/3,
    flush_all_pending_presences/1,
    flush_reaction_buffer/1
]).

-type session_state() :: session:session_state().
-type event() :: atom() | binary().
-type user_id() :: session:user_id().

-define(MAX_EVENT_BUFFER_SIZE, 4096).
-define(REACTION_BUFFER_INTERVAL_MS, 650).
-define(MAX_REACTION_BUFFER_SIZE, 512).
-define(MAX_PENDING_PRESENCE_BUFFER_SIZE, 2048).

-spec handle_dispatch(event(), map(), session_state()) -> {noreply, session_state()}.
handle_dispatch(Event, Data, State) ->
    case should_ignore_event(Event, State) of
        true ->
            {noreply, State};
        false ->
            case should_buffer_reaction(Event, State) of
                true ->
                    {noreply, buffer_reaction(Data, State)};
                false ->
                    case maybe_cancel_buffered_reaction(Event, Data, State) of
                        {cancelled, NewState} ->
                            {noreply, NewState};
                        not_applicable ->
                            case should_buffer_presence(Event, Data, State) of
                                true ->
                                    {noreply, buffer_presence(Event, Data, State)};
                                false ->
                                    FanoutSpanCtx = start_fanout_span(Event, State),
                                    Result = do_handle_dispatch(Event, Data, State),
                                    end_fanout_span(FanoutSpanCtx, Event),
                                    Result
                            end
                    end
            end
    end.

-spec do_handle_dispatch(event(), map(), session_state()) -> {noreply, session_state()}.
do_handle_dispatch(Event, Data, State) ->
    Seq = maps:get(seq, State),
    Buffer = maps:get(buffer, State),
    SocketPid = maps:get(socket_pid, State, undefined),
    NewSeq = Seq + 1,
    Request = #{event => Event, data => Data, seq => NewSeq},
    case append_or_fail(Buffer, Request, ?MAX_EVENT_BUFFER_SIZE, event_ack_buffer, State) of
        {ok, NewBuffer} ->
            send_to_socket(SocketPid, Event, Data, NewSeq),
            StateWithChannels = update_channels_map(Event, Data, State),
            StateWithRelationships = update_relationships_map(Event, Data, StateWithChannels),
            StateAfterMain = maps:merge(StateWithRelationships, #{seq => NewSeq, buffer => NewBuffer}),
            StateWithPending = maybe_flush_pending_presences(Event, Data, StateAfterMain),
            FinalState = sync_presence_targets(StateWithPending),
            {noreply, FinalState};
        overflow ->
            {noreply, State}
    end.

-spec send_to_socket(pid() | undefined, event(), map(), non_neg_integer()) -> ok.
send_to_socket(undefined, _Event, _Data, _Seq) ->
    ok;
send_to_socket(Pid, Event, Data, Seq) when is_pid(Pid) ->
    case erlang:is_process_alive(Pid) of
        true ->
            Pid ! {dispatch, Event, Data, Seq},
            ok;
        false ->
            ok,
            ok
    end.

-spec should_buffer_reaction(event(), session_state()) -> boolean().
should_buffer_reaction(message_reaction_add, State) ->
    maps:get(debounce_reactions, State, false);
should_buffer_reaction(_, _) ->
    false.

-spec buffer_reaction(map(), session_state()) -> session_state().
buffer_reaction(Data, State) ->
    Buffer = maps:get(reaction_buffer, State, []),
    case append_or_fail(Buffer, Data, ?MAX_REACTION_BUFFER_SIZE, reaction_buffer, State) of
        {ok, NewBuffer} ->
            Timer = maps:get(reaction_buffer_timer, State, undefined),
            NewTimer =
                case Timer of
                    undefined ->
                        erlang:send_after(?REACTION_BUFFER_INTERVAL_MS, self(), flush_reaction_buffer);
                    Existing ->
                        Existing
                end,
            State#{reaction_buffer => NewBuffer, reaction_buffer_timer => NewTimer};
        overflow ->
            State
    end.

-spec maybe_cancel_buffered_reaction(event(), map(), session_state()) ->
    {cancelled, session_state()} | not_applicable.
maybe_cancel_buffered_reaction(message_reaction_remove, Data, State) ->
    case maps:get(reaction_buffer, State, []) of
        [] ->
            not_applicable;
        Buffer ->
            MessageId = maps:get(<<"message_id">>, Data, undefined),
            UserId = maps:get(<<"user_id">>, Data, undefined),
            Emoji = maps:get(<<"emoji">>, Data, #{}),
            case remove_matching_reaction(Buffer, MessageId, UserId, Emoji) of
                {found, NewBuffer} ->
                    {cancelled, State#{reaction_buffer => NewBuffer}};
                not_found ->
                    not_applicable
            end
    end;
maybe_cancel_buffered_reaction(_, _, _) ->
    not_applicable.

-spec remove_matching_reaction([map()], term(), term(), map()) ->
    {found, [map()]} | not_found.
remove_matching_reaction(Buffer, MessageId, UserId, Emoji) ->
    EmojiId = maps:get(<<"id">>, Emoji, undefined),
    EmojiName = maps:get(<<"name">>, Emoji, undefined),
    remove_matching_reaction(Buffer, MessageId, UserId, EmojiId, EmojiName, []).

remove_matching_reaction([], _MessageId, _UserId, _EmojiId, _EmojiName, _Acc) ->
    not_found;
remove_matching_reaction([Entry | Rest], MessageId, UserId, EmojiId, EmojiName, Acc) ->
    EntryMessageId = maps:get(<<"message_id">>, Entry, undefined),
    EntryUserId = maps:get(<<"user_id">>, Entry, undefined),
    EntryEmoji = maps:get(<<"emoji">>, Entry, #{}),
    EntryEmojiId = maps:get(<<"id">>, EntryEmoji, undefined),
    EntryEmojiName = maps:get(<<"name">>, EntryEmoji, undefined),
    case
        EntryMessageId =:= MessageId andalso
            EntryUserId =:= UserId andalso
            EntryEmojiId =:= EmojiId andalso
            EntryEmojiName =:= EmojiName
    of
        true ->
            {found, lists:reverse(Acc) ++ Rest};
        false ->
            remove_matching_reaction(Rest, MessageId, UserId, EmojiId, EmojiName, [Entry | Acc])
    end.

-spec flush_reaction_buffer(session_state()) -> session_state().
flush_reaction_buffer(State) ->
    Buffer = maps:get(reaction_buffer, State, []),
    Timer = maps:get(reaction_buffer_timer, State, undefined),
    case Timer of
        undefined -> ok;
        _ -> erlang:cancel_timer(Timer)
    end,
    StateCleared = State#{reaction_buffer => [], reaction_buffer_timer => undefined},
    case Buffer of
        [] ->
            StateCleared;
        [Single] ->
            {noreply, FinalState} = do_handle_dispatch(message_reaction_add, Single, StateCleared),
            FinalState;
        _ ->
            dispatch_reaction_add_many(Buffer, StateCleared)
    end.

-spec dispatch_reaction_add_many([map()], session_state()) -> session_state().
dispatch_reaction_add_many(Buffer, State) ->
    First = hd(Buffer),
    ChannelId = maps:get(<<"channel_id">>, First, undefined),
    MessageId = maps:get(<<"message_id">>, First, undefined),
    GuildId = maps:get(<<"guild_id">>, First, undefined),
    Reactions = lists:map(
        fun(Entry) ->
            Base = #{
                <<"user_id">> => maps:get(<<"user_id">>, Entry, undefined),
                <<"emoji">> => maps:get(<<"emoji">>, Entry, #{})
            },
            case maps:get(<<"member">>, Entry, undefined) of
                undefined -> Base;
                null -> Base;
                Member -> Base#{<<"member">> => Member}
            end
        end,
        Buffer
    ),
    Data0 = #{
        <<"channel_id">> => ChannelId,
        <<"message_id">> => MessageId,
        <<"reactions">> => Reactions
    },
    Data = case GuildId of
        undefined -> Data0;
        null -> Data0;
        _ -> Data0#{<<"guild_id">> => GuildId}
    end,
    {noreply, FinalState} = do_handle_dispatch(message_reaction_add_many, Data, State),
    FinalState.

-spec should_buffer_presence(event(), map(), session_state()) -> boolean().
should_buffer_presence(presence_update, Data, State) ->
    case maps:get(suppress_presence_updates, State, true) of
        true ->
            true;
        false ->
            HasGuildId =
                is_map(Data) andalso (maps:get(<<"guild_id">>, Data, undefined) =/= undefined),
            case HasGuildId of
                true ->
                    false;
                false ->
                    UserId = presence_user_id(Data),
                    Relationships = maps:get(relationships, State, #{}),
                    case UserId of
                        undefined ->
                            false;
                        _ ->
                            IsRelationship = relationship_allows_presence(UserId, Relationships),
                            IsGroupDmRecipient = is_group_dm_recipient(UserId, State),
                            not (IsRelationship orelse IsGroupDmRecipient)
                    end
            end
    end;
should_buffer_presence(_, _, _) ->
    false.

-spec relationship_allows_presence(user_id(), #{user_id() => integer()}) -> boolean().
relationship_allows_presence(UserId, Relationships) when
    is_integer(UserId), is_map(Relationships)
->
    case maps:get(UserId, Relationships, 0) of
        1 -> true;
        3 -> true;
        _ -> false
    end;
relationship_allows_presence(_, _) ->
    false.

-spec is_group_dm_recipient(user_id(), session_state()) -> boolean().
is_group_dm_recipient(UserId, State) ->
    GroupDmRecipients = presence_targets:group_dm_recipients_from_state(State),
    lists:any(
        fun({_ChannelId, Recipients}) ->
            maps:is_key(UserId, Recipients)
        end,
        maps:to_list(GroupDmRecipients)
    ).

-spec buffer_presence(event(), map(), session_state()) -> session_state().
buffer_presence(Event, Data, State) ->
    Pending = maps:get(pending_presences, State, []),
    UserId = presence_user_id(Data),
    case
        append_or_fail(
            Pending,
            #{event => Event, data => Data, user_id => UserId},
            ?MAX_PENDING_PRESENCE_BUFFER_SIZE,
            pending_presence_buffer,
            State
        )
    of
        {ok, NewPending} ->
            maps:put(
                pending_presences,
                NewPending,
                State
            );
        overflow ->
            State
    end.

-spec maybe_flush_pending_presences(event(), map(), session_state()) -> session_state().
maybe_flush_pending_presences(relationship_add, Data, State) ->
    maybe_flush_relationship_pending_presences(Data, State);
maybe_flush_pending_presences(relationship_update, Data, State) ->
    maybe_flush_relationship_pending_presences(Data, State);
maybe_flush_pending_presences(_, _, State) ->
    State.

-spec maybe_flush_relationship_pending_presences(map(), session_state()) -> session_state().
maybe_flush_relationship_pending_presences(Data, State) ->
    case maps:get(<<"type">>, Data, 0) of
        1 -> flush_pending_presences(relationship_target_id(Data), State);
        3 -> flush_pending_presences(relationship_target_id(Data), State);
        _ -> State
    end.

-spec flush_pending_presences(user_id() | undefined, session_state()) -> session_state().
flush_pending_presences(undefined, State) ->
    State;
flush_pending_presences(UserId, State) ->
    Pending = maps:get(pending_presences, State, []),
    {ToSend, Remaining} = lists:partition(
        fun(P) -> maps:get(user_id, P, undefined) =:= UserId end,
        Pending
    ),
    FlushedState = lists:foldl(
        fun(P, AccState) -> dispatch_presence_now(P, AccState) end, State, ToSend
    ),
    maps:put(pending_presences, Remaining, FlushedState).

-spec dispatch_presence_now(map(), session_state()) -> session_state().
dispatch_presence_now(P, State) ->
    Event = maps:get(event, P),
    Data = maps:get(data, P),
    Seq = maps:get(seq, State),
    Buffer = maps:get(buffer, State),
    SocketPid = maps:get(socket_pid, State, undefined),
    NewSeq = Seq + 1,
    Request = #{event => Event, data => Data, seq => NewSeq},
    case append_or_fail(Buffer, Request, ?MAX_EVENT_BUFFER_SIZE, event_ack_buffer, State) of
        {ok, NewBuffer} ->
            send_to_socket(SocketPid, Event, Data, NewSeq),
            maps:merge(State, #{seq => NewSeq, buffer => NewBuffer});
        overflow ->
            State
    end.

-spec append_or_fail([term()], term(), pos_integer(), atom(), session_state()) ->
    {ok, [term()]} | overflow.
append_or_fail(Buffer, Entry, MaxSize, BufferKind, State) ->
    case length(Buffer) >= MaxSize of
        true ->
            report_buffer_overflow(BufferKind, length(Buffer), MaxSize, State),
            overflow;
        false ->
            {ok, Buffer ++ [Entry]}
    end.

-spec report_buffer_overflow(atom(), non_neg_integer(), pos_integer(), session_state()) -> ok.
report_buffer_overflow(BufferKind, CurrentSize, MaxSize, State) ->
    AckSeq = maps:get(ack_seq, State, 0),
    Seq = maps:get(seq, State, 0),
    UnackedEvents = max(0, Seq - AckSeq),
    KindBin = buffer_kind_to_binary(BufferKind),
    SocketPid = maps:get(socket_pid, State, undefined),
    Details = #{
        kind => KindBin,
        current_size => CurrentSize,
        limit => MaxSize,
        seq => Seq,
        ack_seq => AckSeq,
        unacked_events => UnackedEvents
    },
    logger:warning(
        "Session backpressure overflow. kind=~ts current=~B limit=~B seq=~B ack_seq=~B unacked=~B",
        [KindBin, CurrentSize, MaxSize, Seq, AckSeq, UnackedEvents]
    ),
    otel_metrics:counter(<<"gateway.session.backpressure_overflow">>, 1, #{<<"kind">> => KindBin}),
    otel_metrics:gauge(<<"gateway.session.unacked_events">>, UnackedEvents, #{<<"kind">> => KindBin}),
    case SocketPid of
        Pid when is_pid(Pid) ->
            Pid ! {session_backpressure_error, Details};
        _ ->
            ok
    end,
    gen_server:cast(self(), {terminate_force}),
    ok.

-spec buffer_kind_to_binary(atom()) -> binary().
buffer_kind_to_binary(event_ack_buffer) -> <<"event_ack_buffer">>;
buffer_kind_to_binary(reaction_buffer) -> <<"reaction_buffer">>;
buffer_kind_to_binary(pending_presence_buffer) -> <<"pending_presence_buffer">>.

-spec presence_user_id(map()) -> user_id() | undefined.
presence_user_id(Data) ->
    case maps:find(<<"user">>, Data) of
        {ok, User} when is_map(User) ->
            map_utils:get_integer(User, <<"id">>, undefined);
        _ ->
            undefined
    end.

-spec relationship_target_id(map()) -> user_id() | undefined.
relationship_target_id(Data) when is_map(Data) ->
    type_conv:extract_id(Data, <<"id">>).

-spec flush_all_pending_presences(session_state()) -> session_state().
flush_all_pending_presences(State) ->
    Pending = maps:get(pending_presences, State, []),
    FlushedState = lists:foldl(
        fun(P, AccState) -> dispatch_presence_now(P, AccState) end, State, Pending
    ),
    maps:put(pending_presences, [], FlushedState).

-spec should_ignore_event(event(), session_state()) -> boolean().
should_ignore_event(Event, State) ->
    IgnoredEvents = maps:get(ignored_events, State, #{}),
    case event_name(Event) of
        undefined -> false;
        EventName -> maps:is_key(EventName, IgnoredEvents)
    end.

-spec event_name(event()) -> binary() | undefined.
event_name(Event) when is_binary(Event) ->
    Event;
event_name(Event) when is_atom(Event) ->
    try constants:dispatch_event_atom(Event) of
        Name when is_binary(Name) -> Name
    catch
        _:_ -> undefined
    end;
event_name(_) ->
    undefined.

-spec update_channels_map(event(), map(), session_state()) -> session_state().
update_channels_map(channel_create, Data, State) when is_map(Data) ->
    case maps:get(<<"type">>, Data, undefined) of
        1 -> add_channel_to_state(Data, State);
        3 -> add_channel_to_state(Data, State);
        _ -> State
    end;
update_channels_map(channel_update, Data, State) when is_map(Data) ->
    case maps:get(<<"type">>, Data, undefined) of
        1 -> add_channel_to_state(Data, State);
        3 -> add_channel_to_state(Data, State);
        _ -> State
    end;
update_channels_map(channel_delete, Data, State) when is_map(Data) ->
    case maps:get(<<"id">>, Data, undefined) of
        undefined ->
            State;
        ChannelIdBin ->
            case validation:validate_snowflake(<<"id">>, ChannelIdBin) of
                {ok, ChannelId} ->
                    Channels = maps:get(channels, State, #{}),
                    NewChannels = maps:remove(ChannelId, Channels),
                    maps:put(channels, NewChannels, State);
                {error, _, _} ->
                    State
            end
    end;
update_channels_map(channel_recipient_add, Data, State) when is_map(Data) ->
    update_recipient_membership(add, Data, State);
update_channels_map(channel_recipient_remove, Data, State) when is_map(Data) ->
    update_recipient_membership(remove, Data, State);
update_channels_map(_Event, _Data, State) ->
    State.

-spec add_channel_to_state(map(), session_state()) -> session_state().
add_channel_to_state(Data, State) ->
    case maps:get(<<"id">>, Data, undefined) of
        undefined ->
            State;
        ChannelIdBin ->
            case validation:validate_snowflake(<<"id">>, ChannelIdBin) of
                {ok, ChannelId} ->
                    Channels = maps:get(channels, State, #{}),
                    NewChannels = maps:put(ChannelId, Data, Channels),
                    maps:put(channels, NewChannels, State);
                {error, _, _} ->
                    State
            end
    end.

-spec update_recipient_membership(add | remove, map(), session_state()) -> session_state().
update_recipient_membership(Action, Data, State) ->
    ChannelIdBin = maps:get(<<"channel_id">>, Data, undefined),
    case validation:validate_snowflake(<<"channel_id">>, ChannelIdBin) of
        {ok, ChannelId} ->
            Channels = maps:get(channels, State, #{}),
            case maps:get(ChannelId, Channels, undefined) of
                undefined ->
                    State;
                Channel ->
                    case maps:get(<<"type">>, Channel, 0) of
                        3 ->
                            UserMap = maps:get(<<"user">>, Data, #{}),
                            RecipientId = type_conv:extract_id(UserMap, <<"id">>),
                            case RecipientId of
                                undefined ->
                                    State;
                                _ ->
                                    UpdatedChannel = update_channel_recipient(
                                        Channel, RecipientId, UserMap, Action
                                    ),
                                    NewChannels = maps:put(ChannelId, UpdatedChannel, Channels),
                                    maps:put(channels, NewChannels, State)
                            end;
                        _ ->
                            State
                    end
            end;
        _ ->
            State
    end.

-spec update_channel_recipient(map(), user_id(), map(), add | remove) -> map().
update_channel_recipient(Channel, RecipientId, UserMap, add) ->
    RecipientIds = maps:get(<<"recipient_ids">>, Channel, []),
    Recipients = maps:get(<<"recipients">>, Channel, []),
    NewRecipientIds = add_unique_id(RecipientId, RecipientIds),
    NewRecipients = add_unique_user(UserMap, Recipients),
    Channel#{<<"recipient_ids">> => NewRecipientIds, <<"recipients">> => NewRecipients};
update_channel_recipient(Channel, RecipientId, _UserMap, remove) ->
    RecipientIds = maps:get(<<"recipient_ids">>, Channel, []),
    Recipients = maps:get(<<"recipients">>, Channel, []),
    NewRecipientIds = lists:filter(
        fun(Id) -> Id =/= integer_to_binary(RecipientId) andalso Id =/= RecipientId end,
        RecipientIds
    ),
    NewRecipients = lists:filter(
        fun(R) ->
            case type_conv:extract_id(R, <<"id">>) of
                RecipientId -> false;
                _ -> true
            end
        end,
        Recipients
    ),
    Channel#{<<"recipient_ids">> => NewRecipientIds, <<"recipients">> => NewRecipients}.

-spec add_unique_id(user_id(), [binary() | user_id()]) -> [binary() | user_id()].
add_unique_id(Id, List) ->
    case lists:member(Id, List) orelse lists:member(integer_to_binary(Id), List) of
        true -> List;
        false -> [Id | List]
    end.

-spec add_unique_user(map(), [map()]) -> [map()].
add_unique_user(UserMap, List) when is_map(UserMap) ->
    case type_conv:extract_id(UserMap, <<"id">>) of
        undefined ->
            List;
        Id ->
            case lists:any(fun(R) -> type_conv:extract_id(R, <<"id">>) =:= Id end, List) of
                true -> List;
                false -> [UserMap | List]
            end
    end.

-spec update_relationships_map(event(), map(), session_state()) -> session_state().
update_relationships_map(relationship_add, Data, State) ->
    upsert_relationship(Data, State);
update_relationships_map(relationship_update, Data, State) ->
    upsert_relationship(Data, State);
update_relationships_map(relationship_remove, Data, State) ->
    case type_conv:extract_id(Data, <<"id">>) of
        undefined ->
            State;
        UserId ->
            Relationships = maps:get(relationships, State, #{}),
            NewRelationships = maps:remove(UserId, Relationships),
            maps:put(relationships, NewRelationships, State)
    end;
update_relationships_map(_, _, State) ->
    State.

-spec upsert_relationship(map(), session_state()) -> session_state().
upsert_relationship(Data, State) ->
    case type_conv:extract_id(Data, <<"id">>) of
        undefined ->
            State;
        UserId ->
            Type = maps:get(<<"type">>, Data, 0),
            Relationships = maps:get(relationships, State, #{}),
            NewRelationships = maps:put(UserId, Type, Relationships),
            maps:put(relationships, NewRelationships, State)
    end.

-spec sync_presence_targets(session_state()) -> session_state().
sync_presence_targets(State) ->
    PresencePid = maps:get(presence_pid, State, undefined),
    case PresencePid of
        undefined ->
            State;
        Pid when is_pid(Pid) ->
            FriendIds = presence_targets:friend_ids_from_state(State),
            GroupRecipients = presence_targets:group_dm_recipients_from_state(State),
            gen_server:cast(Pid, {sync_friends, FriendIds}),
            gen_server:cast(Pid, {sync_group_dm_recipients, GroupRecipients}),
            State
    end.

-spec start_fanout_span(event(), session_state()) -> {term(), term()} | undefined.
start_fanout_span(Event, State) ->
    case event_name(Event) of
        undefined ->
            undefined;
        EventName ->
            SpanName = websocket_fanout,
            Attributes = build_fanout_attributes(EventName, State),
            gateway_tracing:start_event_span(?MODULE, SpanName, Attributes)
    end.

-spec end_fanout_span({term(), term()} | undefined, event()) -> ok.
end_fanout_span(Context, Event) ->
    EventName = event_name(Event),
    Attributes = #{<<"event.name">> => EventName},
    Outcome = gateway_tracing:end_event_span(Context, Attributes),
    end_fanout_metrics(Outcome),
    ok.

build_fanout_attributes(EventName, State) ->
    case maps:get(user_id, State, undefined) of
        undefined -> #{<<"event.name">> => EventName};
        UserId -> #{<<"event.name">> => EventName, <<"user.id">> => UserId}
    end.

-ifdef(HAS_OPENTELEMETRY).
end_fanout_metrics(Outcome) ->
    case Outcome of
        ok -> gateway_metrics_collector:inc_fanout(1);
        _ -> gateway_metrics_collector:inc_fanout(0)
    end.
-else.
end_fanout_metrics(_Outcome) ->
    gateway_metrics_collector:inc_fanout(1).
-endif.

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").

base_state_for_presence_buffer_test(Opts) ->
    maps:merge(
        #{
            seq => 0,
            user_id => 1,
            buffer => [],
            socket_pid => undefined,
            channels => #{},
            relationships => #{},
            suppress_presence_updates => false,
            pending_presences => [],
            presence_pid => undefined,
            ignored_events => #{}
        },
        Opts
    ).

presence_update_with_guild_id_not_buffered_test() ->
    State0 = base_state_for_presence_buffer_test(#{}),
    Presence = #{
        <<"guild_id">> => <<"123">>,
        <<"user">> => #{<<"id">> => <<"2">>},
        <<"status">> => <<"idle">>
    },
    {noreply, State1} = handle_dispatch(presence_update, Presence, State0),
    ?assertEqual([], maps:get(pending_presences, State1, [])),
    ?assertEqual(1, length(maps:get(buffer, State1, []))),
    ok.

presence_update_without_guild_id_buffered_for_non_relationship_test() ->
    State0 = base_state_for_presence_buffer_test(#{}),
    Presence = #{
        <<"user">> => #{<<"id">> => <<"2">>},
        <<"status">> => <<"online">>
    },
    {noreply, State1} = handle_dispatch(presence_update, Presence, State0),
    ?assertEqual(1, length(maps:get(pending_presences, State1, []))),
    ?assertEqual([], maps:get(buffer, State1, [])),
    ok.

presence_update_without_guild_id_not_buffered_for_relationship_test() ->
    State0 = base_state_for_presence_buffer_test(#{relationships => #{2 => 1}}),
    Presence = #{
        <<"user">> => #{<<"id">> => <<"2">>},
        <<"status">> => <<"online">>
    },
    {noreply, State1} = handle_dispatch(presence_update, Presence, State0),
    ?assertEqual([], maps:get(pending_presences, State1, [])),
    ?assertEqual(1, length(maps:get(buffer, State1, []))),
    ok.

presence_update_without_guild_id_buffered_for_outgoing_request_relationship_test() ->
    State0 = base_state_for_presence_buffer_test(#{relationships => #{2 => 4}}),
    Presence = #{
        <<"user">> => #{<<"id">> => <<"2">>},
        <<"status">> => <<"online">>
    },
    {noreply, State1} = handle_dispatch(presence_update, Presence, State0),
    ?assertEqual(1, length(maps:get(pending_presences, State1, []))),
    ?assertEqual([], maps:get(buffer, State1, [])),
    ok.

presence_update_without_guild_id_not_buffered_for_incoming_request_relationship_test() ->
    State0 = base_state_for_presence_buffer_test(#{relationships => #{2 => 3}}),
    Presence = #{
        <<"user">> => #{<<"id">> => <<"2">>},
        <<"status">> => <<"online">>
    },
    {noreply, State1} = handle_dispatch(presence_update, Presence, State0),
    ?assertEqual([], maps:get(pending_presences, State1, [])),
    ?assertEqual(1, length(maps:get(buffer, State1, []))),
    ok.

relationship_allows_presence_test() ->
    ?assertEqual(true, relationship_allows_presence(1, #{1 => 1})),
    ?assertEqual(true, relationship_allows_presence(1, #{1 => 3})),
    ?assertEqual(false, relationship_allows_presence(1, #{1 => 0})),
    ?assertEqual(false, relationship_allows_presence(1, #{1 => 2})),
    ?assertEqual(false, relationship_allows_presence(1, #{1 => 4})),
    ?assertEqual(false, relationship_allows_presence(1, #{})),
    ?assertEqual(false, relationship_allows_presence(not_integer, #{})),
    ok.

presence_user_id_test() ->
    ?assertEqual(123, presence_user_id(#{<<"user">> => #{<<"id">> => <<"123">>}})),
    ?assertEqual(undefined, presence_user_id(#{<<"user">> => #{}})),
    ?assertEqual(undefined, presence_user_id(#{})),
    ?assertEqual(undefined, presence_user_id(#{<<"user">> => not_a_map})),
    ok.

add_unique_id_test() ->
    ?assertEqual([1, 2, 3], add_unique_id(1, [2, 3])),
    ?assertEqual([1, 2, 3], add_unique_id(1, [1, 2, 3])),
    ?assertEqual([<<"1">>, 2, 3], add_unique_id(1, [<<"1">>, 2, 3])),
    ok.

-endif.
