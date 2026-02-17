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

-module(gateway_rpc_http_handler).

-export([init/2]).

-define(JSON_HEADERS, #{<<"content-type">> => <<"application/json">>}).

-spec init(cowboy_req:req(), term()) -> {ok, cowboy_req:req(), term()}.
init(Req0, State) ->
    case cowboy_req:method(Req0) of
        <<"POST">> ->
            handle_post(Req0, State);
        _ ->
            Req = cowboy_req:reply(405, #{<<"allow">> => <<"POST">>}, <<>>, Req0),
            {ok, Req, State}
    end.

-spec handle_post(cowboy_req:req(), term()) -> {ok, cowboy_req:req(), term()}.
handle_post(Req0, State) ->
    case authorize(Req0) of
        ok ->
            case read_body(Req0) of
                {ok, Decoded, Req1} ->
                    handle_decoded_body(Decoded, Req1, State);
                {error, ErrorBody, Req1} ->
                    respond(400, ErrorBody, Req1, State)
            end;
        {error, Req1} ->
            {ok, Req1, State}
    end.

-spec handle_decoded_body(map(), cowboy_req:req(), term()) -> {ok, cowboy_req:req(), term()}.
handle_decoded_body(Decoded, Req0, State) ->
    case maps:get(<<"method">>, Decoded, undefined) of
        undefined ->
            respond(400, #{<<"error">> => <<"Missing method">>}, Req0, State);
        Method when is_binary(Method) ->
            ParamsValue = maps:get(<<"params">>, Decoded, #{}),
            case is_map(ParamsValue) of
                true ->
                    execute_method(Method, ParamsValue, Req0, State);
                false ->
                    respond(400, #{<<"error">> => <<"Invalid params">>}, Req0, State)
            end;
        _ ->
            respond(400, #{<<"error">> => <<"Invalid method">>}, Req0, State)
    end.

-spec authorize(cowboy_req:req()) -> ok | {error, cowboy_req:req()}.
authorize(Req0) ->
    case cowboy_req:header(<<"authorization">>, Req0) of
        undefined ->
            Req = cowboy_req:reply(
                401,
                ?JSON_HEADERS,
                json:encode(#{<<"error">> => <<"Unauthorized">>}),
                Req0
            ),
            {error, Req};
        AuthHeader ->
            authorize_with_secret(AuthHeader, Req0)
    end.

-spec authorize_with_secret(binary(), cowboy_req:req()) -> ok | {error, cowboy_req:req()}.
authorize_with_secret(AuthHeader, Req0) ->
    case fluxer_gateway_env:get(rpc_secret_key) of
        undefined ->
            Req = cowboy_req:reply(
                500,
                ?JSON_HEADERS,
                json:encode(#{<<"error">> => <<"RPC secret not configured">>}),
                Req0
            ),
            {error, Req};
        Secret when is_binary(Secret) ->
            Expected = <<"Bearer ", Secret/binary>>,
            check_auth_header(AuthHeader, Expected, Req0)
    end.

-spec check_auth_header(binary(), binary(), cowboy_req:req()) -> ok | {error, cowboy_req:req()}.
check_auth_header(AuthHeader, Expected, Req0) ->
    case secure_compare(AuthHeader, Expected) of
        true ->
            ok;
        false ->
            Req = cowboy_req:reply(
                401,
                ?JSON_HEADERS,
                json:encode(#{<<"error">> => <<"Unauthorized">>}),
                Req0
            ),
            {error, Req}
    end.

-spec secure_compare(binary(), binary()) -> boolean().
secure_compare(Left, Right) when is_binary(Left), is_binary(Right) ->
    case byte_size(Left) =:= byte_size(Right) of
        true ->
            crypto:hash_equals(Left, Right);
        false ->
            false
    end.

-spec read_body(cowboy_req:req()) ->
    {ok, map(), cowboy_req:req()} | {error, map(), cowboy_req:req()}.
read_body(Req0) ->
    read_body_chunks(Req0, <<>>).

-spec read_body_chunks(cowboy_req:req(), binary()) ->
    {ok, map(), cowboy_req:req()} | {error, map(), cowboy_req:req()}.
read_body_chunks(Req0, Acc) ->
    case cowboy_req:read_body(Req0) of
        {ok, Body, Req1} ->
            FullBody = <<Acc/binary, Body/binary>>,
            decode_body(FullBody, Req1);
        {more, Body, Req1} ->
            read_body_chunks(Req1, <<Acc/binary, Body/binary>>)
    end.

-spec decode_body(binary(), cowboy_req:req()) ->
    {ok, map(), cowboy_req:req()} | {error, map(), cowboy_req:req()}.
decode_body(Body, Req0) ->
    case catch json:decode(Body) of
        {'EXIT', _Reason} ->
            {error, #{<<"error">> => <<"Invalid JSON payload">>}, Req0};
        Decoded when is_map(Decoded) ->
            {ok, Decoded, Req0};
        _ ->
            {error, #{<<"error">> => <<"Invalid request body">>}, Req0}
    end.

-spec execute_method(binary(), map(), cowboy_req:req(), term()) -> {ok, cowboy_req:req(), term()}.
execute_method(Method, Params, Req0, State) ->
    try
        Result = gateway_rpc_router:execute(Method, Params),
        respond(200, #{<<"result">> => Result}, Req0, State)
    catch
        throw:{error, Message} ->
            respond(400, #{<<"error">> => Message}, Req0, State);
        exit:timeout ->
            respond(504, #{<<"error">> => <<"timeout">>}, Req0, State);
        exit:{timeout, _} ->
            respond(504, #{<<"error">> => <<"timeout">>}, Req0, State);
        _:_ ->
            respond(500, #{<<"error">> => <<"Internal error">>}, Req0, State)
    end.

-spec respond(pos_integer(), map(), cowboy_req:req(), term()) -> {ok, cowboy_req:req(), term()}.
respond(Status, Body, Req0, State) ->
    Req = cowboy_req:reply(Status, ?JSON_HEADERS, json:encode(Body), Req0),
    {ok, Req, State}.
