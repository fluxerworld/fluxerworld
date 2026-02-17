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

-module(guild_crash_logger).
-behaviour(gen_server).

-define(FLUSH_INTERVAL_MS, 45_000).
-define(DUPLICATE_WINDOW_MS, 30 * 60 * 1000).

-export([start_link/0, report_crash/2]).
-export([init/1, handle_cast/2, handle_call/3, handle_info/2, terminate/2, code_change/3]).

-type state() :: #{
    queue := [{binary(), binary()}],
    recent := #{binary() => integer()}
}.

-spec start_link() -> {ok, pid()} | {error, term()}.
start_link() ->
    gen_server:start_link({local, ?MODULE}, ?MODULE, [], []).

-spec report_crash(binary(), binary()) -> ok.
report_crash(GuildId, Stacktrace) ->
    gen_server:cast(?MODULE, {report, GuildId, Stacktrace}).

-spec init([]) -> {ok, state()}.
init([]) ->
    schedule_flush(),
    {ok, #{queue => [], recent => #{}}}.

-spec handle_cast(term(), state()) -> {noreply, state()}.
handle_cast({report, GuildId, Stacktrace}, #{queue := Queue, recent := Recent} = State) ->
    Now = erlang:system_time(millisecond),
    {PrunedRecent, ShouldEnqueue} = should_record_crash(GuildId, Now, Recent),
    NewState =
        case ShouldEnqueue of
            true ->
                State#{
                    queue := [{GuildId, Stacktrace} | Queue],
                    recent := PrunedRecent
                };
            false ->
                State#{recent := PrunedRecent}
        end,
    {noreply, NewState}.

-spec handle_call(term(), gen_server:from(), state()) -> {reply, ok, state()}.
handle_call(_Request, _From, State) ->
    {reply, ok, State}.

-spec handle_info(term(), state()) -> {noreply, state()}.
handle_info(flush, #{queue := Queue} = State) ->
    flush_queue(lists:reverse(Queue)),
    schedule_flush(),
    {noreply, State#{queue := []}};
handle_info(_, State) ->
    {noreply, State}.

-spec terminate(term(), state()) -> ok.
terminate(_Reason, #{queue := Queue}) ->
    flush_queue(lists:reverse(Queue)),
    ok.

-spec code_change(term(), state(), term()) -> {ok, state()}.
code_change(_OldVsn, State, _Extra) ->
    {ok, State}.

-spec schedule_flush() -> reference().
schedule_flush() ->
    erlang:send_after(?FLUSH_INTERVAL_MS, self(), flush).

-spec should_record_crash(binary(), integer(), map()) -> {map(), boolean()}.
should_record_crash(GuildId, Now, Recent) ->
    Pruned = prune_recent(Recent, Now),
    case maps:get(GuildId, Pruned, undefined) of
        undefined ->
            {maps:put(GuildId, Now, Pruned), true};
        Timestamp when Now - Timestamp >= ?DUPLICATE_WINDOW_MS ->
            {maps:put(GuildId, Now, Pruned), true};
        _ ->
            {Pruned, false}
    end.

-spec prune_recent(map(), integer()) -> map().
prune_recent(Recent, Now) ->
    maps:fold(
        fun(GuildId, Timestamp, Acc) ->
            case Now - Timestamp < ?DUPLICATE_WINDOW_MS of
                true -> maps:put(GuildId, Timestamp, Acc);
                false -> Acc
            end
        end,
        #{},
        Recent
    ).

-spec flush_queue([{binary(), binary()}]) -> ok.
flush_queue([]) ->
    ok;
flush_queue(Items) ->
    lists:foreach(fun send_event/1, Items).

-spec send_event({binary(), binary()}) -> ok.
send_event({GuildId, Stacktrace}) ->
    Request = #{
        <<"type">> => <<"log_guild_crash">>,
        <<"guild_id">> => GuildId,
        <<"stacktrace">> => Stacktrace
    },
    rpc_client:call(Request),
    ok.
