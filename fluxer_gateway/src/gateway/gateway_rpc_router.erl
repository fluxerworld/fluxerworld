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

-module(gateway_rpc_router).

-export([execute/2]).

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").
-endif.

-spec execute(binary(), map()) -> term().
execute(Method, Params) ->
    route_method(Method, Params).

-spec route_method(binary(), map()) -> term().
route_method(<<"guild.", _/binary>> = Method, Params) ->
    gateway_rpc_guild:execute_method(Method, Params);
route_method(<<"presence.", _/binary>> = Method, Params) ->
    gateway_rpc_presence:execute_method(Method, Params);
route_method(<<"push.", _/binary>> = Method, Params) ->
    gateway_rpc_push:execute_method(Method, Params);
route_method(<<"call.", _/binary>> = Method, Params) ->
    gateway_rpc_call:execute_method(Method, Params);
route_method(<<"voice.", _/binary>> = Method, Params) ->
    gateway_rpc_voice:execute_method(Method, Params);
route_method(<<"process.", _/binary>> = Method, Params) ->
    gateway_rpc_misc:execute_method(Method, Params);
route_method(Method, _Params) ->
    throw({error, <<"Unknown method: ", Method/binary>>}).

-ifdef(TEST).

route_method_guild_test() ->
    ?assertThrow({error, _}, route_method(<<"unknown.method">>, #{})).

-endif.
