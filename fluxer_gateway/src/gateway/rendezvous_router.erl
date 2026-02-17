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

-module(rendezvous_router).

-export([select/2, group_keys/2]).

-define(HASH_LIMIT, 16#FFFFFFFF).

-spec select(term(), pos_integer()) -> non_neg_integer().
select(Key, ShardCount) when ShardCount > 0 ->
    Indices = lists:seq(0, ShardCount - 1),
    {Index, _Weight} =
        lists:foldl(
            fun(CurrentIndex, {BestIndex, BestWeight}) ->
                Weight = weight(Key, CurrentIndex),
                case
                    (Weight > BestWeight) orelse
                        (Weight =:= BestWeight andalso CurrentIndex < BestIndex)
                of
                    true ->
                        {CurrentIndex, Weight};
                    false ->
                        {BestIndex, BestWeight}
                end
            end,
            {0, -1},
            Indices
        ),
    Index;
select(_Key, _ShardCount) ->
    0.

-spec group_keys([term()], pos_integer()) -> [{non_neg_integer(), [term()]}].
group_keys(Keys, ShardCount) when is_list(Keys), ShardCount > 0 ->
    Grouped =
        lists:foldl(
            fun(Key, Acc) ->
                Index = select(Key, ShardCount),
                Existing = maps:get(Index, Acc, []),
                maps:put(Index, [Key | Existing], Acc)
            end,
            #{},
            Keys
        ),
    Sorted = lists:sort(
        fun({IdxA, _}, {IdxB, _}) -> IdxA =< IdxB end,
        [{Index, lists:usort(Group)} || {Index, Group} <- maps:to_list(Grouped)]
    ),
    Sorted;
group_keys(_Keys, _ShardCount) ->
    [].

-spec weight(term(), non_neg_integer()) -> non_neg_integer().
weight(Key, Index) ->
    erlang:phash2({Key, Index}, ?HASH_LIMIT).

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").

select_single_shard_test() ->
    ?assertEqual(0, select(test_key, 1)),
    ?assertEqual(0, select(any_key, 1)),
    ?assertEqual(0, select(12345, 1)).

select_valid_index_test_() ->
    [
        ?_test(begin
            Index = select(test_key, N),
            ?assert(Index >= 0),
            ?assert(Index < N)
        end)
     || N <- [2, 5, 10, 100]
    ].

select_stability_test_() ->
    [
        ?_assertEqual(select(<<"abc">>, 8), select(<<"abc">>, 8)),
        ?_assertEqual(select(12345, 3), select(12345, 3)),
        ?_assertEqual(select({user, 1}, 10), select({user, 1}, 10))
    ].

select_distribution_test() ->
    Keys = lists:seq(1, 1000),
    ShardCount = 10,
    Distribution = lists:foldl(
        fun(Key, Acc) ->
            Index = select(Key, ShardCount),
            maps:update_with(Index, fun(V) -> V + 1 end, 1, Acc)
        end,
        #{},
        Keys
    ),
    Counts = maps:values(Distribution),
    ?assertEqual(ShardCount, maps:size(Distribution)),
    lists:foreach(fun(Count) -> ?assert(Count > 0) end, Counts).

group_keys_empty_test() ->
    ?assertEqual([], group_keys([], 4)).

group_keys_single_test() ->
    Groups = group_keys([key1], 4),
    ?assertEqual(1, length(Groups)).

group_keys_deduplicates_test() ->
    Keys = [1, 2, 3, 1, 2],
    Groups = group_keys(Keys, 2),
    lists:foreach(
        fun({_Index, GroupKeys}) ->
            ?assertEqual(GroupKeys, lists:usort(GroupKeys))
        end,
        Groups
    ).

group_keys_sorted_indices_test() ->
    Keys = lists:seq(1, 100),
    Groups = group_keys(Keys, 5),
    Indices = [I || {I, _} <- Groups],
    ?assertEqual(Indices, lists:sort(Indices)).

group_keys_all_keys_present_test() ->
    Keys = [a, b, c, d, e],
    Groups = group_keys(Keys, 3),
    AllGroupedKeys = lists:flatten([K || {_, K} <- Groups]),
    ?assertEqual(lists:sort(Keys), lists:sort(AllGroupedKeys)).

-endif.
