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

-module(guild_virtual_channel_access).

-export([
    add_virtual_access/3,
    remove_virtual_access/3,
    has_virtual_access/3,
    get_virtual_channels_for_user/2,
    get_users_with_virtual_access/2,
    dispatch_channel_visibility_change/4,
    mark_pending_join/3,
    clear_pending_join/3,
    is_pending_join/3,
    mark_preserve/3,
    clear_preserve/3,
    has_preserve/3,
    mark_move_pending/3,
    clear_move_pending/3,
    is_move_pending/3
]).

-type guild_state() :: map().
-type user_id() :: integer().
-type channel_id() :: integer().

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").
-endif.

-spec add_virtual_access(user_id(), channel_id(), guild_state()) -> guild_state().
add_virtual_access(UserId, ChannelId, State) ->
    VirtualAccess = maps:get(virtual_channel_access, State, #{}),
    UserChannels = maps:get(UserId, VirtualAccess, sets:new()),
    UpdatedUserChannels = sets:add_element(ChannelId, UserChannels),
    UpdatedVirtualAccess = maps:put(UserId, UpdatedUserChannels, VirtualAccess),
    State1 = maps:put(virtual_channel_access, UpdatedVirtualAccess, State),
    State2 = update_user_session_view_cache(UserId, ChannelId, add, State1),
    mark_pending_join(UserId, ChannelId, State2).

-spec remove_virtual_access(user_id(), channel_id(), guild_state()) -> guild_state().
remove_virtual_access(UserId, ChannelId, State) ->
    VirtualAccess = maps:get(virtual_channel_access, State, #{}),
    case maps:get(UserId, VirtualAccess, undefined) of
        undefined ->
            State;
        UserChannels ->
            UpdatedUserChannels = sets:del_element(ChannelId, UserChannels),
            case sets:size(UpdatedUserChannels) of
                0 ->
                    remove_all_user_virtual_access(UserId, State);
                _ ->
                    update_user_virtual_access(UserId, ChannelId, UpdatedUserChannels, State)
            end
    end.

-spec remove_all_user_virtual_access(user_id(), guild_state()) -> guild_state().
remove_all_user_virtual_access(UserId, State) ->
    VirtualAccess = maps:get(virtual_channel_access, State, #{}),
    PendingMap = maps:get(virtual_channel_access_pending, State, #{}),
    PreserveMap = maps:get(virtual_channel_access_preserve, State, #{}),
    MoveMap = maps:get(virtual_channel_access_move_pending, State, #{}),
    UpdatedVirtualAccess = maps:remove(UserId, VirtualAccess),
    UpdatedPending = maps:remove(UserId, PendingMap),
    UpdatedPreserve = maps:remove(UserId, PreserveMap),
    UpdatedMove = maps:remove(UserId, MoveMap),
    State1 = maps:put(virtual_channel_access, UpdatedVirtualAccess, State),
    State2 = maps:put(virtual_channel_access_pending, UpdatedPending, State1),
    State3 = maps:put(virtual_channel_access_preserve, UpdatedPreserve, State2),
    State4 = maps:put(virtual_channel_access_move_pending, UpdatedMove, State3),
    clear_user_session_view_cache(UserId, State4).

-spec update_user_virtual_access(user_id(), channel_id(), sets:set(), guild_state()) ->
    guild_state().
update_user_virtual_access(UserId, ChannelId, UpdatedUserChannels, State) ->
    VirtualAccess = maps:get(virtual_channel_access, State, #{}),
    PendingMap = maps:get(virtual_channel_access_pending, State, #{}),
    PreserveMap = maps:get(virtual_channel_access_preserve, State, #{}),
    MoveMap = maps:get(virtual_channel_access_move_pending, State, #{}),
    UpdatedVirtualAccess = maps:put(UserId, UpdatedUserChannels, VirtualAccess),
    UpdatedUserPending = sets:del_element(ChannelId, maps:get(UserId, PendingMap, sets:new())),
    UpdatedPending = maps:put(UserId, UpdatedUserPending, PendingMap),
    UpdatedUserPreserve = sets:del_element(ChannelId, maps:get(UserId, PreserveMap, sets:new())),
    UpdatedPreserve = maps:put(UserId, UpdatedUserPreserve, PreserveMap),
    UpdatedUserMove = sets:del_element(ChannelId, maps:get(UserId, MoveMap, sets:new())),
    UpdatedMove = maps:put(UserId, UpdatedUserMove, MoveMap),
    State1 = maps:put(virtual_channel_access, UpdatedVirtualAccess, State),
    State2 = maps:put(virtual_channel_access_pending, UpdatedPending, State1),
    State3 = maps:put(virtual_channel_access_preserve, UpdatedPreserve, State2),
    State4 = maps:put(virtual_channel_access_move_pending, UpdatedMove, State3),
    update_user_session_view_cache(UserId, ChannelId, remove, State4).

-spec has_virtual_access(user_id(), channel_id(), guild_state()) -> boolean().
has_virtual_access(UserId, ChannelId, State) ->
    VirtualAccess = maps:get(virtual_channel_access, State, #{}),
    case maps:get(UserId, VirtualAccess, undefined) of
        undefined -> false;
        UserChannels -> sets:is_element(ChannelId, UserChannels)
    end.

-spec get_virtual_channels_for_user(user_id(), guild_state()) -> [channel_id()].
get_virtual_channels_for_user(UserId, State) ->
    VirtualAccess = maps:get(virtual_channel_access, State, #{}),
    case maps:get(UserId, VirtualAccess, undefined) of
        undefined -> [];
        UserChannels -> sets:to_list(UserChannels)
    end.

-spec mark_pending_join(user_id(), channel_id(), guild_state()) -> guild_state().
mark_pending_join(UserId, ChannelId, State) ->
    PendingMap = maps:get(virtual_channel_access_pending, State, #{}),
    UserPending = maps:get(UserId, PendingMap, sets:new()),
    UpdatedUserPending = sets:add_element(ChannelId, UserPending),
    UpdatedPending = maps:put(UserId, UpdatedUserPending, PendingMap),
    maps:put(virtual_channel_access_pending, UpdatedPending, State).

-spec clear_pending_join(user_id(), channel_id(), guild_state()) -> guild_state().
clear_pending_join(UserId, ChannelId, State) ->
    PendingMap = maps:get(virtual_channel_access_pending, State, #{}),
    UserPending = maps:get(UserId, PendingMap, sets:new()),
    UpdatedUserPending = sets:del_element(ChannelId, UserPending),
    UpdatedPending =
        case sets:size(UpdatedUserPending) of
            0 -> maps:remove(UserId, PendingMap);
            _ -> maps:put(UserId, UpdatedUserPending, PendingMap)
        end,
    maps:put(virtual_channel_access_pending, UpdatedPending, State).

-spec is_pending_join(user_id(), channel_id(), guild_state()) -> boolean().
is_pending_join(UserId, ChannelId, State) ->
    PendingMap = maps:get(virtual_channel_access_pending, State, #{}),
    case maps:get(UserId, PendingMap, undefined) of
        undefined -> false;
        UserPending -> sets:is_element(ChannelId, UserPending)
    end.

-spec mark_preserve(user_id(), channel_id(), guild_state()) -> guild_state().
mark_preserve(UserId, ChannelId, State) ->
    PreserveMap = maps:get(virtual_channel_access_preserve, State, #{}),
    UserPreserve = maps:get(UserId, PreserveMap, sets:new()),
    UpdatedUserPreserve = sets:add_element(ChannelId, UserPreserve),
    UpdatedPreserve = maps:put(UserId, UpdatedUserPreserve, PreserveMap),
    maps:put(virtual_channel_access_preserve, UpdatedPreserve, State).

-spec clear_preserve(user_id(), channel_id(), guild_state()) -> guild_state().
clear_preserve(UserId, ChannelId, State) ->
    PreserveMap = maps:get(virtual_channel_access_preserve, State, #{}),
    UserPreserve = maps:get(UserId, PreserveMap, sets:new()),
    UpdatedUserPreserve = sets:del_element(ChannelId, UserPreserve),
    UpdatedPreserve =
        case sets:size(UpdatedUserPreserve) of
            0 -> maps:remove(UserId, PreserveMap);
            _ -> maps:put(UserId, UpdatedUserPreserve, PreserveMap)
        end,
    maps:put(virtual_channel_access_preserve, UpdatedPreserve, State).

-spec has_preserve(user_id(), channel_id(), guild_state()) -> boolean().
has_preserve(UserId, ChannelId, State) ->
    PreserveMap = maps:get(virtual_channel_access_preserve, State, #{}),
    case maps:get(UserId, PreserveMap, undefined) of
        undefined -> false;
        UserPreserve -> sets:is_element(ChannelId, UserPreserve)
    end.

-spec mark_move_pending(user_id(), channel_id(), guild_state()) -> guild_state().
mark_move_pending(UserId, ChannelId, State) ->
    MoveMap = maps:get(virtual_channel_access_move_pending, State, #{}),
    UserMoves = maps:get(UserId, MoveMap, sets:new()),
    UpdatedUserMoves = sets:add_element(ChannelId, UserMoves),
    UpdatedMoveMap = maps:put(UserId, UpdatedUserMoves, MoveMap),
    maps:put(virtual_channel_access_move_pending, UpdatedMoveMap, State).

-spec clear_move_pending(user_id(), channel_id(), guild_state()) -> guild_state().
clear_move_pending(UserId, ChannelId, State) ->
    MoveMap = maps:get(virtual_channel_access_move_pending, State, #{}),
    UserMoves = maps:get(UserId, MoveMap, sets:new()),
    UpdatedUserMoves = sets:del_element(ChannelId, UserMoves),
    UpdatedMoveMap =
        case sets:size(UpdatedUserMoves) of
            0 -> maps:remove(UserId, MoveMap);
            _ -> maps:put(UserId, UpdatedUserMoves, MoveMap)
        end,
    maps:put(virtual_channel_access_move_pending, UpdatedMoveMap, State).

-spec is_move_pending(user_id(), channel_id(), guild_state()) -> boolean().
is_move_pending(UserId, ChannelId, State) ->
    MoveMap = maps:get(virtual_channel_access_move_pending, State, #{}),
    case maps:get(UserId, MoveMap, undefined) of
        undefined -> false;
        UserMoves -> sets:is_element(ChannelId, UserMoves)
    end.

-spec get_users_with_virtual_access(channel_id(), guild_state()) -> [user_id()].
get_users_with_virtual_access(ChannelId, State) ->
    VirtualAccess = maps:get(virtual_channel_access, State, #{}),
    maps:fold(
        fun(UserId, UserChannels, Acc) ->
            case sets:is_element(ChannelId, UserChannels) of
                true -> [UserId | Acc];
                false -> Acc
            end
        end,
        [],
        VirtualAccess
    ).

-spec dispatch_channel_visibility_change(user_id(), channel_id(), add | remove, guild_state()) ->
    ok.
dispatch_channel_visibility_change(UserId, ChannelId, Action, State) ->
    Channel = guild_permissions:find_channel_by_id(ChannelId, State),
    case Channel of
        undefined ->
            ok;
        _ ->
            Sessions = maps:get(sessions, State, #{}),
            GuildId = maps:get(id, State),
            UserSessions = maps:filter(
                fun(_Sid, SessionData) ->
                    maps:get(user_id, SessionData) =:= UserId
                end,
                Sessions
            ),
            dispatch_to_user_sessions(Action, Channel, ChannelId, GuildId, UserSessions)
    end.

-spec dispatch_to_user_sessions(add | remove, map(), channel_id(), integer(), map()) -> ok.
dispatch_to_user_sessions(add, Channel, _ChannelId, GuildId, UserSessions) ->
    ChannelWithGuild = maps:put(<<"guild_id">>, integer_to_binary(GuildId), Channel),
    maps:foreach(
        fun(_Sid, SessionData) ->
            Pid = maps:get(pid, SessionData),
            gen_server:cast(Pid, {dispatch, channel_create, ChannelWithGuild})
        end,
        UserSessions
    );
dispatch_to_user_sessions(remove, _Channel, ChannelId, GuildId, UserSessions) ->
    ChannelDelete = #{
        <<"id">> => integer_to_binary(ChannelId),
        <<"guild_id">> => integer_to_binary(GuildId)
    },
    maps:foreach(
        fun(_Sid, SessionData) ->
            Pid = maps:get(pid, SessionData),
            gen_server:cast(Pid, {dispatch, channel_delete, ChannelDelete})
        end,
        UserSessions
    ).

-spec update_user_session_view_cache(user_id(), channel_id(), add | remove, guild_state()) ->
    guild_state().
update_user_session_view_cache(UserId, ChannelId, Action, State) ->
    Sessions = maps:get(sessions, State, #{}),
    UpdatedSessions = maps:map(
        fun(_SessionId, SessionData) ->
            case maps:get(user_id, SessionData, undefined) of
                UserId ->
                    update_session_view_cache(SessionData, ChannelId, Action);
                _ ->
                    SessionData
            end
        end,
        Sessions
    ),
    maps:put(sessions, UpdatedSessions, State).

-spec clear_user_session_view_cache(user_id(), guild_state()) -> guild_state().
clear_user_session_view_cache(UserId, State) ->
    Sessions = maps:get(sessions, State, #{}),
    UpdatedSessions = maps:map(
        fun(_SessionId, SessionData) ->
            case maps:get(user_id, SessionData, undefined) of
                UserId ->
                    maps:put(viewable_channels, #{}, SessionData);
                _ ->
                    SessionData
            end
        end,
        Sessions
    ),
    maps:put(sessions, UpdatedSessions, State).

-spec update_session_view_cache(map(), channel_id(), add | remove) -> map().
update_session_view_cache(SessionData, ChannelId, add) ->
    ViewableChannels = ensure_viewable_channel_map(maps:get(viewable_channels, SessionData, #{})),
    UpdatedViewableChannels = maps:put(ChannelId, true, ViewableChannels),
    maps:put(viewable_channels, UpdatedViewableChannels, SessionData);
update_session_view_cache(SessionData, ChannelId, remove) ->
    ViewableChannels = ensure_viewable_channel_map(maps:get(viewable_channels, SessionData, #{})),
    UpdatedViewableChannels = maps:remove(ChannelId, ViewableChannels),
    maps:put(viewable_channels, UpdatedViewableChannels, SessionData).

-spec ensure_viewable_channel_map(term()) -> map().
ensure_viewable_channel_map(ViewableChannels) when is_map(ViewableChannels) ->
    ViewableChannels;
ensure_viewable_channel_map(_) ->
    #{}.

-ifdef(TEST).

add_virtual_access_test() ->
    State = #{},
    State1 = add_virtual_access(100, 500, State),
    ?assertEqual(true, has_virtual_access(100, 500, State1)),
    ?assertEqual(true, is_pending_join(100, 500, State1)).

add_virtual_access_updates_session_cache_test() ->
    State = #{
        sessions => #{
            <<"s1">> => #{user_id => 100, viewable_channels => #{}}
        }
    },
    State1 = add_virtual_access(100, 500, State),
    Session = maps:get(<<"s1">>, maps:get(sessions, State1)),
    ViewableChannels = maps:get(viewable_channels, Session, #{}),
    ?assertEqual(true, maps:is_key(500, ViewableChannels)).

remove_virtual_access_test() ->
    State = add_virtual_access(100, 500, #{}),
    State1 = remove_virtual_access(100, 500, State),
    ?assertEqual(false, has_virtual_access(100, 500, State1)).

remove_virtual_access_updates_session_cache_test() ->
    State = #{
        sessions => #{
            <<"s1">> => #{user_id => 100, viewable_channels => #{500 => true}}
        },
        virtual_channel_access => #{100 => sets:from_list([500])},
        virtual_channel_access_pending => #{100 => sets:from_list([500])},
        virtual_channel_access_preserve => #{100 => sets:new()},
        virtual_channel_access_move_pending => #{100 => sets:new()}
    },
    State1 = remove_virtual_access(100, 500, State),
    Session = maps:get(<<"s1">>, maps:get(sessions, State1)),
    ViewableChannels = maps:get(viewable_channels, Session, #{}),
    ?assertEqual(false, maps:is_key(500, ViewableChannels)).

get_virtual_channels_for_user_test() ->
    State = add_virtual_access(100, 500, #{}),
    State1 = add_virtual_access(100, 501, State),
    Channels = lists:sort(get_virtual_channels_for_user(100, State1)),
    ?assertEqual([500, 501], Channels).

get_users_with_virtual_access_test() ->
    State = add_virtual_access(100, 500, #{}),
    State1 = add_virtual_access(101, 500, State),
    Users = lists:sort(get_users_with_virtual_access(500, State1)),
    ?assertEqual([100, 101], Users).

mark_and_clear_preserve_test() ->
    State = add_virtual_access(100, 500, #{}),
    State1 = mark_preserve(100, 500, State),
    ?assertEqual(true, has_preserve(100, 500, State1)),
    State2 = clear_preserve(100, 500, State1),
    ?assertEqual(false, has_preserve(100, 500, State2)).

mark_and_clear_move_pending_test() ->
    State = add_virtual_access(100, 500, #{}),
    State1 = mark_move_pending(100, 500, State),
    ?assertEqual(true, is_move_pending(100, 500, State1)),
    State2 = clear_move_pending(100, 500, State1),
    ?assertEqual(false, is_move_pending(100, 500, State2)).

-endif.
