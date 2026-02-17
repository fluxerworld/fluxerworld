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

-module(voice_utils).

-export([
    build_voice_token_rpc_request/6,
    build_voice_token_rpc_request/7,
    build_voice_token_rpc_request/8,
    build_force_disconnect_rpc_request/4,
    build_update_participant_rpc_request/5,
    build_update_participant_permissions_rpc_request/5,
    add_geolocation_to_request/3,
    add_rtc_region_to_request/2,
    compute_voice_permissions/3,
    generate_token_nonce/0
]).

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").
-endif.

-type guild_state() :: map().
-type voice_permissions() :: #{
    can_speak := boolean(),
    can_stream := boolean(),
    can_video := boolean()
}.

-spec build_voice_token_rpc_request(
    integer() | null,
    integer(),
    integer(),
    binary() | integer() | null,
    binary() | number() | list() | null,
    binary() | number() | list() | null
) -> map().
build_voice_token_rpc_request(GuildId, ChannelId, UserId, ConnectionId, Latitude, Longitude) ->
    BaseReq0 = #{
        <<"type">> => <<"voice_get_token">>,
        <<"channel_id">> => integer_to_binary(ChannelId),
        <<"user_id">> => integer_to_binary(UserId)
    },
    BaseReq =
        case GuildId of
            null -> BaseReq0;
            _ -> maps:put(<<"guild_id">>, integer_to_binary(GuildId), BaseReq0)
        end,
    WithConnection = add_connection_id_to_request(BaseReq, ConnectionId),
    add_geolocation_to_request(WithConnection, Latitude, Longitude).

-spec add_geolocation_to_request(
    map(),
    binary() | number() | list() | null,
    binary() | number() | list() | null
) -> map().
add_geolocation_to_request(RequestMap, Latitude, Longitude) ->
    case {normalise_coordinate(Latitude), normalise_coordinate(Longitude)} of
        {Lat, Long} when is_binary(Lat) andalso is_binary(Long) ->
            maps:merge(RequestMap, #{
                <<"latitude">> => Lat,
                <<"longitude">> => Long
            });
        _ ->
            RequestMap
    end.

-spec normalise_coordinate(binary() | number() | list() | null) -> binary() | undefined.
normalise_coordinate(null) ->
    undefined;
normalise_coordinate(Value) when is_binary(Value) ->
    Value;
normalise_coordinate(Value) when is_integer(Value) ->
    integer_to_binary(Value);
normalise_coordinate(Value) when is_float(Value) ->
    float_to_binary(Value, [short]);
normalise_coordinate(Value) when is_list(Value) ->
    try
        list_to_binary(Value)
    catch
        error:badarg -> undefined
    end;
normalise_coordinate(_Value) ->
    undefined.

-spec add_rtc_region_to_request(map(), binary() | null) -> map().
add_rtc_region_to_request(RequestMap, Region) ->
    case Region of
        RegionBin when is_binary(RegionBin) ->
            maps:put(<<"rtc_region">>, RegionBin, RequestMap);
        _ ->
            RequestMap
    end.

-spec add_connection_id_to_request(map(), binary() | integer() | null) -> map().
add_connection_id_to_request(RequestMap, ConnectionId) ->
    case ConnectionId of
        null ->
            RequestMap;
        ConnectionIdBin when is_binary(ConnectionIdBin) ->
            maps:put(<<"connection_id">>, ConnectionIdBin, RequestMap);
        ConnectionIdInt when is_integer(ConnectionIdInt) ->
            maps:put(<<"connection_id">>, integer_to_binary(ConnectionIdInt), RequestMap);
        _ ->
            RequestMap
    end.

-spec build_force_disconnect_rpc_request(integer() | null, integer(), integer(), binary()) -> map().
build_force_disconnect_rpc_request(GuildId, ChannelId, UserId, ConnectionId) ->
    BaseReq = #{
        <<"type">> => <<"voice_force_disconnect_participant">>,
        <<"channel_id">> => integer_to_binary(ChannelId),
        <<"user_id">> => integer_to_binary(UserId),
        <<"connection_id">> => ConnectionId
    },
    case GuildId of
        null ->
            BaseReq;
        _ ->
            maps:put(<<"guild_id">>, integer_to_binary(GuildId), BaseReq)
    end.

-spec build_update_participant_rpc_request(
    integer() | null, integer(), integer(), boolean(), boolean()
) -> map().
build_update_participant_rpc_request(GuildId, ChannelId, UserId, Mute, Deaf) ->
    BaseReq = #{
        <<"type">> => <<"voice_update_participant">>,
        <<"channel_id">> => integer_to_binary(ChannelId),
        <<"user_id">> => integer_to_binary(UserId),
        <<"mute">> => Mute,
        <<"deaf">> => Deaf
    },
    case GuildId of
        null ->
            BaseReq;
        _ ->
            maps:put(<<"guild_id">>, integer_to_binary(GuildId), BaseReq)
    end.

-spec build_update_participant_permissions_rpc_request(
    integer() | null, integer(), integer(), binary(), voice_permissions()
) -> map().
build_update_participant_permissions_rpc_request(
    GuildId, ChannelId, UserId, ConnectionId, VoicePermissions
) ->
    BaseReq = #{
        <<"type">> => <<"voice_update_participant_permissions">>,
        <<"channel_id">> => integer_to_binary(ChannelId),
        <<"user_id">> => integer_to_binary(UserId),
        <<"connection_id">> => ConnectionId,
        <<"can_speak">> => maps:get(can_speak, VoicePermissions, true),
        <<"can_stream">> => maps:get(can_stream, VoicePermissions, true),
        <<"can_video">> => maps:get(can_video, VoicePermissions, true)
    },
    case GuildId of
        null ->
            BaseReq;
        _ ->
            maps:put(<<"guild_id">>, integer_to_binary(GuildId), BaseReq)
    end.

-spec compute_voice_permissions(integer(), integer(), guild_state()) -> voice_permissions().
compute_voice_permissions(UserId, ChannelId, State) ->
    Permissions = guild_permissions:get_member_permissions(UserId, ChannelId, State),
    SpeakPerm = constants:speak_permission(),
    StreamPerm = constants:stream_permission(),
    AdminPerm = constants:administrator_permission(),
    IsAdmin = (Permissions band AdminPerm) =:= AdminPerm,
    CanSpeak = IsAdmin orelse ((Permissions band SpeakPerm) =:= SpeakPerm),
    CanStream = IsAdmin orelse ((Permissions band StreamPerm) =:= StreamPerm),
    HasVirtualAccess = guild_virtual_channel_access:has_virtual_access(UserId, ChannelId, State),
    FinalCanSpeak = CanSpeak orelse HasVirtualAccess,
    FinalCanStream = CanStream orelse HasVirtualAccess,
    #{
        can_speak => FinalCanSpeak,
        can_stream => FinalCanStream,
        can_video => FinalCanStream
    }.

-spec build_voice_token_rpc_request(
    integer() | null,
    integer(),
    integer(),
    binary() | integer() | null,
    binary() | null,
    binary() | null,
    voice_permissions()
) -> map().
build_voice_token_rpc_request(
    GuildId, ChannelId, UserId, ConnectionId, Latitude, Longitude, VoicePermissions
) ->
    build_voice_token_rpc_request(
        GuildId, ChannelId, UserId, ConnectionId, Latitude, Longitude, VoicePermissions, null
    ).

-spec build_voice_token_rpc_request(
    integer() | null,
    integer(),
    integer(),
    binary() | integer() | null,
    binary() | null,
    binary() | null,
    voice_permissions(),
    binary() | null
) -> map().
build_voice_token_rpc_request(
    GuildId, ChannelId, UserId, ConnectionId, Latitude, Longitude, VoicePermissions, TokenNonce
) ->
    BaseReq = build_voice_token_rpc_request(
        GuildId, ChannelId, UserId, ConnectionId, Latitude, Longitude
    ),
    Req0 = maps:merge(BaseReq, #{
        <<"can_speak">> => maps:get(can_speak, VoicePermissions, true),
        <<"can_stream">> => maps:get(can_stream, VoicePermissions, true),
        <<"can_video">> => maps:get(can_video, VoicePermissions, true)
    }),
    case TokenNonce of
        null -> Req0;
        undefined -> Req0;
        _ when is_binary(TokenNonce) -> maps:put(<<"token_nonce">>, TokenNonce, Req0);
        _ -> Req0
    end.

-spec generate_token_nonce() -> binary().
generate_token_nonce() ->
    Bytes = crypto:strong_rand_bytes(16),
    binary:encode_hex(Bytes, lowercase).

-ifdef(TEST).

build_voice_token_rpc_request_guild_test() ->
    Req = build_voice_token_rpc_request(123, 456, 789, null, null, null),
    ?assertEqual(<<"voice_get_token">>, maps:get(<<"type">>, Req)),
    ?assertEqual(<<"123">>, maps:get(<<"guild_id">>, Req)),
    ?assertEqual(<<"456">>, maps:get(<<"channel_id">>, Req)),
    ?assertEqual(<<"789">>, maps:get(<<"user_id">>, Req)),
    ?assertNot(maps:is_key(<<"connection_id">>, Req)).

build_voice_token_rpc_request_dm_test() ->
    Req = build_voice_token_rpc_request(null, 456, 789, null, null, null),
    ?assertEqual(<<"voice_get_token">>, maps:get(<<"type">>, Req)),
    ?assertNot(maps:is_key(<<"guild_id">>, Req)),
    ?assertEqual(<<"456">>, maps:get(<<"channel_id">>, Req)).

build_voice_token_rpc_request_with_connection_test() ->
    Req = build_voice_token_rpc_request(123, 456, 789, <<"conn-id">>, null, null),
    ?assertEqual(<<"conn-id">>, maps:get(<<"connection_id">>, Req)).

build_voice_token_rpc_request_dm_with_connection_test() ->
    Req = build_voice_token_rpc_request(null, 456, 789, <<"conn-id">>, null, null),
    ?assertEqual(<<"conn-id">>, maps:get(<<"connection_id">>, Req)).

add_geolocation_to_request_test() ->
    BaseReq = #{<<"type">> => <<"test">>},
    WithGeo = add_geolocation_to_request(BaseReq, <<"1.0">>, <<"2.0">>),
    ?assertEqual(<<"1.0">>, maps:get(<<"latitude">>, WithGeo)),
    ?assertEqual(<<"2.0">>, maps:get(<<"longitude">>, WithGeo)),
    WithoutGeo = add_geolocation_to_request(BaseReq, null, null),
    ?assertNot(maps:is_key(<<"latitude">>, WithoutGeo)).

add_geolocation_to_request_number_test() ->
    BaseReq = #{<<"type">> => <<"test">>},
    WithGeo = add_geolocation_to_request(BaseReq, 1.5, 2.25),
    ?assertEqual(<<"1.5">>, maps:get(<<"latitude">>, WithGeo)),
    ?assertEqual(<<"2.25">>, maps:get(<<"longitude">>, WithGeo)).

add_rtc_region_to_request_test() ->
    BaseReq = #{<<"type">> => <<"test">>},
    WithRegion = add_rtc_region_to_request(BaseReq, <<"us-east">>),
    ?assertEqual(<<"us-east">>, maps:get(<<"rtc_region">>, WithRegion)),
    WithoutRegion = add_rtc_region_to_request(BaseReq, null),
    ?assertNot(maps:is_key(<<"rtc_region">>, WithoutRegion)).

build_force_disconnect_rpc_request_test() ->
    Req = build_force_disconnect_rpc_request(123, 456, 789, <<"conn">>),
    ?assertEqual(<<"voice_force_disconnect_participant">>, maps:get(<<"type">>, Req)),
    ?assertEqual(<<"123">>, maps:get(<<"guild_id">>, Req)),
    ?assertEqual(<<"conn">>, maps:get(<<"connection_id">>, Req)).

build_update_participant_rpc_request_test() ->
    Req = build_update_participant_rpc_request(123, 456, 789, true, false),
    ?assertEqual(<<"voice_update_participant">>, maps:get(<<"type">>, Req)),
    ?assertEqual(true, maps:get(<<"mute">>, Req)),
    ?assertEqual(false, maps:get(<<"deaf">>, Req)).

generate_token_nonce_format_test() ->
    Nonce = generate_token_nonce(),
    ?assert(is_binary(Nonce)),
    ?assertEqual(32, byte_size(Nonce)),
    ?assert(lists:all(fun(C) ->
        (C >= $0 andalso C =< $9) orelse (C >= $a andalso C =< $f)
    end, binary_to_list(Nonce))).

generate_token_nonce_unique_test() ->
    Nonce1 = generate_token_nonce(),
    Nonce2 = generate_token_nonce(),
    Nonce3 = generate_token_nonce(),
    ?assertNot(Nonce1 =:= Nonce2),
    ?assertNot(Nonce2 =:= Nonce3),
    ?assertNot(Nonce1 =:= Nonce3).

build_voice_token_rpc_request_with_nonce_test() ->
    VoicePerms = #{
        can_speak => true,
        can_stream => false,
        can_video => false
    },
    Req = build_voice_token_rpc_request(
        123, 456, 789, null, null, null, VoicePerms, <<"test-nonce-123">>
    ),
    ?assertEqual(<<"test-nonce-123">>, maps:get(<<"token_nonce">>, Req)),
    ?assertEqual(true, maps:get(<<"can_speak">>, Req)),
    ?assertEqual(false, maps:get(<<"can_stream">>, Req)).

build_voice_token_rpc_request_without_nonce_test() ->
    VoicePerms = #{
        can_speak => true,
        can_stream => true,
        can_video => true
    },
    Req = build_voice_token_rpc_request(
        123, 456, 789, null, null, null, VoicePerms, null
    ),
    ?assertNot(maps:is_key(<<"token_nonce">>, Req)),
    ?assertEqual(true, maps:get(<<"can_speak">>, Req)).

build_voice_token_rpc_request_undefined_nonce_test() ->
    VoicePerms = #{
        can_speak => false,
        can_stream => true,
        can_video => true
    },
    Req = build_voice_token_rpc_request(
        123, 456, 789, null, null, null, VoicePerms, undefined
    ),
    ?assertNot(maps:is_key(<<"token_nonce">>, Req)),
    ?assertEqual(false, maps:get(<<"can_speak">>, Req)).

-endif.
