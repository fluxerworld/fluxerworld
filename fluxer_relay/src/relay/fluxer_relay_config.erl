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

-module(fluxer_relay_config).

-export([load/0, load_from/1]).

-type config() :: map().
-type log_level() :: debug | info | notice | warning | error | critical | alert | emergency.

-spec load() -> config().
load() ->
    case os:getenv("FLUXER_CONFIG") of
        false -> erlang:error({missing_env, "FLUXER_CONFIG"});
        "" -> erlang:error({missing_env, "FLUXER_CONFIG"});
        Path -> load_from(Path)
    end.

-spec load_from(string()) -> config().
load_from(Path) when is_list(Path) ->
    case file:read_file(Path) of
        {ok, Content} ->
            Json = json:decode(Content),
            build_config(Json);
        {error, Reason} ->
            erlang:error({json_read_failed, Path, Reason})
    end.

-spec build_config(map()) -> config().
build_config(Json) ->
    Service = get_map(Json, [<<"services">>, <<"relay">>]),
    Federation = get_map(Json, [<<"federation">>]),
    Telemetry = get_map(Json, [<<"telemetry">>]),
    #{
        port => get_int(Service, <<"port">>, 8090),
        upstream_api_host => get_string(Service, <<"upstream_api_host">>, "localhost:8080"),
        upstream_gateway_host => get_string(Service, <<"upstream_gateway_host">>, "localhost:8081"),
        upstream_use_tls => get_bool(Service, <<"upstream_use_tls">>, false),
        instance_domain => get_string(Federation, <<"instance_domain">>, "localhost"),
        instance_public_key => get_optional_binary(Federation, <<"instance_public_key">>),
        instance_private_key => get_optional_binary(Federation, <<"instance_private_key">>),
        allowed_origins => get_string_list(Service, <<"allowed_origins">>, []),
        max_connections_per_instance => get_int(Service, <<"max_connections_per_instance">>, 1000),
        connection_timeout_ms => get_int(Service, <<"connection_timeout_ms">>, 30000),
        idle_timeout_ms => get_int(Service, <<"idle_timeout_ms">>, 120000),
        logger_level => get_log_level(Service, <<"logger_level">>, info),
        telemetry => #{
            enabled => get_bool(Telemetry, <<"enabled">>, false),
            otlp_endpoint => get_string(Telemetry, <<"otlp_endpoint">>, ""),
            service_name => get_string(Telemetry, <<"service_name">>, "fluxer-relay")
        }
    }.

-spec get_map(map(), [binary()]) -> map().
get_map(Map, Keys) ->
    case get_in(Map, Keys) of
        Value when is_map(Value) -> Value;
        _ -> #{}
    end.

-spec get_int(map(), binary(), integer()) -> integer().
get_int(Map, Key, Default) when is_integer(Default) ->
    to_int(get_value(Map, Key), Default).

-spec get_bool(map(), binary(), boolean()) -> boolean().
get_bool(Map, Key, Default) when is_boolean(Default) ->
    to_bool(get_value(Map, Key), Default).

-spec get_string(map(), binary(), string()) -> string().
get_string(Map, Key, Default) when is_list(Default) ->
    to_string(get_value(Map, Key), Default).

-spec get_optional_binary(map(), binary()) -> binary() | undefined.
get_optional_binary(Map, Key) ->
    case get_value(Map, Key) of
        undefined -> undefined;
        Value -> to_binary(Value, undefined)
    end.

-spec get_string_list(map(), binary(), [string()]) -> [string()].
get_string_list(Map, Key, Default) ->
    case get_value(Map, Key) of
        undefined -> Default;
        List when is_list(List) ->
            [to_string(Item, "") || Item <- List, Item =/= undefined];
        _ -> Default
    end.

-spec get_log_level(map(), binary(), log_level()) -> log_level().
get_log_level(Map, Key, Default) when is_atom(Default) ->
    Value = get_value(Map, Key),
    case normalize_log_level(Value) of
        undefined -> Default;
        Level -> Level
    end.

-spec get_in(term(), [binary()]) -> term().
get_in(Map, [Key | Rest]) when is_map(Map) ->
    case get_value(Map, Key) of
        undefined -> undefined;
        Value when Rest =:= [] -> Value;
        Value -> get_in(Value, Rest)
    end;
get_in(_, _) ->
    undefined.

-spec get_value(term(), binary()) -> term().
get_value(Map, Key) when is_map(Map) ->
    case maps:get(Key, Map, undefined) of
        undefined when is_binary(Key) ->
            maps:get(binary_to_list(Key), Map, undefined);
        Value ->
            Value
    end.

-spec to_int(term(), integer() | undefined) -> integer() | undefined.
to_int(Value, _Default) when is_integer(Value) ->
    Value;
to_int(Value, _Default) when is_float(Value) ->
    trunc(Value);
to_int(Value, Default) ->
    case to_string(Value, "") of
        "" ->
            Default;
        Str ->
            case string:to_integer(Str) of
                {Int, _} when is_integer(Int) -> Int;
                {error, _} -> Default
            end
    end.

-spec to_bool(term(), boolean() | undefined) -> boolean() | undefined.
to_bool(Value, _Default) when is_boolean(Value) ->
    Value;
to_bool(Value, Default) when is_atom(Value) ->
    case Value of
        true -> true;
        false -> false;
        _ -> Default
    end;
to_bool(Value, Default) ->
    case string:lowercase(to_string(Value, "")) of
        "true" -> true;
        "1" -> true;
        "false" -> false;
        "0" -> false;
        _ -> Default
    end.

-spec to_string(term(), string()) -> string().
to_string(Value, Default) when is_list(Default) ->
    case Value of
        undefined -> Default;
        Bin when is_binary(Bin) -> binary_to_list(Bin);
        Str when is_list(Str) -> Str;
        Atom when is_atom(Atom) -> atom_to_list(Atom);
        _ -> Default
    end.

-spec to_binary(term(), binary() | undefined) -> binary() | undefined.
to_binary(Value, Default) ->
    case Value of
        undefined -> Default;
        Bin when is_binary(Bin) -> Bin;
        Str when is_list(Str) -> list_to_binary(Str);
        Atom when is_atom(Atom) -> list_to_binary(atom_to_list(Atom));
        _ -> Default
    end.

-spec normalize_log_level(term()) -> log_level() | undefined.
normalize_log_level(undefined) ->
    undefined;
normalize_log_level(Level) when is_atom(Level) ->
    normalize_log_level(atom_to_list(Level));
normalize_log_level(Level) when is_binary(Level) ->
    normalize_log_level(binary_to_list(Level));
normalize_log_level(Level) when is_list(Level) ->
    case string:lowercase(string:trim(Level)) of
        "debug" -> debug;
        "info" -> info;
        "notice" -> notice;
        "warning" -> warning;
        "error" -> error;
        "critical" -> critical;
        "alert" -> alert;
        "emergency" -> emergency;
        _ -> undefined
    end;
normalize_log_level(_) ->
    undefined.
