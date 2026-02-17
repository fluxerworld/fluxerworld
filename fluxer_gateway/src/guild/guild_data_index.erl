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

-module(guild_data_index).

-export([
    normalize_data/1,
    member_map/1,
    member_values/1,
    member_list/1,
    member_count/1,
    member_ids/1,
    member_role_index/1,
    get_member/2,
    put_member/2,
    put_member_map/2,
    put_member_list/2,
    remove_member/2,
    role_list/1,
    role_index/1,
    put_roles/2,
    channel_list/1,
    channel_index/1,
    put_channels/2
]).

-type guild_data() :: map().
-type member() :: map().
-type role() :: map().
-type channel() :: map().
-type user_id() :: integer().
-type snowflake_id() :: integer().
-type role_member_index() :: #{snowflake_id() => #{user_id() => true}}.

-spec normalize_data(guild_data()) -> guild_data().
normalize_data(Data) when is_map(Data) ->
    MemberMap = member_map(Data),
    Roles = role_list(Data),
    Channels = channel_list(Data),
    Data1 = maps:put(<<"members">>, MemberMap, Data),
    Data2 = maps:put(<<"roles">>, Roles, Data1),
    Data3 = maps:put(<<"channels">>, Channels, Data2),
    Data4 = maps:put(<<"role_index">>, build_id_index(Roles), Data3),
    Data5 = maps:put(<<"channel_index">>, build_id_index(Channels), Data4),
    maps:put(<<"member_role_index">>, build_member_role_index(MemberMap), Data5);
normalize_data(Data) ->
    Data.

-spec member_map(guild_data()) -> #{user_id() => member()}.
member_map(Data) when is_map(Data) ->
    case maps:get(<<"members">>, Data, #{}) of
        Members when is_map(Members) ->
            normalize_member_map(Members);
        Members when is_list(Members) ->
            build_member_map(Members);
        _ ->
            #{}
    end;
member_map(_) ->
    #{}.

-spec member_list(guild_data()) -> [member()].
member_list(Data) ->
    MemberPairs = maps:to_list(member_map(Data)),
    SortedPairs = lists:sort(fun({A, _}, {B, _}) -> A =< B end, MemberPairs),
    [Member || {_UserId, Member} <- SortedPairs].

-spec member_values(guild_data()) -> [member()].
member_values(Data) ->
    maps:values(member_map(Data)).

-spec member_count(guild_data()) -> non_neg_integer().
member_count(Data) ->
    map_size(member_map(Data)).

-spec member_ids(guild_data()) -> [user_id()].
member_ids(Data) ->
    maps:keys(member_map(Data)).

-spec member_role_index(guild_data()) -> role_member_index().
member_role_index(Data) when is_map(Data) ->
    case maps:get(<<"member_role_index">>, Data, undefined) of
        Index when is_map(Index) -> normalize_member_role_index(Index);
        _ -> build_member_role_index(member_map(Data))
    end;
member_role_index(_) ->
    #{}.

-spec get_member(user_id(), guild_data()) -> member() | undefined.
get_member(UserId, Data) when is_integer(UserId) ->
    maps:get(UserId, member_map(Data), undefined);
get_member(_, _) ->
    undefined.

-spec put_member(member(), guild_data()) -> guild_data().
put_member(Member, Data) when is_map(Member), is_map(Data) ->
    case member_user_id(Member) of
        undefined ->
            Data;
        UserId ->
            MemberMap = member_map(Data),
            ExistingMember = maps:get(UserId, MemberMap, undefined),
            ExistingRoles = member_role_ids(ExistingMember),
            UpdatedRoles = member_role_ids(Member),
            RoleIndex = member_role_index(Data),
            RoleIndex1 = remove_user_from_member_role_index(UserId, ExistingRoles, RoleIndex),
            RoleIndex2 = add_user_to_member_role_index(UserId, UpdatedRoles, RoleIndex1),
            Data1 = maps:put(<<"members">>, maps:put(UserId, Member, MemberMap), Data),
            maps:put(<<"member_role_index">>, RoleIndex2, Data1)
    end;
put_member(_, Data) ->
    Data.

-spec put_member_map(#{user_id() => member()}, guild_data()) -> guild_data().
put_member_map(MemberMap, Data) when is_map(MemberMap), is_map(Data) ->
    NormalizedMemberMap = normalize_member_map(MemberMap),
    Data1 = maps:put(<<"members">>, NormalizedMemberMap, Data),
    maps:put(<<"member_role_index">>, build_member_role_index(NormalizedMemberMap), Data1);
put_member_map(_, Data) ->
    Data.

-spec put_member_list([member()], guild_data()) -> guild_data().
put_member_list(Members, Data) when is_list(Members), is_map(Data) ->
    put_member_map(build_member_map(Members), Data);
put_member_list(_, Data) ->
    Data.

-spec remove_member(user_id(), guild_data()) -> guild_data().
remove_member(UserId, Data) when is_integer(UserId), is_map(Data) ->
    MemberMap = member_map(Data),
    Member = maps:get(UserId, MemberMap, undefined),
    MemberRoles = member_role_ids(Member),
    RoleIndex = member_role_index(Data),
    RoleIndex1 = remove_user_from_member_role_index(UserId, MemberRoles, RoleIndex),
    Data1 = maps:put(<<"members">>, maps:remove(UserId, MemberMap), Data),
    maps:put(<<"member_role_index">>, RoleIndex1, Data1);
remove_member(_, Data) ->
    Data.

-spec role_list(guild_data()) -> [role()].
role_list(Data) when is_map(Data) ->
    ensure_list(maps:get(<<"roles">>, Data, []));
role_list(_) ->
    [].

-spec role_index(guild_data()) -> #{snowflake_id() => role()}.
role_index(Data) when is_map(Data) ->
    case maps:get(<<"role_index">>, Data, undefined) of
        Index when is_map(Index) -> normalize_id_index(Index);
        _ -> build_id_index(role_list(Data))
    end;
role_index(_) ->
    #{}.

-spec put_roles([role()], guild_data()) -> guild_data().
put_roles(Roles, Data) when is_map(Data) ->
    RoleList = ensure_list(Roles),
    Data1 = maps:put(<<"roles">>, RoleList, Data),
    maps:put(<<"role_index">>, build_id_index(RoleList), Data1);
put_roles(_, Data) ->
    Data.

-spec channel_list(guild_data()) -> [channel()].
channel_list(Data) when is_map(Data) ->
    ensure_list(maps:get(<<"channels">>, Data, []));
channel_list(_) ->
    [].

-spec channel_index(guild_data()) -> #{snowflake_id() => channel()}.
channel_index(Data) when is_map(Data) ->
    case maps:get(<<"channel_index">>, Data, undefined) of
        Index when is_map(Index) -> normalize_id_index(Index);
        _ -> build_id_index(channel_list(Data))
    end;
channel_index(_) ->
    #{}.

-spec put_channels([channel()], guild_data()) -> guild_data().
put_channels(Channels, Data) when is_map(Data) ->
    ChannelList = ensure_list(Channels),
    Data1 = maps:put(<<"channels">>, ChannelList, Data),
    maps:put(<<"channel_index">>, build_id_index(ChannelList), Data1);
put_channels(_, Data) ->
    Data.

-spec build_member_map([member()]) -> #{user_id() => member()}.
build_member_map(Members) ->
    lists:foldl(
        fun(Member, Acc) ->
            case member_user_id(Member) of
                undefined ->
                    Acc;
                UserId ->
                    maps:put(UserId, Member, Acc)
            end
        end,
        #{},
        Members
    ).

-spec normalize_member_map(map()) -> #{user_id() => member()}.
normalize_member_map(MemberMap) ->
    maps:fold(
        fun(Key, Member, Acc) ->
            case normalize_member_key(Key, Member) of
                undefined ->
                    Acc;
                UserId ->
                    maps:put(UserId, Member, Acc)
            end
        end,
        #{},
        MemberMap
    ).

-spec normalize_member_key(term(), member()) -> user_id() | undefined.
normalize_member_key(Key, Member) ->
    case type_conv:to_integer(Key) of
        undefined -> member_user_id(Member);
        UserId -> UserId
    end.

-spec member_user_id(member()) -> user_id() | undefined.
member_user_id(Member) when is_map(Member) ->
    User = maps:get(<<"user">>, Member, #{}),
    map_utils:get_integer(User, <<"id">>, undefined);
member_user_id(_) ->
    undefined.

-spec member_role_ids(term()) -> [snowflake_id()].
member_role_ids(Member) when is_map(Member) ->
    extract_integer_list(maps:get(<<"roles">>, Member, []));
member_role_ids(_) ->
    [].

-spec build_member_role_index(#{user_id() => member()}) -> role_member_index().
build_member_role_index(MemberMap) ->
    maps:fold(
        fun(UserId, Member, Acc) ->
            add_user_to_member_role_index(UserId, member_role_ids(Member), Acc)
        end,
        #{},
        MemberMap
    ).

-spec normalize_member_role_index(map()) -> role_member_index().
normalize_member_role_index(Index) ->
    maps:fold(
        fun(RoleKey, Members, Acc) ->
            case type_conv:to_integer(RoleKey) of
                undefined ->
                    Acc;
                RoleId ->
                    NormalizedMembers = normalize_member_role_members(Members),
                    case map_size(NormalizedMembers) of
                        0 ->
                            Acc;
                        _ ->
                            maps:put(RoleId, NormalizedMembers, Acc)
                    end
            end
        end,
        #{},
        Index
    ).

-spec normalize_member_role_members(term()) -> #{user_id() => true}.
normalize_member_role_members(Members) when is_map(Members) ->
    maps:fold(
        fun(UserKey, _Flag, Acc) ->
            case type_conv:to_integer(UserKey) of
                undefined ->
                    Acc;
                UserId ->
                    maps:put(UserId, true, Acc)
            end
        end,
        #{},
        Members
    );
normalize_member_role_members(_) ->
    #{}.

-spec add_user_to_member_role_index(user_id(), [snowflake_id()], role_member_index()) ->
    role_member_index().
add_user_to_member_role_index(UserId, RoleIds, RoleIndex) when is_integer(UserId) ->
    lists:foldl(
        fun(RoleId, Acc) ->
            RoleMembers = maps:get(RoleId, Acc, #{}),
            maps:put(RoleId, maps:put(UserId, true, RoleMembers), Acc)
        end,
        RoleIndex,
        RoleIds
    ).

-spec remove_user_from_member_role_index(user_id(), [snowflake_id()], role_member_index()) ->
    role_member_index().
remove_user_from_member_role_index(UserId, RoleIds, RoleIndex) when is_integer(UserId) ->
    lists:foldl(
        fun(RoleId, Acc) ->
            RoleMembers = maps:get(RoleId, Acc, #{}),
            UpdatedRoleMembers = maps:remove(UserId, RoleMembers),
            case map_size(UpdatedRoleMembers) of
                0 ->
                    maps:remove(RoleId, Acc);
                _ ->
                    maps:put(RoleId, UpdatedRoleMembers, Acc)
            end
        end,
        RoleIndex,
        RoleIds
    ).

-spec build_id_index([map()]) -> #{snowflake_id() => map()}.
build_id_index(Items) ->
    lists:foldl(
        fun(Item, Acc) ->
            case map_utils:get_integer(Item, <<"id">>, undefined) of
                undefined ->
                    Acc;
                Id ->
                    maps:put(Id, Item, Acc)
            end
        end,
        #{},
        Items
    ).

-spec normalize_id_index(map()) -> #{snowflake_id() => map()}.
normalize_id_index(Index) ->
    maps:fold(
        fun(Key, Item, Acc) ->
            case type_conv:to_integer(Key) of
                undefined ->
                    case map_utils:get_integer(Item, <<"id">>, undefined) of
                        undefined -> Acc;
                        Id -> maps:put(Id, Item, Acc)
                    end;
                Id ->
                    maps:put(Id, Item, Acc)
            end
        end,
        #{},
        Index
    ).

-spec ensure_list(term()) -> list().
ensure_list(List) when is_list(List) ->
    List;
ensure_list(_) ->
    [].

-spec extract_integer_list(term()) -> [integer()].
extract_integer_list(List) when is_list(List) ->
    lists:reverse(
        lists:foldl(
            fun(Value, Acc) ->
                case type_conv:to_integer(Value) of
                    undefined -> Acc;
                    Int -> [Int | Acc]
                end
            end,
            [],
            List
        )
    );
extract_integer_list(_) ->
    [].

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").

member_map_from_list_test() ->
    Data = #{
        <<"members">> => [
            #{<<"user">> => #{<<"id">> => <<"2">>}, <<"nick">> => <<"beta">>},
            #{<<"user">> => #{<<"id">> => <<"1">>}, <<"nick">> => <<"alpha">>}
        ]
    },
    MemberMap = member_map(Data),
    ?assertMatch(#{1 := _, 2 := _}, MemberMap),
    ?assertEqual(2, member_count(Data)).

member_list_is_sorted_test() ->
    Data = #{
        <<"members">> => #{
            5 => #{<<"user">> => #{<<"id">> => <<"5">>}},
            2 => #{<<"user">> => #{<<"id">> => <<"2">>}}
        }
    },
    [First, Second] = member_list(Data),
    ?assertEqual(2, member_user_id(First)),
    ?assertEqual(5, member_user_id(Second)).

member_values_returns_members_without_sorting_test() ->
    Data = #{
        <<"members">> => #{
            9 => #{<<"user">> => #{<<"id">> => <<"9">>}},
            2 => #{<<"user">> => #{<<"id">> => <<"2">>}}
        }
    },
    Values = member_values(Data),
    ?assertEqual(2, length(Values)).

put_member_updates_entry_test() ->
    Data = #{
        <<"members">> => #{
            10 => #{<<"user">> => #{<<"id">> => <<"10">>}, <<"nick">> => <<"old">>}
        }
    },
    UpdatedData = put_member(
        #{<<"user">> => #{<<"id">> => <<"10">>}, <<"nick">> => <<"new">>},
        Data
    ),
    UpdatedMember = get_member(10, UpdatedData),
    ?assertEqual(<<"new">>, maps:get(<<"nick">>, UpdatedMember)).

remove_member_removes_entry_test() ->
    Data = #{
        <<"members">> => #{
            10 => #{<<"user">> => #{<<"id">> => <<"10">>}}
        }
    },
    UpdatedData = remove_member(10, Data),
    ?assertEqual(undefined, get_member(10, UpdatedData)).

normalize_data_builds_indexes_test() ->
    Data = #{
        <<"members">> => [#{<<"user">> => #{<<"id">> => <<"1">>}}],
        <<"roles">> => [#{<<"id">> => <<"100">>}],
        <<"channels">> => [#{<<"id">> => <<"200">>}]
    },
    Normalized = normalize_data(Data),
    ?assert(is_map(maps:get(<<"members">>, Normalized))),
    ?assertMatch(#{100 := _}, role_index(Normalized)),
    ?assertMatch(#{200 := _}, channel_index(Normalized)).

member_role_index_builds_role_to_user_lookup_test() ->
    Data = #{
        <<"members">> => #{
            1 => #{<<"user">> => #{<<"id">> => <<"1">>}, <<"roles">> => [<<"10">>, <<"11">>]},
            2 => #{<<"user">> => #{<<"id">> => <<"2">>}, <<"roles">> => [<<"11">>]}
        }
    },
    Index = member_role_index(Data),
    ?assertEqual(#{1 => true}, maps:get(10, Index)),
    ?assertEqual(#{1 => true, 2 => true}, maps:get(11, Index)).

put_member_and_remove_member_keep_member_role_index_in_sync_test() ->
    Data0 = #{
        <<"members">> => #{
            3 => #{<<"user">> => #{<<"id">> => <<"3">>}, <<"roles">> => [<<"20">>]}
        }
    },
    Data1 = put_member(
        #{<<"user">> => #{<<"id">> => <<"3">>}, <<"roles">> => [<<"30">>]},
        Data0
    ),
    Index1 = member_role_index(Data1),
    ?assertEqual(undefined, maps:get(20, Index1, undefined)),
    ?assertEqual(#{3 => true}, maps:get(30, Index1)),
    Data2 = remove_member(3, Data1),
    Index2 = member_role_index(Data2),
    ?assertEqual(undefined, maps:get(30, Index2, undefined)).

-endif.
