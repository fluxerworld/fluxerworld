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

-module(user_utils).

-export([normalize_user/1, partial_user_fields/0]).

-spec partial_user_fields() -> [binary()].
partial_user_fields() ->
    [
        <<"id">>,
        <<"username">>,
        <<"discriminator">>,
        <<"global_name">>,
        <<"avatar">>,
        <<"avatar_color">>,
        <<"bot">>,
        <<"system">>,
        <<"flags">>
    ].

-spec normalize_user(map() | term()) -> map().
normalize_user(User) when is_map(User) ->
    CleanPairs =
        lists:foldl(
            fun(Key, Acc) ->
                case maps:get(Key, User, undefined) of
                    undefined -> Acc;
                    Value -> [{Key, Value} | Acc]
                end
            end,
            [],
            partial_user_fields()
        ),
    maps:from_list(lists:reverse(CleanPairs));
normalize_user(_) ->
    #{}.

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").

normalize_user_valid_test() ->
    User = #{
        <<"id">> => <<"123">>,
        <<"username">> => <<"testuser">>,
        <<"discriminator">> => <<"0001">>,
        <<"email">> => <<"test@example.com">>
    },
    Result = normalize_user(User),
    ?assertEqual(<<"123">>, maps:get(<<"id">>, Result)),
    ?assertEqual(<<"testuser">>, maps:get(<<"username">>, Result)),
    ?assertEqual(<<"0001">>, maps:get(<<"discriminator">>, Result)),
    ?assertEqual(error, maps:find(<<"email">>, Result)).

normalize_user_all_fields_test() ->
    User = #{
        <<"id">> => <<"123">>,
        <<"username">> => <<"test">>,
        <<"discriminator">> => <<"0">>,
        <<"global_name">> => <<"Test User">>,
        <<"avatar">> => <<"abc123">>,
        <<"avatar_color">> => <<"#ff0000">>,
        <<"bot">> => false,
        <<"system">> => false,
        <<"flags">> => 0
    },
    Result = normalize_user(User),
    ?assertEqual(9, maps:size(Result)).

normalize_user_undefined_values_test() ->
    User = #{
        <<"id">> => <<"123">>,
        <<"username">> => <<"test">>,
        <<"avatar">> => undefined
    },
    Result = normalize_user(User),
    ?assertEqual(2, maps:size(Result)),
    ?assertEqual(error, maps:find(<<"avatar">>, Result)).

normalize_user_not_map_test() ->
    ?assertEqual(#{}, normalize_user(not_a_map)),
    ?assertEqual(#{}, normalize_user(123)),
    ?assertEqual(#{}, normalize_user(<<"binary">>)),
    ?assertEqual(#{}, normalize_user(undefined)).

normalize_user_empty_map_test() ->
    ?assertEqual(#{}, normalize_user(#{})).

partial_user_fields_test() ->
    Fields = partial_user_fields(),
    ?assert(is_list(Fields)),
    ?assertEqual(9, length(Fields)),
    ?assert(lists:member(<<"id">>, Fields)),
    ?assert(lists:member(<<"username">>, Fields)),
    ?assert(lists:member(<<"flags">>, Fields)).

-endif.
