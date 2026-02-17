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

-module(gateway_tracing).

-export([
    start_connection_span/3,
    end_connection_span/2,
    start_event_span/3,
    end_event_span/2,
    inject_rpc_headers/1,
    tracing_enabled/0
]).

-ifdef(HAS_OPENTELEMETRY).

-define(TRACING_MODULES, [
    opentelemetry,
    opentelemetry_experimental,
    otel_ctx,
    otel_tracer,
    otel_span,
    otel_propagator_text_map
]).

start_connection_span(Module, Version, PeerIp) ->
    Attributes = build_connection_attributes(Version, PeerIp),
    maybe_start_span(Module, websocket_connect, Attributes, server).

end_connection_span(Context, ReasonBin) ->
    end_span(Context, #{<<"close.reason">> => ReasonBin}).

start_event_span(Module, SpanName, Attributes) ->
    maybe_start_span(Module, SpanName, Attributes, internal).

end_event_span(undefined, _) ->
    undefined;
end_event_span(Context, Attributes) ->
    case end_span(Context, Attributes) of
        ok -> ok;
        error -> error
    end.

inject_rpc_headers(Headers) ->
    case tracing_enabled() of
        true ->
            try
                Injector = opentelemetry:get_text_map_injector(),
                otel_propagator_text_map:inject(Injector, Headers, fun(Key, Value, Carrier) ->
                    [{Key, Value} | Carrier]
                end)
            catch
                _:_ -> Headers
            end;
        false ->
            Headers
    end.

tracing_enabled() ->
    tracing_modules_available() andalso otel_metrics_enabled().

otel_metrics_enabled() ->
    case code:ensure_loaded(otel_metrics) of
        {module, otel_metrics} ->
            case erlang:function_exported(otel_metrics, is_enabled, 0) of
                true ->
                    otel_metrics:is_enabled();
                false ->
                    false
            end;
        _ ->
            false
    end.

maybe_start_span(Module, SpanName, Attributes, Kind) ->
    case tracing_enabled() of
        true ->
            try
                OtelCtx = otel_ctx:get_current(),
                Tracer = opentelemetry:get_application_tracer(Module),
                SpanStartOpts = #{
                    kind => Kind,
                    attributes => Attributes
                },
                SpanCtx = otel_tracer:start_span(OtelCtx, Tracer, SpanName, SpanStartOpts),
                NewCtx = otel_tracer:set_current_span(OtelCtx, SpanCtx),
                Token = otel_ctx:attach(NewCtx),
                {SpanCtx, Token}
            catch
                _:_ -> undefined
            end;
        false ->
            undefined
    end.

end_span(undefined, _) ->
    undefined;
end_span({SpanCtx, Token}, Attributes) ->
    case tracing_enabled() of
        true ->
            try
                set_attributes(SpanCtx, Attributes),
                otel_span:end_span(SpanCtx),
                otel_ctx:detach(Token),
                ok
            catch
                _:_ -> error
            end;
        false ->
            ok
    end.

build_connection_attributes(Version, PeerIp) ->
    Attrs = maybe_put_attr(#{}, <<"ws.version">>, Version),
    maybe_put_attr(Attrs, <<"client.address">>, PeerIp).

maybe_put_attr(Map, _Key, undefined) ->
    Map;
maybe_put_attr(Map, Key, Value) ->
    maps:put(Key, Value, Map).

set_attributes(SpanCtx, Attributes) ->
    case maps:is_empty(Attributes) of
        true ->
            ok;
        false ->
            lists:foreach(
                fun({Key, Value}) -> otel_span:set_attribute(SpanCtx, Key, Value) end,
                maps:to_list(Attributes)
            )
    end.

tracing_modules_available() ->
    lists:all(fun(Module) -> code:which(Module) =/= non_existing end, ?TRACING_MODULES).

-else.

start_connection_span(_, _, _) -> undefined.

end_connection_span(_, _) -> ok.

start_event_span(_, _, _) -> undefined.

end_event_span(_, _) -> ok.

inject_rpc_headers(Headers) -> Headers.

tracing_enabled() -> false.

-endif.
