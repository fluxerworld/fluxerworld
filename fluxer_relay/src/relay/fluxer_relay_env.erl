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

-module(fluxer_relay_env).

-export([load/0, get/1, get_optional/1, get_map/0, patch/1, update/1]).

-define(CONFIG_TERM_KEY, {fluxer_relay, runtime_config}).

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
    fluxer_relay_config:load().

-spec apply_system_config(config()) -> ok.
apply_system_config(Config) ->
    apply_logger_config(Config),
    ok.

-spec apply_logger_config(config()) -> ok.
apply_logger_config(Config) ->
    LoggerLevel = maps:get(logger_level, Config, info),
    lager:set_loglevel(lager_console_backend, LoggerLevel),
    ok.
