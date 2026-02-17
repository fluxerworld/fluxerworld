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

-module(guild_voice_unclaimed_account_utils).

-export([parse_unclaimed_error/1]).

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").
-endif.

-spec parse_unclaimed_error(iodata() | term()) -> boolean().
parse_unclaimed_error(Body) when is_binary(Body); is_list(Body) ->
    try json:decode(iolist_to_binary(Body)) of
        Map when is_map(Map) ->
            case get_unclaimed_error_code(Map) of
                Code when is_binary(Code) -> is_voice_unclaimed_error_code(Code);
                _ -> false
            end;
        _ ->
            false
    catch
        _:_ -> false
    end;
parse_unclaimed_error(_) ->
    false.

-spec get_unclaimed_error_code(map()) -> binary() | undefined.
get_unclaimed_error_code(Map) when is_map(Map) ->
    case maps:get(<<"code">>, Map, undefined) of
        Code when is_binary(Code) ->
            Code;
        _ ->
            case maps:get(<<"error">>, Map, undefined) of
                Error when is_map(Error) ->
                    maps:get(<<"code">>, Error, undefined);
                _ ->
                    undefined
            end
    end.

-spec is_voice_unclaimed_error_code(binary()) -> boolean().
is_voice_unclaimed_error_code(Code) when is_binary(Code) ->
    lists:member(
        Code,
        [
            <<"UNCLAIMED_ACCOUNT_CANNOT_JOIN_ONE_ON_ONE_VOICE_CALLS">>,
            <<"UNCLAIMED_ACCOUNT_CANNOT_JOIN_VOICE_CHANNELS">>
        ]
    ).

-ifdef(TEST).

parse_unclaimed_error_with_direct_code_test() ->
    Body = json:encode(#{<<"code">> => <<"UNCLAIMED_ACCOUNT_CANNOT_JOIN_VOICE_CHANNELS">>}),
    ?assertEqual(true, parse_unclaimed_error(Body)).

parse_unclaimed_error_with_nested_code_test() ->
    Body = json:encode(#{
        <<"error">> => #{<<"code">> => <<"UNCLAIMED_ACCOUNT_CANNOT_JOIN_ONE_ON_ONE_VOICE_CALLS">>}
    }),
    ?assertEqual(true, parse_unclaimed_error(Body)).

parse_unclaimed_error_with_unknown_code_test() ->
    Body = json:encode(#{<<"code">> => <<"SOME_OTHER_ERROR">>}),
    ?assertEqual(false, parse_unclaimed_error(Body)).

parse_unclaimed_error_with_invalid_json_test() ->
    ?assertEqual(false, parse_unclaimed_error(<<"not json">>)).

parse_unclaimed_error_with_non_binary_test() ->
    ?assertEqual(false, parse_unclaimed_error(undefined)),
    ?assertEqual(false, parse_unclaimed_error(123)).

is_voice_unclaimed_error_code_test() ->
    ?assertEqual(
        true, is_voice_unclaimed_error_code(<<"UNCLAIMED_ACCOUNT_CANNOT_JOIN_VOICE_CHANNELS">>)
    ),
    ?assertEqual(
        true,
        is_voice_unclaimed_error_code(<<"UNCLAIMED_ACCOUNT_CANNOT_JOIN_ONE_ON_ONE_VOICE_CALLS">>)
    ),
    ?assertEqual(false, is_voice_unclaimed_error_code(<<"OTHER_ERROR">>)).

-endif.
