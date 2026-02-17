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

-module(otel_metrics).

-export([init/0, counter/3, histogram/3, gauge/3, configure_enabled/1]).

-ifdef(HAS_OPENTELEMETRY).

-define(INSTRUMENT_TABLE, otel_metrics_instruments).
-define(OTEL_ENABLED_KEY, {otel_metrics, enabled}).
-define(REQUIRED_MODULES, [
    opentelemetry,
    opentelemetry_experimental,
    otel_ctx,
    otel_tracer,
    otel_span,
    otel_meter,
    otel_counter,
    otel_histogram
]).

-include_lib("kernel/include/logger.hrl").

-spec init() -> ok.
init() ->
    case is_enabled() of
        true ->
            start_dependency(opentelemetry),
            start_dependency(opentelemetry_api),
            start_dependency(opentelemetry_exporter),
            start_dependency(opentelemetry_experimental),
            start_dependency(opentelemetry_semantic_conventions),
            ensure_instrument_table();
        false ->
            ok
    end,
    ok.

-spec counter(binary(), number(), map()) -> ok.
counter(Name, Value, Attributes) ->
    record_metric(Name, Value, Attributes, counter),
    ok.

-spec histogram(binary(), number(), map()) -> ok.
histogram(Name, Value, Attributes) ->
    record_metric(Name, Value, Attributes, histogram),
    ok.

-spec gauge(binary(), number(), map()) -> ok.
gauge(Name, Value, Attributes) ->
    histogram(Name, Value, Attributes),
    ok.

-spec record_metric(binary(), number(), map(), counter | histogram) -> ok.
record_metric(Name, Value, Attributes, Kind) ->
    case is_enabled() of
        false ->
            ok;
        true ->
            try
                InstrumentName = sanitize_name(Name),
                ensure_instrument(InstrumentName, Kind),
                Meter = current_meter(),
                Attrs = normalize_attributes(Attributes),
                MetricValue = to_metric_value(Value),
                case Kind of
                    counter ->
                        otel_counter:add(
                            otel_ctx:get_current(), Meter, InstrumentName, MetricValue, Attrs
                        );
                    histogram ->
                        otel_histogram:record(
                            otel_ctx:get_current(), Meter, InstrumentName, MetricValue, Attrs
                        )
                end,
                ok
            catch
                Class:Reason:_Stacktrace ->
                    ?LOG_WARNING(
                        "Failed to record metric: name=~p, kind=~p, value=~p, error=~p:~p",
                        [Name, Kind, Value, Class, Reason]
                    ),
                    ok
            end
    end.

-spec sanitize_name(binary() | list() | atom() | term()) -> atom().
sanitize_name(Name) when is_binary(Name) ->
    binary_to_atom(Name, utf8);
sanitize_name(Name) when is_list(Name) ->
    list_to_atom(Name);
sanitize_name(Name) when is_atom(Name) ->
    Name;
sanitize_name(Name) ->
    list_to_atom(io_lib:format("~p", [Name])).

-spec to_metric_value(number()) -> number().
to_metric_value(Value) when is_integer(Value), Value > 0 ->
    Value;
to_metric_value(Value) when is_integer(Value) ->
    erlang:float(Value);
to_metric_value(Value) when is_float(Value) ->
    Value;
to_metric_value(Value) ->
    erlang:float(Value).

-spec normalize_attributes(map() | list() | term()) -> map().
normalize_attributes(Attributes) when is_map(Attributes) ->
    lists:foldl(
        fun({Key, Value}, Acc) ->
            maps:put(sanitize_name(Key), to_attribute_value(Value), Acc)
        end,
        #{},
        maps:to_list(Attributes)
    );
normalize_attributes(Attributes) when is_list(Attributes) ->
    ListAttrs = [attribute_from_tuple(Tuple) || Tuple <- Attributes],
    normalize_attributes(maps:from_list(ListAttrs));
normalize_attributes(_) ->
    #{}.

-spec attribute_from_tuple(tuple()) -> {atom(), binary()}.
attribute_from_tuple({Key, Value}) ->
    {sanitize_name(Key), to_attribute_value(Value)};
attribute_from_tuple(_) ->
    {<<"invalid">>, <<"invalid">>}.

-spec to_attribute_value(binary() | list() | atom() | term()) -> binary().
to_attribute_value(Value) when is_binary(Value) ->
    Value;
to_attribute_value(Value) when is_list(Value) ->
    list_to_binary(Value);
to_attribute_value(Value) when is_atom(Value) ->
    list_to_binary(atom_to_list(Value));
to_attribute_value(Value) ->
    list_to_binary(io_lib:format("~p", [Value])).

-spec ensure_instrument_table() -> ets:tid() | ok.
ensure_instrument_table() ->
    case ets:info(?INSTRUMENT_TABLE) of
        undefined ->
            ets:new(?INSTRUMENT_TABLE, [
                named_table, public, set, {read_concurrency, true}
            ]);
        _ ->
            ok
    end.

-spec ensure_instrument(atom(), counter | histogram) -> ok.
ensure_instrument(Name, counter) ->
    ensure_instrument(Name, counter, #{}),
    ok;
ensure_instrument(Name, histogram) ->
    ensure_instrument(Name, histogram, #{}),
    ok.

-spec ensure_instrument(atom(), counter | histogram, map()) -> ok.
ensure_instrument(Name, Kind, Opts) ->
    try
        ensure_instrument_table(),
        Key = {Kind, Name},
        case ets:lookup(?INSTRUMENT_TABLE, Key) of
            [{_, true}] ->
                ok;
            [] ->
                Meter = current_meter(),
                create_instrument(Meter, Name, Kind, Opts),
                ets:insert(?INSTRUMENT_TABLE, {Key, true})
        end
    catch
        Class:Reason:_Stacktrace ->
            ?LOG_WARNING(
                "Failed to ensure instrument: name=~p, kind=~p, error=~p:~p",
                [Name, Kind, Class, Reason]
            ),
            ok
    end.

-spec create_instrument(term(), atom(), counter | histogram, map()) -> term() | error.
create_instrument(Meter, Name, Kind, Opts) ->
    try
        case Kind of
            counter -> otel_meter:create_counter(Meter, Name, Opts);
            histogram -> otel_meter:create_histogram(Meter, Name, Opts)
        end
    catch
        Class:Reason:_Stacktrace ->
            ?LOG_WARNING(
                "Failed to create instrument: name=~p, kind=~p, error=~p:~p",
                [Name, Kind, Class, Reason]
            ),
            error
    end.

-spec current_meter() -> term().
current_meter() ->
    opentelemetry_experimental:get_meter(opentelemetry:get_application_scope(?MODULE)).

-spec is_enabled() -> boolean().
is_enabled() ->
    case persistent_term:get(?OTEL_ENABLED_KEY, undefined) of
        true -> true;
        false -> false;
        _ -> resolve_enabled()
    end.

-spec resolve_enabled() -> boolean().
resolve_enabled() ->
    Telemetry = fluxer_gateway_env:get(telemetry),
    configure_enabled(Telemetry).

-spec configure_enabled(map()) -> boolean().
configure_enabled(Telemetry) when is_map(Telemetry) ->
    Enabled = maps:get(enabled, Telemetry, true),
    Endpoint = string:trim(maps:get(otlp_endpoint, Telemetry, "")),
    Environment = normalize_environment(maps:get(environment, Telemetry, "development")),
    compute_enabled(Enabled andalso Endpoint =/= "" andalso is_production_like_environment(Environment));
configure_enabled(_) ->
    compute_enabled(false).

-spec normalize_environment(string() | binary() | atom() | term()) -> string().
normalize_environment(Value) when is_list(Value) ->
    string:lowercase(string:trim(Value));
normalize_environment(Value) when is_binary(Value) ->
    normalize_environment(binary_to_list(Value));
normalize_environment(Value) when is_atom(Value) ->
    normalize_environment(atom_to_list(Value));
normalize_environment(_) ->
    "development".

-spec is_production_like_environment(string()) -> boolean().
is_production_like_environment(Environment) ->
    not lists:member(Environment, ["", "development", "dev", "local", "test", "testing"]).

-spec compute_enabled(boolean()) -> boolean().
compute_enabled(ShouldEnableFlag) ->
    case {ShouldEnableFlag, modules_available()} of
        {true, true} ->
            persistent_term:put(?OTEL_ENABLED_KEY, true),
            true;
        {true, false} ->
            persistent_term:put(?OTEL_ENABLED_KEY, false),
            ?LOG_WARNING(
                "Telemetry configured but OTEL modules missing from code path, disabling telemetry",
                []
            ),
            false;
        _ ->
            persistent_term:put(?OTEL_ENABLED_KEY, false),
            false
    end.

-spec modules_available() -> boolean().
modules_available() ->
    lists:all(fun(Module) -> code:which(Module) =/= non_existing end, ?REQUIRED_MODULES).

-spec start_dependency(atom()) -> ok.
start_dependency(App) ->
    case application:ensure_started(App) of
        ok ->
            ok;
        {error, {already_started, _}} ->
            ok;
        {error, Reason} ->
            ?LOG_WARNING("Failed to start telemetry dependency ~p: ~p", [App, Reason]),
            ok
    end.

-else.

-spec init() -> ok.
init() ->
    ok.

-spec counter(binary(), number(), map()) -> ok.
counter(_Name, _Value, _Attributes) ->
    ok.

-spec histogram(binary(), number(), map()) -> ok.
histogram(_Name, _Value, _Attributes) ->
    ok.

-spec gauge(binary(), number(), map()) -> ok.
gauge(_Name, _Value, _Attributes) ->
    ok.

-spec configure_enabled(map()) -> boolean().
configure_enabled(_) ->
    false.

-endif.
