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

-module(fluxer_relay_http_handler).
-behaviour(cowboy_handler).

-export([init/2]).

-spec init(cowboy_req:req(), term()) -> {ok, cowboy_req:req(), term()}.
init(Req, State) ->
    Method = cowboy_req:method(Req),
    Path = cowboy_req:path(Req),
    Headers = cowboy_req:headers(Req),
    case validate_relay_request(Headers) of
        {ok, OriginInstance} ->
            proxy_request(Method, Path, Headers, Req, State, OriginInstance);
        {error, Reason} ->
            error_response(401, Reason, Req, State)
    end.

-spec validate_relay_request(map()) -> {ok, binary()} | {error, binary()}.
validate_relay_request(Headers) ->
    case maps:get(<<"x-relay-origin">>, Headers, undefined) of
        undefined ->
            {error, <<"Missing X-Relay-Origin header">>};
        Origin ->
            case maps:get(<<"x-relay-signature">>, Headers, undefined) of
                undefined ->
                    {error, <<"Missing X-Relay-Signature header">>};
                _Signature ->
                    {ok, Origin}
            end
    end.

-spec proxy_request(binary(), binary(), map(), cowboy_req:req(), term(), binary()) ->
    {ok, cowboy_req:req(), term()}.
proxy_request(Method, Path, Headers, Req, State, OriginInstance) ->
    Config = fluxer_relay_env:get_map(),
    UpstreamHost = maps:get(upstream_api_host, Config, "localhost:8080"),
    UseTls = maps:get(upstream_use_tls, Config, false),
    Timeout = maps:get(connection_timeout_ms, Config, 30000),
    {Host, Port} = parse_host_port(UpstreamHost, UseTls),
    Transport = case UseTls of true -> tls; false -> tcp end,
    case gun:open(Host, Port, #{transport => Transport, connect_timeout => Timeout}) of
        {ok, ConnPid} ->
            case gun:await_up(ConnPid, Timeout) of
                {ok, _Protocol} ->
                    forward_request(ConnPid, Method, Path, Headers, Req, State, OriginInstance);
                {error, Reason} ->
                    gun:close(ConnPid),
                    lager:error("Failed to connect to upstream: ~p", [Reason]),
                    error_response(502, <<"Upstream connection failed">>, Req, State)
            end;
        {error, Reason} ->
            lager:error("Failed to open connection to upstream: ~p", [Reason]),
            error_response(502, <<"Upstream connection failed">>, Req, State)
    end.

-spec forward_request(pid(), binary(), binary(), map(), cowboy_req:req(), term(), binary()) ->
    {ok, cowboy_req:req(), term()}.
forward_request(ConnPid, Method, Path, Headers, Req, State, OriginInstance) ->
    ProxiedHeaders = add_proxy_headers(Headers, OriginInstance),
    {ok, Body, Req2} = read_body(Req),
    StreamRef = case Method of
        <<"GET">> -> gun:get(ConnPid, Path, maps:to_list(ProxiedHeaders));
        <<"POST">> -> gun:post(ConnPid, Path, maps:to_list(ProxiedHeaders), Body);
        <<"PUT">> -> gun:put(ConnPid, Path, maps:to_list(ProxiedHeaders), Body);
        <<"PATCH">> -> gun:patch(ConnPid, Path, maps:to_list(ProxiedHeaders), Body);
        <<"DELETE">> -> gun:delete(ConnPid, Path, maps:to_list(ProxiedHeaders));
        <<"OPTIONS">> -> gun:options(ConnPid, Path, maps:to_list(ProxiedHeaders));
        <<"HEAD">> -> gun:head(ConnPid, Path, maps:to_list(ProxiedHeaders));
        _ -> gun:request(ConnPid, Method, Path, maps:to_list(ProxiedHeaders), Body)
    end,
    Timeout = fluxer_relay_env:get(connection_timeout_ms),
    case gun:await(ConnPid, StreamRef, Timeout) of
        {response, fin, Status, RespHeaders} ->
            gun:close(ConnPid),
            Req3 = cowboy_req:reply(Status, maps:from_list(RespHeaders), <<>>, Req2),
            {ok, Req3, State};
        {response, nofin, Status, RespHeaders} ->
            case gun:await_body(ConnPid, StreamRef, Timeout) of
                {ok, RespBody} ->
                    gun:close(ConnPid),
                    Req3 = cowboy_req:reply(Status, maps:from_list(RespHeaders), RespBody, Req2),
                    {ok, Req3, State};
                {error, Reason} ->
                    gun:close(ConnPid),
                    lager:error("Failed to read upstream response body: ~p", [Reason]),
                    error_response(502, <<"Upstream read failed">>, Req2, State)
            end;
        {error, Reason} ->
            gun:close(ConnPid),
            lager:error("Upstream request failed: ~p", [Reason]),
            error_response(502, <<"Upstream request failed">>, Req2, State)
    end.

-spec add_proxy_headers(map(), binary()) -> map().
add_proxy_headers(Headers, OriginInstance) ->
    FilteredHeaders = filter_relay_headers(Headers),
    FilteredHeaders#{
        <<"x-forwarded-for">> => OriginInstance,
        <<"x-relay-proxied">> => <<"true">>,
        <<"x-relay-origin">> => OriginInstance
    }.

-spec filter_relay_headers(map()) -> map().
filter_relay_headers(Headers) ->
    RelayHeaders = [
        <<"x-fluxer-target">>,
        <<"x-relay-signature">>,
        <<"x-relay-timestamp">>,
        <<"x-relay-instance">>,
        <<"x-relay-request-id">>
    ],
    lists:foldl(fun(Key, Acc) -> maps:remove(Key, Acc) end, Headers, RelayHeaders).

-spec read_body(cowboy_req:req()) -> {ok, binary(), cowboy_req:req()}.
read_body(Req) ->
    read_body(Req, <<>>).

-spec read_body(cowboy_req:req(), binary()) -> {ok, binary(), cowboy_req:req()}.
read_body(Req, Acc) ->
    case cowboy_req:read_body(Req) of
        {ok, Data, Req2} ->
            {ok, <<Acc/binary, Data/binary>>, Req2};
        {more, Data, Req2} ->
            read_body(Req2, <<Acc/binary, Data/binary>>)
    end.

-spec parse_host_port(string(), boolean()) -> {string(), inet:port_number()}.
parse_host_port(HostPort, UseTls) ->
    DefaultPort = case UseTls of true -> 443; false -> 80 end,
    case string:split(HostPort, ":") of
        [Host, PortStr] ->
            Port = list_to_integer(PortStr),
            {Host, Port};
        [Host] ->
            {Host, DefaultPort}
    end.

-spec error_response(integer(), binary(), cowboy_req:req(), term()) ->
    {ok, cowboy_req:req(), term()}.
error_response(Status, Message, Req, State) ->
    Response = json:encode(#{
        <<"error">> => Message
    }),
    Req2 = cowboy_req:reply(Status, #{
        <<"content-type">> => <<"application/json">>
    }, Response, Req),
    {ok, Req2, State}.
