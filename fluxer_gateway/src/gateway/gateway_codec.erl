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

-module(gateway_codec).

-export([
    encode/2,
    decode/2,
    parse_encoding/1
]).

-type encoding() :: json.
-type frame_type() :: text | binary.

-export_type([encoding/0]).

-spec parse_encoding(binary() | undefined) -> encoding().
parse_encoding(_) ->
    json.

-spec encode(map(), encoding()) -> {ok, iodata(), frame_type()} | {error, term()}.
encode(Message, json) ->
    try
        Encoded = iolist_to_binary(json:encode(Message)),
        {ok, Encoded, text}
    catch
        _:Reason ->
            {error, {encode_failed, Reason}}
    end.

-spec decode(binary(), encoding()) -> {ok, map()} | {error, term()}.
decode(Data, json) ->
    try
        Decoded = json:decode(Data),
        {ok, Decoded}
    catch
        _:Reason ->
            {error, {decode_failed, Reason}}
    end.

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").

parse_encoding_test_() ->
    [
        ?_assertEqual(json, parse_encoding(<<"json">>)),
        ?_assertEqual(json, parse_encoding(<<"etf">>)),
        ?_assertEqual(json, parse_encoding(undefined)),
        ?_assertEqual(json, parse_encoding(<<"invalid">>)),
        ?_assertEqual(json, parse_encoding(<<>>))
    ].

encode_json_test_() ->
    Message = #{<<"op">> => 0, <<"d">> => #{<<"test">> => true}},
    [
        ?_assertMatch({ok, _, text}, encode(Message, json)),
        ?_test(begin
            {ok, Encoded, text} = encode(Message, json),
            ?assert(is_binary(Encoded))
        end)
    ].

encode_empty_map_test() ->
    {ok, Encoded, text} = encode(#{}, json),
    ?assertEqual(<<"{}">>, Encoded).

encode_nested_test() ->
    Message = #{<<"a">> => #{<<"b">> => #{<<"c">> => 1}}},
    {ok, Encoded, text} = encode(Message, json),
    ?assert(is_binary(Encoded)),
    {ok, Decoded} = decode(Encoded, json),
    ?assertEqual(Message, Decoded).

decode_json_test_() ->
    Data = <<"{\"op\":0,\"d\":{\"test\":true}}">>,
    [
        ?_assertMatch({ok, _}, decode(Data, json)),
        ?_test(begin
            {ok, Decoded} = decode(Data, json),
            ?assertEqual(0, maps:get(<<"op">>, Decoded))
        end)
    ].

decode_invalid_json_test() ->
    ?assertMatch({error, {decode_failed, _}}, decode(<<"not json">>, json)).

decode_empty_object_test() ->
    {ok, Decoded} = decode(<<"{}">>, json),
    ?assertEqual(#{}, Decoded).

roundtrip_json_test_() ->
    Messages = [
        #{<<"op">> => 10, <<"d">> => #{<<"heartbeat_interval">> => 41250}},
        #{<<"op">> => 0, <<"s">> => 1, <<"t">> => <<"READY">>, <<"d">> => #{}},
        #{<<"list">> => [1, 2, 3], <<"bool">> => true, <<"null">> => null}
    ],
    [
        ?_test(begin
            {ok, Encoded, _} = encode(Msg, json),
            {ok, Decoded} = decode(iolist_to_binary(Encoded), json),
            ?assertEqual(Msg, Decoded)
        end)
     || Msg <- Messages
    ].

-endif.
