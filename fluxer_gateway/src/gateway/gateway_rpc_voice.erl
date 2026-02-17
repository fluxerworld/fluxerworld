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

-module(gateway_rpc_voice).

-export([execute_method/2]).

-spec execute_method(binary(), map()) -> term().
execute_method(<<"voice.confirm_connection">>, Params) ->
    ChannelIdBin = maps:get(<<"channel_id">>, Params),
    ConnectionId = maps:get(<<"connection_id">>, Params),
    case parse_optional_guild_id(Params) of
        undefined ->
            gateway_rpc_call:execute_method(
                <<"call.confirm_connection">>,
                #{
                    <<"channel_id">> => ChannelIdBin,
                    <<"connection_id">> => ConnectionId
                }
            );
        GuildId ->
            TokenNonce = maps:get(<<"token_nonce">>, Params, undefined),
            gateway_rpc_guild:execute_method(
                <<"guild.confirm_voice_connection_from_livekit">>,
                #{
                    <<"guild_id">> => integer_to_binary(GuildId),
                    <<"connection_id">> => ConnectionId,
                    <<"token_nonce">> => TokenNonce
                }
            )
    end;
execute_method(<<"voice.disconnect_user_if_in_channel">>, Params) ->
    ChannelIdBin = maps:get(<<"channel_id">>, Params),
    UserIdBin = maps:get(<<"user_id">>, Params),
    ConnectionId = maps:get(<<"connection_id">>, Params, undefined),
    case parse_optional_guild_id(Params) of
        undefined ->
            CallParams = #{
                <<"channel_id">> => ChannelIdBin,
                <<"user_id">> => UserIdBin
            },
            gateway_rpc_call:execute_method(
                <<"call.disconnect_user_if_in_channel">>,
                maybe_put_connection_id(ConnectionId, CallParams)
            );
        GuildId ->
            GuildParams = #{
                <<"guild_id">> => integer_to_binary(GuildId),
                <<"user_id">> => UserIdBin,
                <<"expected_channel_id">> => ChannelIdBin
            },
            gateway_rpc_guild:execute_method(
                <<"guild.disconnect_voice_user_if_in_channel">>,
                maybe_put_connection_id(ConnectionId, GuildParams)
            )
    end;
execute_method(<<"voice.get_voice_states_for_channel">>, Params) ->
    ChannelIdBin = maps:get(<<"channel_id">>, Params),
    case parse_optional_guild_id(Params) of
        undefined ->
            build_dm_voice_states_response(ChannelIdBin);
        GuildId ->
            gateway_rpc_guild:execute_method(
                <<"guild.get_voice_states_for_channel">>,
                #{
                    <<"guild_id">> => integer_to_binary(GuildId),
                    <<"channel_id">> => ChannelIdBin
                }
            )
    end;
execute_method(<<"voice.get_pending_joins_for_channel">>, Params) ->
    ChannelIdBin = maps:get(<<"channel_id">>, Params),
    case parse_optional_guild_id(Params) of
        undefined ->
            normalize_pending_joins_response(
                gateway_rpc_call:execute_method(
                    <<"call.get_pending_joins">>,
                    #{<<"channel_id">> => ChannelIdBin}
                )
            );
        GuildId ->
            gateway_rpc_guild:execute_method(
                <<"guild.get_pending_joins_for_channel">>,
                #{
                    <<"guild_id">> => integer_to_binary(GuildId),
                    <<"channel_id">> => ChannelIdBin
                }
            )
    end;
execute_method(Method, _Params) ->
    throw({error, <<"Unknown method: ", Method/binary>>}).

-spec parse_optional_guild_id(map()) -> integer() | undefined.
parse_optional_guild_id(Params) ->
    case maps:get(<<"guild_id">>, Params, undefined) of
        undefined ->
            undefined;
        null ->
            undefined;
        GuildIdBin ->
            validation:snowflake_or_throw(<<"guild_id">>, GuildIdBin)
    end.

-spec maybe_put_connection_id(binary() | undefined, map()) -> map().
maybe_put_connection_id(undefined, Params) ->
    Params;
maybe_put_connection_id(ConnectionId, Params) ->
    Params#{<<"connection_id">> => ConnectionId}.

-spec build_dm_voice_states_response(binary()) -> map().
build_dm_voice_states_response(ChannelIdBin) ->
    case gateway_rpc_call:execute_method(<<"call.get">>, #{<<"channel_id">> => ChannelIdBin}) of
        null ->
            #{<<"voice_states">> => []};
        CallData when is_map(CallData) ->
            VoiceStates = get_map_value(CallData, [<<"voice_states">>, voice_states]),
            #{<<"voice_states">> => normalize_voice_states(VoiceStates)}
    end.

-spec normalize_voice_states(term()) -> [map()].
normalize_voice_states(VoiceStates) when is_list(VoiceStates) ->
    lists:reverse(
        lists:foldl(fun normalize_voice_state_entry/2, [], VoiceStates)
    );
normalize_voice_states(_) ->
    [].

-spec normalize_voice_state_entry(map(), [map()]) -> [map()].
normalize_voice_state_entry(VoiceState, Acc) ->
    ConnectionId = normalize_id(get_map_value(VoiceState, [<<"connection_id">>, connection_id])),
    UserId = normalize_id(get_map_value(VoiceState, [<<"user_id">>, user_id])),
    ChannelId = normalize_id(get_map_value(VoiceState, [<<"channel_id">>, channel_id])),
    case {ConnectionId, UserId, ChannelId} of
        {undefined, _, _} ->
            Acc;
        {_, undefined, _} ->
            Acc;
        {_, _, undefined} ->
            Acc;
        _ ->
            [#{
                <<"connection_id">> => ConnectionId,
                <<"user_id">> => UserId,
                <<"channel_id">> => ChannelId
            } | Acc]
    end.

-spec normalize_pending_joins_response(term()) -> map().
normalize_pending_joins_response(Response) when is_map(Response) ->
    PendingJoins = get_map_value(Response, [<<"pending_joins">>, pending_joins]),
    #{<<"pending_joins">> => normalize_pending_joins(PendingJoins)};
normalize_pending_joins_response(_) ->
    #{<<"pending_joins">> => []}.

-spec normalize_pending_joins(term()) -> [map()].
normalize_pending_joins(PendingJoins) when is_list(PendingJoins) ->
    lists:reverse(
        lists:foldl(fun normalize_pending_join_entry/2, [], PendingJoins)
    );
normalize_pending_joins(_) ->
    [].

-spec normalize_pending_join_entry(map(), [map()]) -> [map()].
normalize_pending_join_entry(PendingJoin, Acc) ->
    ConnectionId = normalize_id(get_map_value(PendingJoin, [<<"connection_id">>, connection_id])),
    UserId = normalize_id(get_map_value(PendingJoin, [<<"user_id">>, user_id])),
    TokenNonce = normalize_token_nonce(get_map_value(PendingJoin, [<<"token_nonce">>, token_nonce])),
    ExpiresAt = normalize_expiry(get_map_value(PendingJoin, [<<"expires_at">>, expires_at])),
    case {ConnectionId, UserId} of
        {undefined, _} ->
            Acc;
        {_, undefined} ->
            Acc;
        _ ->
            [#{
                <<"connection_id">> => ConnectionId,
                <<"user_id">> => UserId,
                <<"token_nonce">> => TokenNonce,
                <<"expires_at">> => ExpiresAt
            } | Acc]
    end.

-spec normalize_id(term()) -> binary() | undefined.
normalize_id(undefined) ->
    undefined;
normalize_id(Value) when is_binary(Value) ->
    Value;
normalize_id(Value) when is_integer(Value) ->
    integer_to_binary(Value);
normalize_id(_) ->
    undefined.

-spec normalize_token_nonce(term()) -> binary().
normalize_token_nonce(undefined) ->
    <<>>;
normalize_token_nonce(Value) when is_binary(Value) ->
    Value;
normalize_token_nonce(Value) when is_integer(Value) ->
    integer_to_binary(Value);
normalize_token_nonce(_) ->
    <<>>.

-spec normalize_expiry(term()) -> integer().
normalize_expiry(Value) when is_integer(Value) ->
    Value;
normalize_expiry(_) ->
    0.

-spec get_map_value(map(), [term()]) -> term().
get_map_value(_Map, []) ->
    undefined;
get_map_value(Map, [Key | Rest]) ->
    case maps:find(Key, Map) of
        {ok, Value} ->
            Value;
        error ->
            get_map_value(Map, Rest)
    end.
