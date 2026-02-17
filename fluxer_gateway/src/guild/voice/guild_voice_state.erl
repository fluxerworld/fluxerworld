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

-module(guild_voice_state).

-include_lib("fluxer_gateway/include/voice_state.hrl").

-export([get_voice_state/2]).
-export([get_voice_states_list/1]).
-export([update_voice_state_data/9]).
-export([user_matches_voice_state/2]).
-export([create_voice_state/8]).
-export([extract_session_info_from_voice_state/2]).

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").
-endif.

-type guild_state() :: map().
-type voice_state() :: map().
-type voice_state_map() :: #{binary() => voice_state()}.

-spec get_voice_state(map(), guild_state()) -> {reply, map(), guild_state()}.
get_voice_state(Request, State) ->
    case maps:get(connection_id, Request, null) of
        null ->
            {reply, #{voice_state => null}, State};
        ConnectionId ->
            VoiceStates = voice_state_utils:voice_states(State),
            VoiceState = maps:get(ConnectionId, VoiceStates, null),
            {reply, #{voice_state => VoiceState}, State}
    end.

-spec get_voice_states_list(guild_state()) -> [voice_state()].
get_voice_states_list(State) ->
    maps:values(voice_state_utils:voice_states(State)).

-spec update_voice_state_data(
    binary(),
    binary(),
    voice_flags(),
    map(),
    voice_state(),
    voice_state_map(),
    guild_state(),
    boolean(),
    list()
) -> {reply, map(), guild_state()}.
update_voice_state_data(
    ConnectionId,
    ChannelIdBin,
    Flags,
    Member,
    ExistingVoiceState,
    VoiceStates,
    State,
    NeedsToken,
    ViewerStreamKeys
) ->
    #{
        self_mute := SelfMute,
        self_deaf := SelfDeaf,
        self_video := SelfVideo,
        self_stream := SelfStream,
        is_mobile := IsMobile
    } = Flags,
    ServerMute = maps:get(<<"mute">>, Member, false),
    ServerDeaf = maps:get(<<"deaf">>, Member, false),
    OldChannelIdBin = maps:get(<<"channel_id">>, ExistingVoiceState, null),
    IsChannelChange = OldChannelIdBin =/= ChannelIdBin,
    HasStateChange = has_voice_state_change(
        ExistingVoiceState, ChannelIdBin, ServerMute, ServerDeaf,
        SelfMute, SelfDeaf, SelfVideo, SelfStream, IsMobile, ViewerStreamKeys
    ),
    case HasStateChange of
        false ->
            Reply = #{success => true, voice_state => ExistingVoiceState},
            {reply, Reply, State};
        true ->
            OldVersion = maps:get(<<"version">>, ExistingVoiceState, 0),
            UpdatedVoiceState = ExistingVoiceState#{
                <<"channel_id">> => ChannelIdBin,
                <<"mute">> => ServerMute,
                <<"deaf">> => ServerDeaf,
                <<"self_mute">> => SelfMute,
                <<"self_deaf">> => SelfDeaf,
                <<"self_video">> => SelfVideo,
                <<"self_stream">> => SelfStream,
                <<"is_mobile">> => IsMobile,
                <<"viewer_stream_keys">> => ViewerStreamKeys,
                <<"version">> => OldVersion + 1
            },
            NewVoiceStates = maps:put(ConnectionId, UpdatedVoiceState, VoiceStates),
            NewState = maps:put(voice_states, NewVoiceStates, State),
            case IsChannelChange of
                true ->
                    DisconnectState = ExistingVoiceState#{
                        <<"channel_id">> => null,
                        <<"connection_id">> => ConnectionId
                    },
                    guild_voice_broadcast:broadcast_voice_state_update(
                        DisconnectState, NewState, OldChannelIdBin
                    ),
                    guild_voice_broadcast:broadcast_voice_state_update(
                        UpdatedVoiceState, NewState, ChannelIdBin
                    );
                false ->
                    guild_voice_broadcast:broadcast_voice_state_update(
                        UpdatedVoiceState, NewState, ChannelIdBin
                    )
            end,
            Reply =
                case NeedsToken of
                    true -> #{success => true, voice_state => UpdatedVoiceState, needs_token => true};
                    false -> #{success => true, voice_state => UpdatedVoiceState}
                end,
            {reply, Reply, NewState}
    end.

-spec has_voice_state_change(
    voice_state(), binary(), boolean(), boolean(),
    boolean(), boolean(), boolean(), boolean(), boolean(), term()
) -> boolean().
has_voice_state_change(
    ExistingVoiceState, ChannelIdBin, ServerMute, ServerDeaf,
    SelfMute, SelfDeaf, SelfVideo, SelfStream, IsMobile, ViewerStreamKeys
) ->
    maps:get(<<"channel_id">>, ExistingVoiceState, null) =/= ChannelIdBin orelse
    maps:get(<<"mute">>, ExistingVoiceState, false) =/= ServerMute orelse
    maps:get(<<"deaf">>, ExistingVoiceState, false) =/= ServerDeaf orelse
    maps:get(<<"self_mute">>, ExistingVoiceState, false) =/= SelfMute orelse
    maps:get(<<"self_deaf">>, ExistingVoiceState, false) =/= SelfDeaf orelse
    maps:get(<<"self_video">>, ExistingVoiceState, false) =/= SelfVideo orelse
    maps:get(<<"self_stream">>, ExistingVoiceState, false) =/= SelfStream orelse
    maps:get(<<"is_mobile">>, ExistingVoiceState, false) =/= IsMobile orelse
    maps:get(<<"viewer_stream_keys">>, ExistingVoiceState, []) =/= ViewerStreamKeys.

-spec user_matches_voice_state(voice_state(), integer() | binary()) -> boolean().
user_matches_voice_state(VoiceState, UserId) when is_integer(UserId) ->
    case map_utils:get_integer(VoiceState, <<"user_id">>, undefined) of
        undefined -> false;
        VoiceUserId -> VoiceUserId =:= UserId
    end;
user_matches_voice_state(VoiceState, UserId) when is_binary(UserId) ->
    type_conv:to_binary(map_utils:get_binary(VoiceState, <<"user_id">>, undefined)) =:= UserId;
user_matches_voice_state(_VoiceState, _UserId) ->
    false.

-spec create_voice_state(
    binary(),
    binary(),
    binary(),
    binary(),
    boolean(),
    boolean(),
    voice_flags(),
    list()
) -> voice_state().
create_voice_state(
    GuildIdBin,
    ChannelIdBin,
    UserIdBin,
    ConnectionId,
    ServerMute,
    ServerDeaf,
    Flags,
    ViewerStreamKeys
) ->
    #{
        self_mute := SelfMute,
        self_deaf := SelfDeaf,
        self_video := SelfVideo,
        self_stream := SelfStream,
        is_mobile := IsMobile
    } = Flags,
    #{
        <<"guild_id">> => GuildIdBin,
        <<"channel_id">> => ChannelIdBin,
        <<"user_id">> => UserIdBin,
        <<"connection_id">> => ConnectionId,
        <<"mute">> => ServerMute,
        <<"deaf">> => ServerDeaf,
        <<"self_mute">> => SelfMute,
        <<"self_deaf">> => SelfDeaf,
        <<"self_video">> => SelfVideo,
        <<"self_stream">> => SelfStream,
        <<"is_mobile">> => IsMobile,
        <<"viewer_stream_keys">> => ViewerStreamKeys,
        <<"version">> => 0
    }.

-spec extract_session_info_from_voice_state(binary(), voice_state()) -> map().
extract_session_info_from_voice_state(ConnId, VoiceState) ->
    #{
        connection_id => ConnId,
        session_id => maps:get(<<"session_id">>, VoiceState, undefined),
        self_mute => maps:get(<<"self_mute">>, VoiceState, false),
        self_deaf => maps:get(<<"self_deaf">>, VoiceState, false),
        self_video => maps:get(<<"self_video">>, VoiceState, false),
        self_stream => maps:get(<<"self_stream">>, VoiceState, false),
        is_mobile => maps:get(<<"is_mobile">>, VoiceState, false),
        member => maps:get(<<"member">>, VoiceState, #{})
    }.

-ifdef(TEST).

user_matches_voice_state_integer_test() ->
    VoiceState = #{<<"user_id">> => <<"10">>},
    ?assert(user_matches_voice_state(VoiceState, 10)),
    ?assertNot(user_matches_voice_state(VoiceState, 11)).

user_matches_voice_state_binary_test() ->
    VoiceState = #{<<"user_id">> => <<"123">>},
    ?assert(user_matches_voice_state(VoiceState, <<"123">>)),
    ?assertNot(user_matches_voice_state(VoiceState, <<"456">>)).

user_matches_voice_state_undefined_test() ->
    VoiceState = #{},
    ?assertNot(user_matches_voice_state(VoiceState, 10)).

create_voice_state_test() ->
    Flags = #{
        self_mute => true,
        self_deaf => false,
        self_video => true,
        self_stream => false,
        is_mobile => true
    },
    VS = create_voice_state(
        <<"1">>, <<"2">>, <<"3">>, <<"conn">>, false, false, Flags, []
    ),
    ?assertEqual(<<"1">>, maps:get(<<"guild_id">>, VS)),
    ?assertEqual(<<"2">>, maps:get(<<"channel_id">>, VS)),
    ?assertEqual(<<"3">>, maps:get(<<"user_id">>, VS)),
    ?assertEqual(<<"conn">>, maps:get(<<"connection_id">>, VS)),
    ?assertEqual(true, maps:get(<<"self_mute">>, VS)),
    ?assertEqual(false, maps:get(<<"self_deaf">>, VS)),
    ?assertEqual(true, maps:get(<<"self_video">>, VS)),
    ?assertEqual(false, maps:get(<<"self_stream">>, VS)),
    ?assertEqual(true, maps:get(<<"is_mobile">>, VS)),
    ?assertEqual(0, maps:get(<<"version">>, VS)).

extract_session_info_from_voice_state_test() ->
    VoiceState = #{
        <<"session_id">> => <<"sess">>,
        <<"self_mute">> => true,
        <<"self_deaf">> => false,
        <<"self_video">> => true,
        <<"self_stream">> => false,
        <<"is_mobile">> => true,
        <<"member">> => #{<<"id">> => <<"m">>}
    },
    Info = extract_session_info_from_voice_state(<<"conn">>, VoiceState),
    ?assertEqual(<<"conn">>, maps:get(connection_id, Info)),
    ?assertEqual(<<"sess">>, maps:get(session_id, Info)),
    ?assertEqual(true, maps:get(self_mute, Info)),
    ?assertEqual(#{<<"id">> => <<"m">>}, maps:get(member, Info)).

has_voice_state_change_no_change_test() ->
    ExistingVoiceState = #{
        <<"channel_id">> => <<"100">>,
        <<"mute">> => false,
        <<"deaf">> => false,
        <<"self_mute">> => true,
        <<"self_deaf">> => false,
        <<"self_video">> => false,
        <<"self_stream">> => false,
        <<"is_mobile">> => false,
        <<"viewer_stream_keys">> => []
    },
    ?assertNot(has_voice_state_change(
        ExistingVoiceState, <<"100">>, false, false, true, false, false, false, false, []
    )).

has_voice_state_change_channel_change_test() ->
    ExistingVoiceState = #{
        <<"channel_id">> => <<"100">>,
        <<"mute">> => false,
        <<"deaf">> => false,
        <<"self_mute">> => false,
        <<"self_deaf">> => false,
        <<"self_video">> => false,
        <<"self_stream">> => false,
        <<"is_mobile">> => false,
        <<"viewer_stream_keys">> => []
    },
    ?assert(has_voice_state_change(
        ExistingVoiceState, <<"200">>, false, false, false, false, false, false, false, []
    )).

has_voice_state_change_self_mute_change_test() ->
    ExistingVoiceState = #{
        <<"channel_id">> => <<"100">>,
        <<"mute">> => false,
        <<"deaf">> => false,
        <<"self_mute">> => false,
        <<"self_deaf">> => false,
        <<"self_video">> => false,
        <<"self_stream">> => false,
        <<"is_mobile">> => false,
        <<"viewer_stream_keys">> => []
    },
    ?assert(has_voice_state_change(
        ExistingVoiceState, <<"100">>, false, false, true, false, false, false, false, []
    )).

has_voice_state_change_server_mute_change_test() ->
    ExistingVoiceState = #{
        <<"channel_id">> => <<"100">>,
        <<"mute">> => false,
        <<"deaf">> => false,
        <<"self_mute">> => false,
        <<"self_deaf">> => false,
        <<"self_video">> => false,
        <<"self_stream">> => false,
        <<"is_mobile">> => false,
        <<"viewer_stream_keys">> => []
    },
    ?assert(has_voice_state_change(
        ExistingVoiceState, <<"100">>, true, false, false, false, false, false, false, []
    )).

has_voice_state_change_viewer_stream_keys_change_test() ->
    ExistingVoiceState = #{
        <<"channel_id">> => <<"100">>,
        <<"mute">> => false,
        <<"deaf">> => false,
        <<"self_mute">> => false,
        <<"self_deaf">> => false,
        <<"self_video">> => false,
        <<"self_stream">> => false,
        <<"is_mobile">> => false,
        <<"viewer_stream_keys">> => []
    },
    ?assert(has_voice_state_change(
        ExistingVoiceState, <<"100">>, false, false, false, false, false, false, false,
        [<<"999:100:conn">>]
    )).

has_voice_state_change_defaults_test() ->
    ExistingVoiceState = #{},
    ?assertNot(has_voice_state_change(
        ExistingVoiceState, null, false, false, false, false, false, false, false, []
    )).

-endif.
