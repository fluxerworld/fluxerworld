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

-module(utils).

-export([
    binary_to_integer_safe/1,
    generate_session_id/0,
    generate_resume_token/0,
    hash_token/1,
    parse_status/1,
    safe_json_decode/1,
    check_user_data_differs/2,
    parse_iso8601_to_unix_ms/1
]).

-spec binary_to_integer_safe(binary() | integer() | term()) -> integer() | undefined.
binary_to_integer_safe(Int) when is_integer(Int) ->
    Int;
binary_to_integer_safe(Bin) when is_binary(Bin) ->
    try
        binary_to_integer(Bin)
    catch
        _:_ ->
            try
                list_to_integer(binary_to_list(Bin))
            catch
                _:_ -> undefined
            end
    end;
binary_to_integer_safe(_) ->
    undefined.

-spec generate_session_id() -> binary().
generate_session_id() ->
    Bytes = crypto:strong_rand_bytes(constants:random_session_bytes()),
    binary:encode_hex(Bytes).

-spec generate_resume_token() -> binary().
generate_resume_token() ->
    Bytes = crypto:strong_rand_bytes(32),
    base64url:encode(Bytes).

-spec hash_token(binary()) -> binary().
hash_token(Token) ->
    crypto:hash(sha256, Token).

-spec parse_status(binary() | atom() | term()) -> atom().
parse_status(Status) when is_binary(Status) ->
    constants:status_type_atom(Status);
parse_status(Status) when is_atom(Status) ->
    Status;
parse_status(_) ->
    online.

-spec safe_json_decode(binary()) -> map().
safe_json_decode(Bin) ->
    try
        json:decode(Bin)
    catch
        _:_ -> #{}
    end.

-spec parse_iso8601_to_unix_ms(binary() | term()) -> integer() | undefined.
parse_iso8601_to_unix_ms(Binary) when is_binary(Binary) ->
    Pattern =
        <<"^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2}):(\\d{2})(?:\\.(\\d{1,9}))?Z$">>,
    case re:run(Binary, Pattern, [{capture, [1, 2, 3, 4, 5, 6, 7], list}]) of
        {match, [YearBin, MonthBin, DayBin, HourBin, MinuteBin, SecondBin, FractionBin]} ->
            Year = type_conv:to_integer(YearBin),
            Month = type_conv:to_integer(MonthBin),
            Day = type_conv:to_integer(DayBin),
            Hour = type_conv:to_integer(HourBin),
            Minute = type_conv:to_integer(MinuteBin),
            Second = type_conv:to_integer(SecondBin),
            FractionMs = fractional_ms(FractionBin),
            case {Year, Month, Day, Hour, Minute, Second} of
                {Y, M, D, H, Min, S} when
                    is_integer(Y),
                    is_integer(M),
                    is_integer(D),
                    is_integer(H),
                    is_integer(Min),
                    is_integer(S)
                ->
                    Seconds = calendar:datetime_to_gregorian_seconds({{Y, M, D}, {H, Min, S}}),
                    Seconds * 1000 + FractionMs;
                _ ->
                    undefined
            end;
        _ ->
            undefined
    end;
parse_iso8601_to_unix_ms(_) ->
    undefined.

-spec fractional_ms(list()) -> non_neg_integer().
fractional_ms([]) ->
    0;
fractional_ms(Fraction) when is_list(Fraction) ->
    Normalized =
        case length(Fraction) of
            Len when Len >= 3 -> lists:sublist(Fraction, 3);
            Len when Len > 0 -> Fraction ++ lists:duplicate(3 - Len, $0);
            _ -> "000"
        end,
    case catch list_to_integer(Normalized) of
        {'EXIT', _} -> 0;
        Value -> Value
    end;
fractional_ms(_) ->
    0.

-spec check_user_data_differs(map(), map()) -> boolean().
check_user_data_differs(CurrentUserData, NewUserData) ->
    CheckedFields = user_utils:partial_user_fields(),
    lists:any(
        fun(Field) ->
            case maps:is_key(Field, NewUserData) of
                false ->
                    false;
                true ->
                    CurrentValue = maps:get(Field, CurrentUserData, undefined),
                    NewValue = maps:get(Field, NewUserData, undefined),
                    CurrentValue =/= NewValue
            end
        end,
        CheckedFields
    ).

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").

binary_to_integer_safe_integer_test() ->
    ?assertEqual(42, binary_to_integer_safe(42)),
    ?assertEqual(0, binary_to_integer_safe(0)),
    ?assertEqual(-100, binary_to_integer_safe(-100)).

binary_to_integer_safe_binary_test() ->
    ?assertEqual(123, binary_to_integer_safe(<<"123">>)),
    ?assertEqual(0, binary_to_integer_safe(<<"0">>)),
    ?assertEqual(-456, binary_to_integer_safe(<<"-456">>)).

binary_to_integer_safe_invalid_test() ->
    ?assertEqual(undefined, binary_to_integer_safe(<<"not_a_number">>)),
    ?assertEqual(undefined, binary_to_integer_safe(<<"12.34">>)),
    ?assertEqual(undefined, binary_to_integer_safe(<<"">>)),
    ?assertEqual(undefined, binary_to_integer_safe(atom)),
    ?assertEqual(undefined, binary_to_integer_safe(#{})).

generate_session_id_test() ->
    SessionId = generate_session_id(),
    ?assert(is_binary(SessionId)),
    ?assertEqual(32, byte_size(SessionId)).

generate_resume_token_test() ->
    Token = generate_resume_token(),
    ?assert(is_binary(Token)),
    ?assert(byte_size(Token) > 0).

hash_token_test() ->
    Hash = hash_token(<<"test_token">>),
    ?assert(is_binary(Hash)),
    ?assertEqual(32, byte_size(Hash)).

parse_status_binary_test() ->
    ?assertEqual(online, parse_status(<<"online">>)),
    ?assertEqual(dnd, parse_status(<<"dnd">>)),
    ?assertEqual(idle, parse_status(<<"idle">>)),
    ?assertEqual(invisible, parse_status(<<"invisible">>)),
    ?assertEqual(offline, parse_status(<<"offline">>)).

parse_status_atom_test() ->
    ?assertEqual(online, parse_status(online)),
    ?assertEqual(dnd, parse_status(dnd)),
    ?assertEqual(idle, parse_status(idle)).

parse_status_default_test() ->
    ?assertEqual(online, parse_status(123)),
    ?assertEqual(online, parse_status(#{})).

safe_json_decode_valid_test() ->
    Result = safe_json_decode(<<"{\"key\": \"value\"}">>),
    ?assertEqual(#{<<"key">> => <<"value">>}, Result).

safe_json_decode_invalid_test() ->
    ?assertEqual(#{}, safe_json_decode(<<"not json">>)),
    ?assertEqual(#{}, safe_json_decode(<<"">>)).

parse_iso8601_to_unix_ms_valid_test() ->
    Result = parse_iso8601_to_unix_ms(<<"2024-01-15T12:30:45Z">>),
    ?assert(is_integer(Result)),
    ?assert(Result > 0).

parse_iso8601_to_unix_ms_with_fraction_test() ->
    Result = parse_iso8601_to_unix_ms(<<"2024-01-15T12:30:45.123Z">>),
    ?assert(is_integer(Result)),
    ?assertEqual(123, Result rem 1000).

parse_iso8601_to_unix_ms_invalid_test() ->
    ?assertEqual(undefined, parse_iso8601_to_unix_ms(<<"invalid">>)),
    ?assertEqual(undefined, parse_iso8601_to_unix_ms(<<"2024-01-15">>)),
    ?assertEqual(undefined, parse_iso8601_to_unix_ms(123)).

check_user_data_differs_same_test() ->
    User = #{<<"id">> => <<"123">>, <<"username">> => <<"test">>},
    ?assertEqual(false, check_user_data_differs(User, User)).

check_user_data_differs_different_test() ->
    Current = #{<<"id">> => <<"123">>, <<"username">> => <<"test">>},
    New = #{<<"id">> => <<"123">>, <<"username">> => <<"changed">>},
    ?assertEqual(true, check_user_data_differs(Current, New)).

check_user_data_differs_missing_field_test() ->
    Current = #{<<"id">> => <<"123">>, <<"username">> => <<"test">>},
    New = #{<<"id">> => <<"123">>},
    ?assertEqual(false, check_user_data_differs(Current, New)).

check_user_data_differs_null_field_test() ->
    Current = #{<<"id">> => <<"123">>, <<"username">> => <<"test">>},
    New = #{<<"username">> => null},
    ?assertEqual(true, check_user_data_differs(Current, New)).

-endif.
