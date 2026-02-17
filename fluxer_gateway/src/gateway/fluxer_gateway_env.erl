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

-module(fluxer_gateway_env).

-export([load/0, get/1, get_optional/1, get_map/0, patch/1, update/1]).

-define(CONFIG_TERM_KEY, {fluxer_gateway, runtime_config}).

-type config() :: map().

-spec load() -> config().
load() ->
    Config = build_config(),
    apply_system_config(Config),
    set_config(Config).

-spec get(atom()) -> term().
get(Key) when is_atom(Key) ->
    Map = get_map(),
    maps:get(Key, Map, undefined).

-spec get_optional(atom()) -> term().
get_optional(Key) when is_atom(Key) ->
    ?MODULE:get(Key).

-spec get_map() -> config().
get_map() ->
    ensure_loaded().

-spec patch(map()) -> config().
patch(Patch) when is_map(Patch) ->
    Map = get_map(),
    set_config(maps:merge(Map, Patch)).

-spec update(fun((config()) -> config())) -> config().
update(Fun) when is_function(Fun, 1) ->
    Map = get_map(),
    set_config(Fun(Map)).

-spec set_config(config()) -> config().
set_config(Config) when is_map(Config) ->
    persistent_term:put(?CONFIG_TERM_KEY, Config),
    Config.

-spec ensure_loaded() -> config().
ensure_loaded() ->
    case persistent_term:get(?CONFIG_TERM_KEY, undefined) of
        Map when is_map(Map) ->
            Map;
        _ ->
            load()
    end.

-spec build_config() -> config().
build_config() ->
    fluxer_gateway_config:load().

-spec apply_system_config(config()) -> ok.
apply_system_config(Config) ->
    apply_logger_config(Config),
    apply_telemetry_config(Config).

-spec apply_logger_config(config()) -> ok.
apply_logger_config(Config) ->
    LoggerLevel = resolve_logger_level(Config),
    logger:set_primary_config(level, LoggerLevel),
    logger:set_handler_config(default, level, LoggerLevel).

-spec apply_telemetry_config(config()) -> ok.
apply_telemetry_config(Config) ->
    Telemetry = maps:get(telemetry, Config, #{}),
    apply_telemetry_config(Telemetry, Config).

-spec resolve_logger_level(config()) -> atom().
resolve_logger_level(Config) ->
    Default = maps:get(logger_level, Config, info),
    case os:getenv("LOGGER_LEVEL") of
        false -> Default;
        "" -> Default;
        Value -> parse_logger_level(Value, Default)
    end.

-spec parse_logger_level(string(), atom()) -> atom().
parse_logger_level(Value, Default) ->
    case string:lowercase(string:trim(Value)) of
        "debug" -> debug;
        "info" -> info;
        "notice" -> notice;
        "warning" -> warning;
        "error" -> error;
        "critical" -> critical;
        "alert" -> alert;
        "emergency" -> emergency;
        _ -> Default
    end.

-ifdef(HAS_OPENTELEMETRY).
-spec apply_telemetry_config(map(), config()) -> ok.
apply_telemetry_config(Telemetry, Config) ->
    Sentry = maps:get(sentry, Config, #{}),
    ShouldEnable = otel_metrics:configure_enabled(Telemetry),
    case ShouldEnable of
        true ->
            set_opentelemetry_env(Telemetry, Sentry, Config);
        false ->
            application:set_env(opentelemetry_experimental, readers, []),
            application:set_env(opentelemetry, processors, []),
            application:set_env(opentelemetry, traces_exporter, none)
    end.

-spec set_opentelemetry_env(map(), map(), config()) -> ok.
-ifdef(DEV_MODE).
set_opentelemetry_env(_Telemetry, _Sentry, _Config) ->
    ok.
-else.
set_opentelemetry_env(Telemetry, Sentry, Config) ->
    Endpoint = maps:get(otlp_endpoint, Telemetry, ""),
    ApiKey = maps:get(api_key, Telemetry, ""),
    Headers = otlp_headers(ApiKey),
    ServiceName = maps:get(service_name, Telemetry, "fluxer-gateway"),
    Environment = maps:get(environment, Telemetry, "development"),
    Version = maps:get(build_sha, Sentry, ""),
    InstanceId = maps:get(release_node, Config, ""),
    Resource = [
        {service_name, ServiceName},
        {service_version, Version},
        {service_namespace, "fluxer"},
        {deployment_environment, Environment},
        {service_instance_id, InstanceId}
    ],
    application:set_env(
        opentelemetry_experimental,
        readers,
        [
            {otel_periodic_reader, #{
                exporter =>
                    {otel_otlp_metrics, #{
                        protocol => http_protobuf,
                        endpoint => Endpoint,
                        headers => Headers
                    }},
                interval => 30000
            }}
        ]
    ),
    application:set_env(opentelemetry_experimental, resource, Resource),
    application:set_env(
        opentelemetry,
        processors,
        [
            {otel_batch_processor, #{
                exporter => {opentelemetry_exporter, #{}},
                scheduled_delay_ms => 1000,
                max_queue_size => 2048,
                export_timeout_ms => 30000
            }}
        ]
    ),
    application:set_env(opentelemetry, traces_exporter, {opentelemetry_exporter, #{}}),
    application:set_env(
        opentelemetry,
        logger,
        [
            {handler, default, otel_log_handler, #{
                level => info,
                max_queue_size => 2048,
                scheduled_delay_ms => 1000,
                exporting_timeout_ms => 30000,
                exporter =>
                    {otel_otlp_logs, #{
                        protocol => http_protobuf,
                        endpoint => Endpoint,
                        headers => Headers
                    }}
            }}
        ]
    ),
    application:set_env(opentelemetry_exporter, otlp_protocol, http_protobuf),
    application:set_env(opentelemetry_exporter, otlp_endpoint, Endpoint),
    application:set_env(opentelemetry_exporter, otlp_headers, Headers).

-spec otlp_headers(string()) -> [{string(), string()}].
otlp_headers(ApiKey) ->
    ApiKeyStr = string:trim(ApiKey),
    case ApiKeyStr of
        "" -> [];
        _ -> [{"Authorization", "Bearer " ++ ApiKeyStr}]
    end.

-endif.
-else.
-spec apply_telemetry_config(map(), config()) -> ok.
apply_telemetry_config(_Telemetry, _Config) ->
    application:set_env(opentelemetry_experimental, readers, []),
    application:set_env(opentelemetry, processors, []),
    application:set_env(opentelemetry, traces_exporter, none).
-endif.
