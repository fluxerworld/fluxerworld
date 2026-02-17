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

-module(custom_status_validation).

-export([validate/2]).

-spec validate(integer(), map() | null) -> {ok, map() | null} | {error, term()}.
validate(_UserId, null) ->
    {ok, null};
validate(UserId, CustomStatus) when is_map(CustomStatus) ->
    Request = build_request(UserId, CustomStatus),
    rpc_client:call(Request).

-spec build_request(integer(), map()) -> map().
build_request(UserId, CustomStatus) ->
    #{
        <<"type">> => <<"validate_custom_status">>,
        <<"user_id">> => type_conv:to_binary(UserId),
        <<"custom_status">> => build_custom_status_payload(CustomStatus)
    }.

-spec build_custom_status_payload(map()) -> map().
build_custom_status_payload(CustomStatus) ->
    Fields = [
        {<<"text">>, maps:get(<<"text">>, CustomStatus, undefined)},
        {<<"expires_at">>, maps:get(<<"expires_at">>, CustomStatus, undefined)},
        {<<"emoji_id">>, maps:get(<<"emoji_id">>, CustomStatus, undefined)},
        {<<"emoji_name">>, maps:get(<<"emoji_name">>, CustomStatus, undefined)}
    ],
    lists:foldl(
        fun
            ({_Key, undefined}, Acc) -> Acc;
            ({Key, Value}, Acc) -> maps:put(Key, Value, Acc)
        end,
        #{},
        Fields
    ).

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").

validate_null_test() ->
    ?assertEqual({ok, null}, validate(123, null)).

build_custom_status_payload_all_fields_test() ->
    Input = #{
        <<"text">> => <<"Hello">>,
        <<"expires_at">> => <<"2024-01-01T00:00:00Z">>,
        <<"emoji_id">> => <<"123">>,
        <<"emoji_name">> => <<"smile">>
    },
    Result = build_custom_status_payload(Input),
    ?assertEqual(<<"Hello">>, maps:get(<<"text">>, Result)),
    ?assertEqual(<<"2024-01-01T00:00:00Z">>, maps:get(<<"expires_at">>, Result)),
    ?assertEqual(<<"123">>, maps:get(<<"emoji_id">>, Result)),
    ?assertEqual(<<"smile">>, maps:get(<<"emoji_name">>, Result)).

build_custom_status_payload_partial_test() ->
    Input = #{<<"text">> => <<"Hello">>},
    Result = build_custom_status_payload(Input),
    ?assertEqual(1, maps:size(Result)),
    ?assertEqual(<<"Hello">>, maps:get(<<"text">>, Result)).

build_custom_status_payload_empty_test() ->
    ?assertEqual(#{}, build_custom_status_payload(#{})).

build_request_test() ->
    CustomStatus = #{<<"text">> => <<"Test">>},
    Result = build_request(123, CustomStatus),
    ?assertEqual(<<"validate_custom_status">>, maps:get(<<"type">>, Result)),
    ?assertEqual(<<"123">>, maps:get(<<"user_id">>, Result)),
    ?assert(is_map(maps:get(<<"custom_status">>, Result))).

-endif.
