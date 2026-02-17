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

-module(push_cache).

-export([update_lru/2]).
-export([get_user_push_subscriptions/2]).
-export([cache_user_subscriptions/3]).
-export([get_user_badge_count/2]).
-export([cache_user_badge_count/4]).
-export([estimate_subscriptions_size/1]).
-export([evict_if_needed/4]).
-export([invalidate_user_badge_count/2]).

-spec update_lru(term(), list()) -> list().
update_lru(Key, Lru) ->
    NewLru = lists:delete(Key, Lru),
    [Key | NewLru].

-spec get_user_push_subscriptions(integer(), map()) -> list().
get_user_push_subscriptions(UserId, State) ->
    Key = {subscriptions, UserId},
    PushSubscriptionsCache = maps:get(push_subscriptions_cache, State, #{}),
    maps:get(Key, PushSubscriptionsCache, []).

-spec cache_user_subscriptions(integer(), list(), map()) -> map().
cache_user_subscriptions(UserId, Subscriptions, State) ->
    Key = {subscriptions, UserId},
    NewSubsSize = estimate_subscriptions_size(Subscriptions),
    OldSubsSize =
        case maps:get(Key, maps:get(push_subscriptions_cache, State, #{}), undefined) of
            undefined -> 0;
            OldSubs -> estimate_subscriptions_size(OldSubs)
        end,
    SizeDelta = NewSubsSize - OldSubsSize,
    PushSubscriptionsLru = maps:get(push_subscriptions_lru, State, []),
    NewLru = update_lru(Key, PushSubscriptionsLru),
    PushSubscriptionsCache = maps:get(push_subscriptions_cache, State, #{}),
    NewCache = maps:put(Key, Subscriptions, PushSubscriptionsCache),
    PushSubscriptionsSize = maps:get(push_subscriptions_size, State, 0),
    NewSize = PushSubscriptionsSize + SizeDelta,
    MaxBytes =
        case maps:get(push_subscriptions_max_mb, State, undefined) of
            undefined -> NewSize;
            Mb -> Mb * 1024 * 1024
        end,
    {FinalCache, FinalLru, FinalSize} = evict_if_needed(NewCache, NewLru, NewSize, MaxBytes),
    State#{
        push_subscriptions_cache => FinalCache,
        push_subscriptions_lru => FinalLru,
        push_subscriptions_size => FinalSize
    }.

-spec get_user_badge_count(integer(), map()) -> {non_neg_integer(), integer()} | undefined.
get_user_badge_count(UserId, State) ->
    Key = {badge_count, UserId},
    BadgeCountsCache = maps:get(badge_counts_cache, State, #{}),
    maps:get(Key, BadgeCountsCache, undefined).

-spec cache_user_badge_count(integer(), non_neg_integer(), integer(), map()) -> map().
cache_user_badge_count(UserId, BadgeCount, CachedAt, State) ->
    Key = {badge_count, UserId},
    NewBadge = {BadgeCount, CachedAt},
    OldBadgeSize =
        case maps:get(Key, maps:get(badge_counts_cache, State, #{}), undefined) of
            undefined -> 0;
            OldBadge -> estimate_badge_count_size(OldBadge)
        end,
    NewBadgeSize = estimate_badge_count_size(NewBadge),
    SizeDelta = NewBadgeSize - OldBadgeSize,
    BadgeCountsLru = maps:get(badge_counts_lru, State, []),
    NewLru = update_lru(Key, BadgeCountsLru),
    BadgeCountsCache = maps:get(badge_counts_cache, State, #{}),
    NewCache = maps:put(Key, NewBadge, BadgeCountsCache),
    BadgeCountsSize = maps:get(badge_counts_size, State, 0),
    NewSize = BadgeCountsSize + SizeDelta,
    MaxBytes =
        case maps:get(badge_counts_max_mb, State, undefined) of
            undefined -> NewSize;
            Mb -> Mb * 1024 * 1024
        end,
    {FinalCache, FinalLru, FinalSize} = evict_if_needed(NewCache, NewLru, NewSize, MaxBytes),
    State#{
        badge_counts_cache => FinalCache,
        badge_counts_lru => FinalLru,
        badge_counts_size => FinalSize
    }.

-spec estimate_subscriptions_size(list()) -> non_neg_integer().
estimate_subscriptions_size(Subscriptions) ->
    length(Subscriptions) * 200.

-spec estimate_badge_count_size({non_neg_integer(), integer()}) -> non_neg_integer().
estimate_badge_count_size({_Count, _Timestamp}) ->
    64.

-spec evict_if_needed(map(), list(), non_neg_integer(), non_neg_integer()) ->
    {map(), list(), non_neg_integer()}.
evict_if_needed(Cache, Lru, Size, MaxBytes) when Size > MaxBytes ->
    evict_oldest(Cache, Lru, Size, MaxBytes, lists:reverse(Lru));
evict_if_needed(Cache, Lru, Size, _MaxBytes) ->
    {Cache, Lru, Size}.

-spec evict_oldest(map(), list(), non_neg_integer(), non_neg_integer(), list()) ->
    {map(), list(), non_neg_integer()}.
evict_oldest(Cache, Lru, Size, _MaxBytes, []) ->
    {Cache, Lru, Size};
evict_oldest(Cache, Lru, Size, MaxBytes, [OldestKey | Remaining]) ->
    case maps:get(OldestKey, Cache, undefined) of
        undefined ->
            evict_oldest(Cache, Lru, Size, MaxBytes, Remaining);
        OldSubs ->
            NewCache = maps:remove(OldestKey, Cache),
            NewSize = Size - estimate_subscriptions_size(OldSubs),
            NewLru = lists:delete(OldestKey, Lru),
            evict_if_needed(NewCache, NewLru, NewSize, MaxBytes)
    end.

-spec invalidate_user_badge_count(integer(), map()) -> map().
invalidate_user_badge_count(UserId, State) ->
    Key = {badge_count, UserId},
    BadgeCountsCache = maps:get(badge_counts_cache, State, #{}),
    case maps:get(Key, BadgeCountsCache, undefined) of
        undefined ->
            State;
        Badge ->
            NewCache = maps:remove(Key, BadgeCountsCache),
            BadgeCountsLru = lists:delete(Key, maps:get(badge_counts_lru, State, [])),
            BadgeCountsSize = maps:get(badge_counts_size, State, 0),
            NewSize = max(0, BadgeCountsSize - estimate_badge_count_size(Badge)),
            State#{
                badge_counts_cache => NewCache,
                badge_counts_lru => BadgeCountsLru,
                badge_counts_size => NewSize
            }
    end.

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").

update_lru_test() ->
    ?assertEqual([a], update_lru(a, [])),
    ?assertEqual([b, a], update_lru(b, [a])),
    ?assertEqual([a, b, c], update_lru(a, [b, a, c])).

estimate_subscriptions_size_test() ->
    ?assertEqual(0, estimate_subscriptions_size([])),
    ?assertEqual(200, estimate_subscriptions_size([#{}])),
    ?assertEqual(400, estimate_subscriptions_size([#{}, #{}])).

estimate_badge_count_size_test() ->
    ?assertEqual(64, estimate_badge_count_size({0, 0})),
    ?assertEqual(64, estimate_badge_count_size({100, 12345})).

evict_if_needed_no_eviction_test() ->
    Cache = #{a => [1, 2]},
    Lru = [a],
    {ResultCache, ResultLru, ResultSize} = evict_if_needed(Cache, Lru, 400, 1000),
    ?assertEqual(Cache, ResultCache),
    ?assertEqual(Lru, ResultLru),
    ?assertEqual(400, ResultSize).

get_user_push_subscriptions_test() ->
    State = #{push_subscriptions_cache => #{{subscriptions, 123} => [sub1, sub2]}},
    ?assertEqual([sub1, sub2], get_user_push_subscriptions(123, State)),
    ?assertEqual([], get_user_push_subscriptions(999, State)).

get_user_badge_count_test() ->
    State = #{badge_counts_cache => #{{badge_count, 123} => {5, 1000}}},
    ?assertEqual({5, 1000}, get_user_badge_count(123, State)),
    ?assertEqual(undefined, get_user_badge_count(999, State)).

-endif.
