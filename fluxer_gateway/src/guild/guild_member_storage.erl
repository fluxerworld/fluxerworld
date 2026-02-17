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

-module(guild_member_storage).

-export([
    new/0,
    insert_member/2,
    remove_member/2,
    get_member/2,
    get_members_by_ids/2,
    search_members/3,
    get_range/3,
    count/1,
    compute_list_id/1
]).

-type storage() :: #{
    members_table := ets:tid(),
    display_name_index := gb_trees:tree({binary(), user_id()}, user_id())
}.
-type user_id() :: integer().
-type member() :: map().
-type index_key() :: {binary(), user_id()}.

-export_type([storage/0]).

-spec new() -> storage().
new() ->
    MembersTable = ets:new(members, [set, private, {read_concurrency, true}]),
    DisplayNameIndex = gb_trees:empty(),
    #{
        members_table => MembersTable,
        display_name_index => DisplayNameIndex
    }.

-spec insert_member(member(), storage()) -> storage().
insert_member(Member, Storage) ->
    case extract_user_id(Member) of
        undefined ->
            Storage;
        UserId ->
            OldMember = get_member(UserId, Storage),
            Storage1 = remove_from_index(OldMember, Storage),
            #{members_table := MembersTable} = Storage1,
            ets:insert(MembersTable, {UserId, Member}),
            add_to_index(UserId, Member, Storage1)
    end.

-spec remove_member(user_id(), storage()) -> storage().
remove_member(UserId, Storage) ->
    case get_member(UserId, Storage) of
        undefined ->
            Storage;
        Member ->
            Storage1 = remove_from_index(Member, Storage),
            #{members_table := MembersTable} = Storage1,
            ets:delete(MembersTable, UserId),
            Storage1
    end.

-spec get_member(user_id(), storage()) -> member() | undefined.
get_member(UserId, Storage) ->
    #{members_table := MembersTable} = Storage,
    case ets:lookup(MembersTable, UserId) of
        [{UserId, Member}] -> Member;
        [] -> undefined
    end.

-spec get_members_by_ids([user_id()], storage()) -> [member()].
get_members_by_ids(UserIds, Storage) ->
    lists:filtermap(
        fun(UserId) ->
            case get_member(UserId, Storage) of
                undefined -> false;
                Member -> {true, Member}
            end
        end,
        UserIds
    ).

-spec search_members(binary(), non_neg_integer(), storage()) -> [member()].
search_members(Query, Limit, Storage) when is_binary(Query), Limit > 0 ->
    NormalizedQuery = normalize_display_name(Query),
    case NormalizedQuery of
        <<>> -> [];
        _ -> search_by_prefix(NormalizedQuery, Limit, Storage)
    end;
search_members(_, _, _) ->
    [].

-spec get_range(non_neg_integer(), non_neg_integer(), storage()) -> [member()].
get_range(Offset, Limit, Storage) when is_integer(Offset), is_integer(Limit), Limit > 0 ->
    #{display_name_index := Index} = Storage,
    Size = gb_trees:size(Index),
    case Offset >= Size of
        true -> [];
        false -> get_range_from_index(Offset, Limit, Size, Index, Storage)
    end;
get_range(_, _, _) ->
    [].

-spec get_range_from_index(
    non_neg_integer(), non_neg_integer(), non_neg_integer(), gb_trees:tree(), storage()
) ->
    [member()].
get_range_from_index(Offset, Limit, Size, Index, Storage) ->
    AllKeys = gb_trees:keys(Index),
    EndIdx = min(Offset + Limit, Size),
    SelectedKeys = lists:sublist(AllKeys, Offset + 1, EndIdx - Offset),
    lists:filtermap(
        fun(Key) ->
            UserId = gb_trees:get(Key, Index),
            case get_member(UserId, Storage) of
                undefined -> false;
                Member -> {true, Member}
            end
        end,
        SelectedKeys
    ).

-spec count(storage()) -> non_neg_integer().
count(Storage) ->
    #{members_table := MembersTable} = Storage,
    ets:info(MembersTable, size).

-spec compute_list_id([user_id()]) -> integer().
compute_list_id(UserIds) ->
    SortedIds = lists:sort(UserIds),
    Combined = lists:foldl(
        fun(Id, Acc) -> <<Acc/binary, (integer_to_binary(Id))/binary, ",">> end,
        <<>>,
        SortedIds
    ),
    erlang:phash2(Combined, 16#FFFFFFFF).

-spec extract_user_id(member()) -> user_id() | undefined.
extract_user_id(Member) when is_map(Member) ->
    User = maps:get(<<"user">>, Member, #{}),
    map_utils:get_integer(User, <<"id">>, undefined);
extract_user_id(_) ->
    undefined.

-spec get_display_name(member()) -> binary().
get_display_name(Member) when is_map(Member) ->
    case maps:get(<<"nick">>, Member, undefined) of
        undefined -> get_display_name_from_user(Member);
        Nick -> Nick
    end.

-spec get_display_name_from_user(member()) -> binary().
get_display_name_from_user(Member) ->
    User = maps:get(<<"user">>, Member, #{}),
    case maps:get(<<"global_name">>, User, undefined) of
        undefined -> maps:get(<<"username">>, User, <<>>);
        GlobalName -> GlobalName
    end.

-spec normalize_display_name(binary()) -> binary().
normalize_display_name(Name) when is_binary(Name) ->
    LowerName = string:lowercase(binary_to_list(Name)),
    list_to_binary(LowerName).

-spec add_to_index(user_id(), member(), storage()) -> storage().
add_to_index(UserId, Member, Storage) ->
    DisplayName = get_display_name(Member),
    NormalizedName = normalize_display_name(DisplayName),
    Key = make_index_key(NormalizedName, UserId),
    #{display_name_index := Index} = Storage,
    NewIndex = gb_trees:enter(Key, UserId, Index),
    Storage#{display_name_index => NewIndex}.

-spec remove_from_index(member() | undefined, storage()) -> storage().
remove_from_index(undefined, Storage) ->
    Storage;
remove_from_index(Member, Storage) ->
    UserId = extract_user_id(Member),
    DisplayName = get_display_name(Member),
    NormalizedName = normalize_display_name(DisplayName),
    Key = make_index_key(NormalizedName, UserId),
    #{display_name_index := Index} = Storage,
    case gb_trees:is_defined(Key, Index) of
        true ->
            NewIndex = gb_trees:delete(Key, Index),
            Storage#{display_name_index => NewIndex};
        false ->
            Storage
    end.

-spec make_index_key(binary(), user_id()) -> index_key().
make_index_key(NormalizedName, UserId) ->
    {NormalizedName, UserId}.

-spec search_by_prefix(binary(), non_neg_integer(), storage()) -> [member()].
search_by_prefix(Prefix, Limit, Storage) ->
    #{display_name_index := Index} = Storage,
    AllKeys = gb_trees:keys(Index),
    PrefixLen = byte_size(Prefix),
    Matches = find_prefix_matches(AllKeys, Prefix, PrefixLen, Storage, []),
    lists:sublist(Matches, Limit).

-spec find_prefix_matches([index_key()], binary(), non_neg_integer(), storage(), [member()]) ->
    [member()].
find_prefix_matches([], _Prefix, _PrefixLen, _Storage, Acc) ->
    lists:reverse(Acc);
find_prefix_matches([{Name, UserId} | Rest], Prefix, PrefixLen, Storage, Acc) ->
    case Name of
        <<Prefix:PrefixLen/binary, _/binary>> ->
            case get_member(UserId, Storage) of
                undefined ->
                    find_prefix_matches(Rest, Prefix, PrefixLen, Storage, Acc);
                Member ->
                    find_prefix_matches(Rest, Prefix, PrefixLen, Storage, [Member | Acc])
            end;
        _ ->
            find_prefix_matches(Rest, Prefix, PrefixLen, Storage, Acc)
    end.

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").

new_creates_empty_storage_test() ->
    Storage = new(),
    ?assertEqual(0, count(Storage)).

insert_and_get_member_test() ->
    Storage = new(),
    Member = #{
        <<"user">> => #{
            <<"id">> => <<"123">>,
            <<"username">> => <<"testuser">>
        },
        <<"roles">> => []
    },
    Storage1 = insert_member(Member, Storage),
    ?assertEqual(1, count(Storage1)),
    Retrieved = get_member(123, Storage1),
    ?assertEqual(Member, Retrieved).

remove_member_test() ->
    Storage = new(),
    Member = #{
        <<"user">> => #{
            <<"id">> => <<"123">>,
            <<"username">> => <<"testuser">>
        }
    },
    Storage1 = insert_member(Member, Storage),
    Storage2 = remove_member(123, Storage1),
    ?assertEqual(0, count(Storage2)),
    ?assertEqual(undefined, get_member(123, Storage2)).

get_members_by_ids_test() ->
    Storage = new(),
    Member1 = #{<<"user">> => #{<<"id">> => <<"1">>, <<"username">> => <<"alice">>}},
    Member2 = #{<<"user">> => #{<<"id">> => <<"2">>, <<"username">> => <<"bob">>}},
    Storage1 = insert_member(Member1, Storage),
    Storage2 = insert_member(Member2, Storage1),
    Members = get_members_by_ids([1, 2, 999], Storage2),
    ?assertEqual(2, length(Members)).

search_members_by_prefix_test() ->
    Storage = new(),
    Member1 = #{<<"user">> => #{<<"id">> => <<"1">>, <<"username">> => <<"alice">>}},
    Member2 = #{<<"user">> => #{<<"id">> => <<"2">>, <<"username">> => <<"bob">>}},
    Member3 = #{<<"user">> => #{<<"id">> => <<"3">>, <<"username">> => <<"alicia">>}},
    Storage1 = insert_member(Member1, Storage),
    Storage2 = insert_member(Member2, Storage1),
    Storage3 = insert_member(Member3, Storage2),
    Results = search_members(<<"ali">>, 10, Storage3),
    ?assertEqual(2, length(Results)).

display_name_nick_priority_test() ->
    Member = #{
        <<"user">> => #{
            <<"id">> => <<"1">>,
            <<"username">> => <<"user">>,
            <<"global_name">> => <<"Global">>
        },
        <<"nick">> => <<"Nickname">>
    },
    ?assertEqual(<<"Nickname">>, get_display_name(Member)).

display_name_global_name_fallback_test() ->
    Member = #{
        <<"user">> => #{
            <<"id">> => <<"1">>,
            <<"username">> => <<"user">>,
            <<"global_name">> => <<"Global">>
        }
    },
    ?assertEqual(<<"Global">>, get_display_name(Member)).

display_name_username_fallback_test() ->
    Member = #{
        <<"user">> => #{
            <<"id">> => <<"1">>,
            <<"username">> => <<"user">>
        }
    },
    ?assertEqual(<<"user">>, get_display_name(Member)).

compute_list_id_deterministic_test() ->
    Id1 = compute_list_id([1, 2, 3]),
    Id2 = compute_list_id([3, 2, 1]),
    ?assertEqual(Id1, Id2).

compute_list_id_different_for_different_lists_test() ->
    Id1 = compute_list_id([1, 2, 3]),
    Id2 = compute_list_id([1, 2, 4]),
    ?assertNotEqual(Id1, Id2).

get_range_test() ->
    Storage = new(),
    Member1 = #{<<"user">> => #{<<"id">> => <<"1">>, <<"username">> => <<"alice">>}},
    Member2 = #{<<"user">> => #{<<"id">> => <<"2">>, <<"username">> => <<"bob">>}},
    Member3 = #{<<"user">> => #{<<"id">> => <<"3">>, <<"username">> => <<"charlie">>}},
    Storage1 = insert_member(Member1, Storage),
    Storage2 = insert_member(Member2, Storage1),
    Storage3 = insert_member(Member3, Storage2),
    Results = get_range(1, 2, Storage3),
    ?assertEqual(2, length(Results)).

get_range_offset_beyond_size_test() ->
    Storage = new(),
    Member1 = #{<<"user">> => #{<<"id">> => <<"1">>, <<"username">> => <<"alice">>}},
    Storage1 = insert_member(Member1, Storage),
    Results = get_range(10, 5, Storage1),
    ?assertEqual([], Results).

search_members_empty_query_test() ->
    Storage = new(),
    Member1 = #{<<"user">> => #{<<"id">> => <<"1">>, <<"username">> => <<"alice">>}},
    Storage1 = insert_member(Member1, Storage),
    Results = search_members(<<>>, 10, Storage1),
    ?assertEqual([], Results).

search_members_limit_test() ->
    Storage = new(),
    Member1 = #{<<"user">> => #{<<"id">> => <<"1">>, <<"username">> => <<"aaa">>}},
    Member2 = #{<<"user">> => #{<<"id">> => <<"2">>, <<"username">> => <<"aab">>}},
    Member3 = #{<<"user">> => #{<<"id">> => <<"3">>, <<"username">> => <<"aac">>}},
    Storage1 = insert_member(Member1, Storage),
    Storage2 = insert_member(Member2, Storage1),
    Storage3 = insert_member(Member3, Storage2),
    Results = search_members(<<"aa">>, 2, Storage3),
    ?assertEqual(2, length(Results)).

normalize_display_name_test() ->
    ?assertEqual(<<"hello">>, normalize_display_name(<<"HELLO">>)),
    ?assertEqual(<<"hello">>, normalize_display_name(<<"Hello">>)),
    ?assertEqual(<<"hello">>, normalize_display_name(<<"hello">>)).

insert_member_updates_index_test() ->
    Storage = new(),
    Member1 = #{<<"user">> => #{<<"id">> => <<"1">>, <<"username">> => <<"alice">>}},
    Storage1 = insert_member(Member1, Storage),
    Member2 = #{<<"user">> => #{<<"id">> => <<"1">>, <<"username">> => <<"bob">>}},
    Storage2 = insert_member(Member2, Storage1),
    ?assertEqual(1, count(Storage2)),
    AliceResults = search_members(<<"alice">>, 10, Storage2),
    ?assertEqual(0, length(AliceResults)),
    BobResults = search_members(<<"bob">>, 10, Storage2),
    ?assertEqual(1, length(BobResults)).

-endif.
