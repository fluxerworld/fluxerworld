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

-module(voice_state_utils).

-include_lib("fluxer_gateway/include/voice_state.hrl").

-export([
    voice_states/1,
    ensure_voice_states/1,
    voice_state_user_id/1,
    voice_state_channel_id/1,
    voice_state_guild_id/1,
    filter_voice_states/2,
    drop_voice_states/2,
    broadcast_disconnects/2,
    voice_flags_from_context/1,
    parse_stream_key/1,
    build_stream_key/3
]).

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").
-endif.

-type voice_state() :: map().
-type voice_state_map() :: #{binary() => voice_state()}.
-type guild_state() :: map().
-type stream_key_result() :: #{
    scope := guild | dm,
    guild_id := integer() | undefined,
    channel_id := integer(),
    connection_id := binary()
}.

-spec voice_states(guild_state()) -> voice_state_map().
voice_states(State) when is_map(State) ->
    case maps:get(voice_states, State, undefined) of
        Map when is_map(Map) -> Map;
        _ -> #{}
    end.

-spec ensure_voice_states(term()) -> voice_state_map().
ensure_voice_states(Map) when is_map(Map) ->
    Map;
ensure_voice_states(_) ->
    #{}.

-spec voice_state_user_id(voice_state()) -> integer() | undefined.
voice_state_user_id(VoiceState) ->
    map_utils:get_integer(VoiceState, <<"user_id">>, undefined).

-spec voice_state_channel_id(voice_state()) -> integer() | undefined.
voice_state_channel_id(VoiceState) ->
    map_utils:get_integer(VoiceState, <<"channel_id">>, undefined).

-spec voice_state_guild_id(voice_state()) -> integer() | undefined.
voice_state_guild_id(VoiceState) ->
    map_utils:get_integer(VoiceState, <<"guild_id">>, undefined).

-spec filter_voice_states(voice_state_map(), fun((binary(), voice_state()) -> boolean())) ->
    voice_state_map().
filter_voice_states(VoiceStates, Predicate) when is_map(VoiceStates) ->
    maps:filter(Predicate, VoiceStates);
filter_voice_states(_, _) ->
    #{}.

-spec drop_voice_states(voice_state_map(), voice_state_map()) -> voice_state_map().
drop_voice_states(ToDrop, VoiceStates) ->
    maps:fold(fun(ConnId, _VoiceState, Acc) -> maps:remove(ConnId, Acc) end, VoiceStates, ToDrop).

-spec broadcast_disconnects(voice_state_map(), guild_state()) -> ok.
broadcast_disconnects(VoiceStates, State) ->
    spawn(fun() ->
        maps:foreach(
            fun(ConnId, VoiceState) ->
                OldChannelIdBin = maps:get(<<"channel_id">>, VoiceState, null),
                DisconnectVoiceState = VoiceState#{
                    <<"channel_id">> => null,
                    <<"connection_id">> => ConnId
                },
                guild_voice_broadcast:broadcast_voice_state_update(
                    DisconnectVoiceState, State, OldChannelIdBin
                )
            end,
            VoiceStates
        )
    end),
    ok.

-spec voice_flags_from_context(map()) -> voice_flags().
voice_flags_from_context(Context) ->
    #{
        self_mute => maps:get(self_mute, Context, false),
        self_deaf => maps:get(self_deaf, Context, false),
        self_video => maps:get(self_video, Context, false),
        self_stream => maps:get(self_stream, Context, false),
        is_mobile => maps:get(is_mobile, Context, false)
    }.

-spec parse_stream_key(term()) -> {ok, stream_key_result()} | {error, invalid_stream_key}.
parse_stream_key(StreamKey) when is_binary(StreamKey) ->
    Parts = binary:split(StreamKey, <<":">>, [global]),
    case Parts of
        [ScopeBin, ChannelBin, ConnId] when byte_size(ChannelBin) > 0, byte_size(ConnId) > 0 ->
            try
                Scope = parse_scope_bin(ScopeBin),
                ChannelId = parse_channel_bin(ChannelBin),
                build_stream_key_result(Scope, ChannelId, ConnId)
            catch
                _:_ ->
                    {error, invalid_stream_key}
            end;
        _ ->
            {error, invalid_stream_key}
    end;
parse_stream_key(_) ->
    {error, invalid_stream_key}.

-spec parse_scope_bin(binary()) -> {dm, undefined} | {guild, integer()}.
parse_scope_bin(<<"dm">>) ->
    {dm, undefined};
parse_scope_bin(ScopeBin) ->
    GuildId = type_conv:to_integer(ScopeBin),
    true = is_integer(GuildId),
    {guild, GuildId}.

-spec parse_channel_bin(binary()) -> integer().
parse_channel_bin(ChannelBin) ->
    Chan = type_conv:to_integer(ChannelBin),
    true = is_integer(Chan),
    Chan.

-spec build_stream_key_result({dm, undefined} | {guild, integer()}, integer(), binary()) ->
    {ok, stream_key_result()}.
build_stream_key_result({dm, _}, ChannelId, ConnId) ->
    {ok, #{
        scope => dm,
        guild_id => undefined,
        channel_id => ChannelId,
        connection_id => ConnId
    }};
build_stream_key_result({guild, GuildId}, ChannelId, ConnId) ->
    {ok, #{
        scope => guild,
        guild_id => GuildId,
        channel_id => ChannelId,
        connection_id => ConnId
    }}.

-spec build_stream_key(integer() | undefined, integer(), binary()) -> binary().
build_stream_key(undefined, ChannelId, ConnectionId) when
    is_integer(ChannelId), is_binary(ConnectionId)
->
    <<"dm:", (integer_to_binary(ChannelId))/binary, ":", ConnectionId/binary>>;
build_stream_key(GuildId, ChannelId, ConnectionId) when
    is_integer(GuildId), is_integer(ChannelId), is_binary(ConnectionId)
->
    <<
        (integer_to_binary(GuildId))/binary,
        ":",
        (integer_to_binary(ChannelId))/binary,
        ":",
        ConnectionId/binary
    >>.

-ifdef(TEST).

voice_states_returns_map_test() ->
    State = #{voice_states => #{<<"a">> => #{}}},
    ?assertEqual(#{<<"a">> => #{}}, voice_states(State)),
    ?assertEqual(#{}, voice_states(#{})),
    ?assertEqual(#{}, voice_states(#{voice_states => not_a_map})).

ensure_voice_states_test() ->
    ?assertEqual(#{<<"a">> => 1}, ensure_voice_states(#{<<"a">> => 1})),
    ?assertEqual(#{}, ensure_voice_states(not_a_map)).

voice_state_user_id_test() ->
    ?assertEqual(123, voice_state_user_id(#{<<"user_id">> => <<"123">>})),
    ?assertEqual(undefined, voice_state_user_id(#{})).

voice_state_channel_id_test() ->
    ?assertEqual(456, voice_state_channel_id(#{<<"channel_id">> => <<"456">>})),
    ?assertEqual(undefined, voice_state_channel_id(#{})).

voice_state_guild_id_test() ->
    ?assertEqual(789, voice_state_guild_id(#{<<"guild_id">> => <<"789">>})),
    ?assertEqual(undefined, voice_state_guild_id(#{})).

filter_voice_states_test() ->
    VoiceStates = #{
        <<"a">> => #{<<"user_id">> => <<"1">>},
        <<"b">> => #{<<"user_id">> => <<"2">>}
    },
    Filtered = filter_voice_states(VoiceStates, fun(_, V) ->
        maps:get(<<"user_id">>, V) =:= <<"1">>
    end),
    ?assertEqual(#{<<"a">> => #{<<"user_id">> => <<"1">>}}, Filtered).

drop_voice_states_test() ->
    VoiceStates = #{<<"a">> => #{}, <<"b">> => #{}, <<"c">> => #{}},
    ToDrop = #{<<"a">> => #{}, <<"c">> => #{}},
    Result = drop_voice_states(ToDrop, VoiceStates),
    ?assertEqual(#{<<"b">> => #{}}, Result).

voice_flags_from_context_test() ->
    Context = #{
        self_mute => true,
        self_deaf => false,
        self_video => true,
        self_stream => false,
        is_mobile => true
    },
    Flags = voice_flags_from_context(Context),
    ?assertEqual(true, maps:get(self_mute, Flags)),
    ?assertEqual(false, maps:get(self_deaf, Flags)),
    ?assertEqual(true, maps:get(self_video, Flags)),
    ?assertEqual(false, maps:get(self_stream, Flags)),
    ?assertEqual(true, maps:get(is_mobile, Flags)).

parse_stream_key_dm_test() ->
    Result = parse_stream_key(<<"dm:123:conn-id">>),
    ?assertMatch({ok, #{scope := dm, channel_id := 123, connection_id := <<"conn-id">>}}, Result).

parse_stream_key_guild_test() ->
    Result = parse_stream_key(<<"999:123:conn-id">>),
    ?assertMatch(
        {ok, #{scope := guild, guild_id := 999, channel_id := 123, connection_id := <<"conn-id">>}},
        Result
    ).

parse_stream_key_invalid_test() ->
    ?assertEqual({error, invalid_stream_key}, parse_stream_key(<<"invalid">>)),
    ?assertEqual({error, invalid_stream_key}, parse_stream_key(<<"a:b">>)),
    ?assertEqual({error, invalid_stream_key}, parse_stream_key(123)).

build_stream_key_dm_test() ->
    Result = build_stream_key(undefined, 123, <<"conn">>),
    ?assertEqual(<<"dm:123:conn">>, Result).

build_stream_key_guild_test() ->
    Result = build_stream_key(999, 123, <<"conn">>),
    ?assertEqual(<<"999:123:conn">>, Result).

-endif.
