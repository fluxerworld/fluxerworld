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

-module(rpc_client).

-export([
    call/1,
    call/2,
    get_rpc_url/0,
    get_rpc_url/1,
    get_rpc_headers/0
]).

-type rpc_request() :: map().
-type rpc_response() :: {ok, map()} | {error, term()}.
-type rpc_options() :: map().

-spec call(rpc_request()) -> rpc_response().
call(Request) ->
    call(Request, #{}).

-spec call(rpc_request(), rpc_options()) -> rpc_response().
call(Request, _Options) ->
    Url = get_rpc_url(),
    Headers = get_rpc_headers(),
    Body = json:encode(Request),
    case gateway_http_client:request(rpc, post, Url, Headers, Body) of
        {ok, 200, _RespHeaders, RespBody} ->
            handle_success_response(RespBody);
        {ok, StatusCode, _RespHeaders, RespBody} ->
            handle_error_response(StatusCode, RespBody);
        {error, Reason} ->
            {error, Reason}
    end.

-spec handle_success_response(binary()) -> rpc_response().
handle_success_response(RespBody) ->
    Response = json:decode(RespBody),
    Data = maps:get(<<"data">>, Response, #{}),
    {ok, Data}.

-spec handle_error_response(pos_integer(), binary()) -> {error, term()}.
handle_error_response(StatusCode, RespBody) ->
    {error, {http_error, StatusCode, RespBody}}.

-spec get_rpc_url() -> string().
get_rpc_url() ->
    ApiHost = fluxer_gateway_env:get(api_host),
    get_rpc_url(ApiHost).

-spec get_rpc_url(string() | binary()) -> string().
get_rpc_url(ApiHost) ->
    BaseUrl = api_host_base_url(ApiHost),
    BaseUrl ++ "/_rpc".

-spec api_host_base_url(string() | binary()) -> string().
api_host_base_url(ApiHost) ->
    HostString = ensure_string(ApiHost),
    Normalized = normalize_api_host(HostString),
    strip_trailing_slash(Normalized).

-spec ensure_string(binary() | string()) -> string().
ensure_string(Value) when is_binary(Value) ->
    binary_to_list(Value);
ensure_string(Value) when is_list(Value) ->
    Value.

-spec normalize_api_host(string()) -> string().
normalize_api_host(Host) ->
    Lower = string:lowercase(Host),
    case {has_protocol_prefix(Lower, "http://"), has_protocol_prefix(Lower, "https://")} of
        {true, _} -> Host;
        {_, true} -> Host;
        _ -> "http://" ++ Host
    end.

-spec has_protocol_prefix(string(), string()) -> boolean().
has_protocol_prefix(Str, Prefix) ->
    case string:prefix(Str, Prefix) of
        nomatch -> false;
        _ -> true
    end.

-spec strip_trailing_slash(string()) -> string().
strip_trailing_slash([]) ->
    "";
strip_trailing_slash(Url) ->
    case lists:last(Url) of
        $/ -> strip_trailing_slash(lists:droplast(Url));
        _ -> Url
    end.

-spec get_rpc_headers() -> [{binary() | string(), binary() | string()}].
get_rpc_headers() ->
    RpcSecretKey = fluxer_gateway_env:get(rpc_secret_key),
    AuthHeader = {<<"Authorization">>, <<"Bearer ", RpcSecretKey/binary>>},
    InitialHeaders = [AuthHeader],
    gateway_tracing:inject_rpc_headers(InitialHeaders).
