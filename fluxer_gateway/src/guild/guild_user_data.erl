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

-module(guild_user_data).

-export([
    update_user_data/2,
    maybe_update_cached_user_data/3,
    handle_user_data_update/3,
    check_user_data_differs/2
]).

-type guild_state() :: map().
-type user_id() :: integer().
-type member() :: map().

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").
-endif.

-spec update_user_data(map(), guild_state()) -> {noreply, guild_state()}.
update_user_data(EventData, State) ->
    UserId = utils:binary_to_integer_safe(maps:get(<<"id">>, EventData)),
    Data = maps:get(data, State),
    Members = guild_data_index:member_map(Data),
    UpdatedMembers = maps:map(
        fun(_MemberUserId, Member) ->
            maybe_update_member_user(Member, UserId, EventData)
        end,
        Members
    ),
    UpdatedData = guild_data_index:put_member_map(UpdatedMembers, Data),
    UpdatedState = maps:put(data, UpdatedData, State),
    dispatch_member_update_if_found(UserId, UpdatedState),
    {noreply, UpdatedState}.

-spec maybe_update_member_user(member(), user_id(), map()) -> member().
maybe_update_member_user(Member, UserId, EventData) ->
    MUser = maps:get(<<"user">>, Member, #{}),
    MemberId =
        case is_map(MUser) of
            true -> utils:binary_to_integer_safe(maps:get(<<"id">>, MUser, <<"0">>));
            false -> undefined
        end,
    case MemberId =:= UserId of
        true -> maps:put(<<"user">>, EventData, Member);
        false -> Member
    end.

-spec dispatch_member_update_if_found(user_id(), guild_state()) -> ok.
dispatch_member_update_if_found(UserId, State) ->
    case guild_permissions:find_member_by_user_id(UserId, State) of
        undefined -> ok;
        M -> gen_server:cast(self(), {dispatch, #{event => guild_member_update, data => M}})
    end.

-spec handle_user_data_update(user_id(), map(), guild_state()) -> guild_state().
handle_user_data_update(UserId, UserData, State) ->
    case guild_permissions:find_member_by_user_id(UserId, State) of
        undefined ->
            State;
        Member ->
            CurrentUserData = maps:get(<<"user">>, Member, #{}),
            case check_user_data_differs(CurrentUserData, UserData) of
                false ->
                    State;
                true ->
                    apply_user_data_update(UserId, UserData, State)
            end
    end.

-spec apply_user_data_update(user_id(), map(), guild_state()) -> guild_state().
apply_user_data_update(UserId, UserData, State) ->
    Data = maps:get(data, State),
    Members = guild_data_index:member_map(Data),
    UpdatedMembers = maps:map(
        fun(_MemberUserId, Member) ->
            maybe_update_member_user(Member, UserId, UserData)
        end,
        Members
    ),
    UpdatedData = guild_data_index:put_member_map(UpdatedMembers, Data),
    UpdatedState = maps:put(data, UpdatedData, State),
    dispatch_guild_member_update(UserId, UpdatedState),
    UpdatedState.

-spec dispatch_guild_member_update(user_id(), guild_state()) -> ok.
dispatch_guild_member_update(UserId, State) ->
    case guild_permissions:find_member_by_user_id(UserId, State) of
        undefined ->
            ok;
        M ->
            GuildId = maps:get(id, State),
            MemberUpdateData = maps:put(<<"guild_id">>, integer_to_binary(GuildId), M),
            gen_server:cast(
                self(),
                {dispatch, #{event => guild_member_update, data => MemberUpdateData}}
            )
    end.

-spec check_user_data_differs(map(), map()) -> boolean().
check_user_data_differs(CurrentUserData, NewUserData) ->
    utils:check_user_data_differs(CurrentUserData, NewUserData).

-spec maybe_update_cached_user_data(atom(), map(), guild_state()) -> guild_state().
maybe_update_cached_user_data(Event, EventData, State) when
    Event =:= message_create; Event =:= message_update
->
    case maps:get(<<"author">>, EventData, undefined) of
        undefined ->
            State;
        AuthorData ->
            UserId = utils:binary_to_integer_safe(maps:get(<<"id">>, AuthorData, <<"0">>)),
            case guild_permissions:find_member_by_user_id(UserId, State) of
                undefined ->
                    State;
                Member ->
                    CurrentUserData = maps:get(<<"user">>, Member, #{}),
                    case check_user_data_differs(CurrentUserData, AuthorData) of
                        true ->
                            handle_user_data_update(UserId, AuthorData, State);
                        false ->
                            State
                    end
            end
    end;
maybe_update_cached_user_data(_, _, State) ->
    State.

-ifdef(TEST).

update_user_data_updates_member_test() ->
    State = test_state(),
    EventData = #{<<"id">> => <<"100">>, <<"username">> => <<"updated">>},
    {noreply, UpdatedState} = update_user_data(EventData, State),
    Data = maps:get(data, UpdatedState),
    Member = maps:get(100, maps:get(<<"members">>, Data)),
    User = maps:get(<<"user">>, Member),
    ?assertEqual(<<"updated">>, maps:get(<<"username">>, User)).

handle_user_data_update_no_change_test() ->
    State = test_state(),
    UserData = #{<<"id">> => <<"100">>, <<"username">> => <<"alice">>},
    NewState = handle_user_data_update(100, UserData, State),
    ?assertEqual(State, NewState).

check_user_data_differs_test() ->
    Current = #{<<"username">> => <<"alice">>},
    Same = #{<<"username">> => <<"alice">>},
    Different = #{<<"username">> => <<"bob">>},
    ?assertEqual(false, check_user_data_differs(Current, Same)),
    ?assertEqual(true, check_user_data_differs(Current, Different)).

test_state() ->
    #{
        id => 42,
        data => #{
            <<"members">> => #{
                100 => #{<<"user">> => #{<<"id">> => <<"100">>, <<"username">> => <<"alice">>}}
            }
        }
    }.

-endif.
