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

-module(fluxer_relay_connection_manager).
-behaviour(gen_server).

-export([
    start_link/0,
    register_connection/2,
    unregister_connection/1,
    get_connection_count/1,
    get_all_connections/0
]).

-export([
    init/1,
    handle_call/3,
    handle_cast/2,
    handle_info/2,
    terminate/2
]).

-define(TABLE, fluxer_relay_connections).

-spec start_link() -> {ok, pid()} | {error, term()}.
start_link() ->
    gen_server:start_link({local, ?MODULE}, ?MODULE, [], []).

-spec register_connection(binary(), pid()) -> ok | {error, limit_exceeded}.
register_connection(InstanceDomain, Pid) ->
    gen_server:call(?MODULE, {register, InstanceDomain, Pid}).

-spec unregister_connection(pid()) -> ok.
unregister_connection(Pid) ->
    gen_server:cast(?MODULE, {unregister, Pid}).

-spec get_connection_count(binary()) -> non_neg_integer().
get_connection_count(InstanceDomain) ->
    gen_server:call(?MODULE, {count, InstanceDomain}).

-spec get_all_connections() -> map().
get_all_connections() ->
    gen_server:call(?MODULE, get_all).

-spec init([]) -> {ok, map()}.
init([]) ->
    ets:new(?TABLE, [named_table, bag, public, {read_concurrency, true}]),
    State = #{
        monitors => #{}
    },
    {ok, State}.

-spec handle_call(term(), {pid(), term()}, map()) -> {reply, term(), map()}.
handle_call({register, InstanceDomain, Pid}, _From, State) ->
    MaxConns = fluxer_relay_env:get(max_connections_per_instance),
    CurrentCount = length(ets:lookup(?TABLE, InstanceDomain)),
    case CurrentCount >= MaxConns of
        true ->
            {reply, {error, limit_exceeded}, State};
        false ->
            ets:insert(?TABLE, {InstanceDomain, Pid}),
            MonRef = erlang:monitor(process, Pid),
            Monitors = maps:get(monitors, State),
            NewMonitors = Monitors#{MonRef => {InstanceDomain, Pid}},
            lager:debug("Registered connection from ~s (count: ~p)", [InstanceDomain, CurrentCount + 1]),
            {reply, ok, State#{monitors => NewMonitors}}
    end;

handle_call({count, InstanceDomain}, _From, State) ->
    Count = length(ets:lookup(?TABLE, InstanceDomain)),
    {reply, Count, State};

handle_call(get_all, _From, State) ->
    AllEntries = ets:tab2list(?TABLE),
    Grouped = lists:foldl(
        fun({Domain, Pid}, Acc) ->
            Pids = maps:get(Domain, Acc, []),
            Acc#{Domain => [Pid | Pids]}
        end,
        #{},
        AllEntries
    ),
    {reply, Grouped, State};

handle_call(_Request, _From, State) ->
    {reply, {error, unknown_request}, State}.

-spec handle_cast(term(), map()) -> {noreply, map()}.
handle_cast({unregister, Pid}, State) ->
    ets:match_delete(?TABLE, {'_', Pid}),
    {noreply, State};

handle_cast(_Msg, State) ->
    {noreply, State}.

-spec handle_info(term(), map()) -> {noreply, map()}.
handle_info({'DOWN', MonRef, process, Pid, _Reason}, State) ->
    Monitors = maps:get(monitors, State),
    case maps:get(MonRef, Monitors, undefined) of
        undefined ->
            {noreply, State};
        {InstanceDomain, Pid} ->
            ets:delete_object(?TABLE, {InstanceDomain, Pid}),
            NewMonitors = maps:remove(MonRef, Monitors),
            lager:debug("Connection from ~s terminated", [InstanceDomain]),
            {noreply, State#{monitors => NewMonitors}}
    end;

handle_info(_Info, State) ->
    {noreply, State}.

-spec terminate(term(), map()) -> ok.
terminate(_Reason, _State) ->
    ok.
