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

-module(fluxer_relay_instance_discovery).

-export([
    init/0,
    discover_gateway/1,
    clear_cache/0,
    clear_cache/1
]).

-define(CACHE_TABLE, fluxer_relay_instance_cache).
-define(CACHE_TTL_MS, 300000). %% 5 minutes
-define(HTTP_TIMEOUT_MS, 10000). %% 10 seconds
-define(HTTP_CONNECT_TIMEOUT_MS, 5000). %% 5 seconds

-type gateway_info() :: #{
    host := string(),
    port := inet:port_number(),
    use_tls := boolean()
}.

-spec init() -> ok.
init() ->
    case application:ensure_all_started(inets) of
        {ok, _} -> ok;
        {error, {already_started, inets}} -> ok
    end,
    case application:ensure_all_started(ssl) of
        {ok, _} -> ok;
        {error, {already_started, ssl}} -> ok
    end,
    case ets:info(?CACHE_TABLE) of
        undefined ->
            ets:new(?CACHE_TABLE, [
                named_table,
                public,
                set,
                {read_concurrency, true}
            ]),
            lager:info("Instance discovery cache table created");
        _ ->
            ok
    end,
    ok.

-spec discover_gateway(binary() | string()) -> {ok, gateway_info()} | {error, term()}.
discover_gateway(InstanceDomain) when is_binary(InstanceDomain) ->
    discover_gateway(binary_to_list(InstanceDomain));
discover_gateway(InstanceDomain) when is_list(InstanceDomain) ->
    case get_cached(InstanceDomain) of
        {ok, GatewayInfo} ->
            lager:debug("Cache hit for instance ~s", [InstanceDomain]),
            {ok, GatewayInfo};
        miss ->
            lager:debug("Cache miss for instance ~s, fetching discovery", [InstanceDomain]),
            fetch_and_cache(InstanceDomain)
    end.

-spec clear_cache() -> ok.
clear_cache() ->
    case ets:info(?CACHE_TABLE) of
        undefined ->
            ok;
        _ ->
            ets:delete_all_objects(?CACHE_TABLE),
            lager:info("Instance discovery cache cleared"),
            ok
    end.

-spec clear_cache(binary() | string()) -> ok.
clear_cache(InstanceDomain) when is_binary(InstanceDomain) ->
    clear_cache(binary_to_list(InstanceDomain));
clear_cache(InstanceDomain) when is_list(InstanceDomain) ->
    case ets:info(?CACHE_TABLE) of
        undefined ->
            ok;
        _ ->
            ets:delete(?CACHE_TABLE, InstanceDomain),
            lager:debug("Cache cleared for instance ~s", [InstanceDomain]),
            ok
    end.


-spec get_cached(string()) -> {ok, gateway_info()} | miss.
get_cached(InstanceDomain) ->
    case ets:info(?CACHE_TABLE) of
        undefined ->
            miss;
        _ ->
            Now = erlang:system_time(millisecond),
            case ets:lookup(?CACHE_TABLE, InstanceDomain) of
                [{InstanceDomain, GatewayInfo, ExpiresAt}] when ExpiresAt > Now ->
                    {ok, GatewayInfo};
                [{InstanceDomain, _GatewayInfo, _ExpiresAt}] ->
                    ets:delete(?CACHE_TABLE, InstanceDomain),
                    miss;
                [] ->
                    miss
            end
    end.

-spec fetch_and_cache(string()) -> {ok, gateway_info()} | {error, term()}.
fetch_and_cache(InstanceDomain) ->
    case fetch_instance_info(InstanceDomain) of
        {ok, GatewayInfo} ->
            cache_result(InstanceDomain, GatewayInfo),
            {ok, GatewayInfo};
        {error, Reason} = Error ->
            lager:warning("Failed to fetch instance info for ~s: ~p", [InstanceDomain, Reason]),
            Error
    end.

-spec cache_result(string(), gateway_info()) -> ok.
cache_result(InstanceDomain, GatewayInfo) ->
    case ets:info(?CACHE_TABLE) of
        undefined ->
            ok;
        _ ->
            ExpiresAt = erlang:system_time(millisecond) + ?CACHE_TTL_MS,
            ets:insert(?CACHE_TABLE, {InstanceDomain, GatewayInfo, ExpiresAt}),
            lager:debug("Cached gateway info for ~s (expires in ~p ms)", [InstanceDomain, ?CACHE_TTL_MS]),
            ok
    end.

-spec fetch_instance_info(string()) -> {ok, gateway_info()} | {error, term()}.
fetch_instance_info(InstanceDomain) ->
    Url = "https://" ++ InstanceDomain ++ "/.well-known/fluxer",
    HttpOptions = [
        {timeout, ?HTTP_TIMEOUT_MS},
        {connect_timeout, ?HTTP_CONNECT_TIMEOUT_MS},
        {ssl, [{verify, verify_peer}, {cacerts, public_key:cacerts_get()}]}
    ],
    Options = [{body_format, binary}],
    case httpc:request(get, {Url, []}, HttpOptions, Options) of
        {ok, {{_, 200, _}, _Headers, Body}} ->
            parse_instance_response(Body);
        {ok, {{_, StatusCode, _}, _Headers, Body}} ->
            lager:warning("Instance discovery failed for ~s: HTTP ~p, body: ~s",
                         [InstanceDomain, StatusCode, Body]),
            {error, {http_error, StatusCode}};
        {error, Reason} ->
            lager:warning("HTTP request failed for ~s: ~p", [InstanceDomain, Reason]),
            {error, {request_failed, Reason}}
    end.

-spec parse_instance_response(binary()) -> {ok, gateway_info()} | {error, term()}.
parse_instance_response(Body) ->
    try
        Json = json:decode(Body),
        case Json of
            #{<<"endpoints">> := Endpoints} ->
                case maps:get(<<"gateway">>, Endpoints, undefined) of
                    undefined ->
                        lager:warning("No gateway endpoint in instance response"),
                        {error, no_gateway_endpoint};
                    GatewayUrl when is_binary(GatewayUrl) ->
                        parse_gateway_url(binary_to_list(GatewayUrl))
                end;
            _ ->
                lager:warning("Invalid instance response: missing endpoints"),
                {error, invalid_response}
        end
    catch
        error:badarg ->
            lager:warning("Failed to parse instance JSON response"),
            {error, json_parse_error}
    end.

-spec parse_gateway_url(string()) -> {ok, gateway_info()} | {error, term()}.
parse_gateway_url(Url) ->
    case parse_url_components(Url) of
        {ok, Scheme, Host, Port} ->
            UseTls = case Scheme of
                "wss" -> true;
                "ws" -> false;
                "https" -> true;
                "http" -> false;
                _ -> true %% Default to TLS for unknown schemes
            end,
            GatewayInfo = #{
                host => Host,
                port => Port,
                use_tls => UseTls
            },
            lager:debug("Parsed gateway URL ~s -> ~p", [Url, GatewayInfo]),
            {ok, GatewayInfo};
        {error, Reason} ->
            {error, Reason}
    end.

-spec parse_url_components(string()) -> {ok, string(), string(), inet:port_number()} | {error, term()}.
parse_url_components(Url) ->
    case string:split(Url, "://") of
        [Scheme, Rest] ->
            HostPortPath = case string:split(Rest, "/") of
                [HostPort, _Path] -> HostPort;
                [HostPort] -> HostPort
            end,
            parse_host_port(Scheme, HostPortPath);
        _ ->
            {error, invalid_url_format}
    end.

-spec parse_host_port(string(), string()) -> {ok, string(), string(), inet:port_number()} | {error, term()}.
parse_host_port(Scheme, HostPort) ->
    DefaultPort = case Scheme of
        "wss" -> 443;
        "ws" -> 80;
        "https" -> 443;
        "http" -> 80;
        _ -> 443
    end,
    case string:split(HostPort, ":") of
        [Host, PortStr] ->
            try
                Port = list_to_integer(PortStr),
                {ok, Scheme, Host, Port}
            catch
                error:badarg ->
                    {error, invalid_port}
            end;
        [Host] ->
            {ok, Scheme, Host, DefaultPort}
    end.
