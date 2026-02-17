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

-module(fluxer_relay_app).
-behaviour(application).
-export([start/2, stop/1]).

-spec start(application:start_type(), term()) -> {ok, pid()} | {error, term()}.
start(_StartType, _StartArgs) ->
    fluxer_relay_env:load(),
    fluxer_relay_instance_discovery:init(),
    Port = fluxer_relay_env:get(port),
    Dispatch = cowboy_router:compile([
        {'_', [
            {<<"/_health">>, fluxer_relay_health_handler, []},
            {<<"/api/[...]">>, fluxer_relay_http_handler, []},
            {<<"/gateway">>, fluxer_relay_ws_handler, []}
        ]}
    ]),
    {ok, _} = cowboy:start_clear(http, [{port, Port}], #{
        env => #{dispatch => Dispatch},
        idle_timeout => 120000,
        request_timeout => 60000
    }),
    lager:info("Fluxer Relay started on port ~p", [Port]),
    fluxer_relay_sup:start_link().

-spec stop(term()) -> ok.
stop(_State) ->
    ok.
