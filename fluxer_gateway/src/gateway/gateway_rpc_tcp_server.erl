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

-module(gateway_rpc_tcp_server).
-behaviour(gen_server).

-export([start_link/0, accept_loop/1]).
-export([init/1, handle_call/3, handle_cast/2, handle_info/2, terminate/2, code_change/3]).

-type state() :: #{
    listen_socket := inet:socket(),
    acceptor_pid := pid(),
    port := inet:port_number()
}.

-spec start_link() -> {ok, pid()} | {error, term()}.
start_link() ->
    gen_server:start_link({local, ?MODULE}, ?MODULE, [], []).

-spec init([]) -> {ok, state()} | {stop, term()}.
init([]) ->
    process_flag(trap_exit, true),
    Port = fluxer_gateway_env:get(rpc_tcp_port),
    case gen_tcp:listen(Port, listen_options()) of
        {ok, ListenSocket} ->
            AcceptorPid = spawn_link(?MODULE, accept_loop, [ListenSocket]),
            logger:info("Gateway TCP RPC listener started on port ~p", [Port]),
            {ok, #{
                listen_socket => ListenSocket,
                acceptor_pid => AcceptorPid,
                port => Port
            }};
        {error, Reason} ->
            {stop, {rpc_tcp_listen_failed, Port, Reason}}
    end.

-spec handle_call(term(), gen_server:from(), state()) -> {reply, ok, state()}.
handle_call(_Request, _From, State) ->
    {reply, ok, State}.

-spec handle_cast(term(), state()) -> {noreply, state()}.
handle_cast(_Msg, State) ->
    {noreply, State}.

-spec handle_info(term(), state()) -> {noreply, state()}.
handle_info({'EXIT', Pid, Reason}, #{acceptor_pid := Pid, listen_socket := ListenSocket} = State) ->
    case Reason of
        normal ->
            {noreply, State};
        shutdown ->
            {noreply, State};
        _ ->
            logger:error("Gateway TCP RPC acceptor crashed: ~p", [Reason]),
            NewAcceptorPid = spawn_link(?MODULE, accept_loop, [ListenSocket]),
            {noreply, State#{acceptor_pid => NewAcceptorPid}}
    end;
handle_info(_Info, State) ->
    {noreply, State}.

-spec terminate(term(), state()) -> ok.
terminate(_Reason, #{listen_socket := ListenSocket, port := Port}) ->
    catch gen_tcp:close(ListenSocket),
    logger:info("Gateway TCP RPC listener stopped on port ~p", [Port]),
    ok.

-spec code_change(term(), state(), term()) -> {ok, state()}.
code_change(_OldVsn, State, _Extra) ->
    {ok, State}.

-spec accept_loop(inet:socket()) -> ok.
accept_loop(ListenSocket) ->
    case gen_tcp:accept(ListenSocket) of
        {ok, Socket} ->
            _ = spawn_link(?MODULE, accept_loop, [ListenSocket]),
            gateway_rpc_tcp_connection:serve(Socket);
        {error, closed} ->
            ok;
        {error, Reason} ->
            logger:error("Gateway TCP RPC accept failed: ~p", [Reason]),
            timer:sleep(200),
            accept_loop(ListenSocket)
    end.

-spec listen_options() -> [gen_tcp:listen_option()].
listen_options() ->
    [
        binary,
        {packet, raw},
        {active, false},
        {reuseaddr, true},
        {nodelay, true},
        {backlog, 4096},
        {keepalive, true}
    ].
