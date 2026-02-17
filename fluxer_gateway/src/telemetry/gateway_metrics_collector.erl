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

-module(gateway_metrics_collector).
-behaviour(gen_server).

-export([start_link/0]).
-export([init/1, handle_call/3, handle_cast/2, handle_info/2, terminate/2, code_change/3]).

-export([
    inc_connections/0,
    inc_disconnections/0,
    inc_heartbeat_success/0,
    inc_heartbeat_failure/0,
    inc_resume_success/0,
    inc_resume_failure/0,
    inc_identify_rate_limited/0,
    record_rpc_latency/1,
    inc_websocket_close/1,
    inc_fanout/1,
    inc_guild_event_dispatched/2,
    inc_member_list_broadcast/0,
    inc_session_sync/0,
    inc_push_notification_sent/0,
    record_push_notification_time/1,
    inc_guild_state_change/1,
    inc_channel_event_fanout/2
]).

-type state() :: #{
    report_interval_ms := pos_integer(),
    timer_ref := reference() | undefined,
    connections := non_neg_integer(),
    disconnections := non_neg_integer(),
    heartbeat_success := non_neg_integer(),
    heartbeat_failure := non_neg_integer(),
    resume_success := non_neg_integer(),
    resume_failure := non_neg_integer(),
    identify_rate_limited := non_neg_integer(),
    rpc_latencies := [non_neg_integer()],
    fanout_success := non_neg_integer(),
    fanout_failure := non_neg_integer(),
    guild_events_dispatched := #{atom() | binary() => non_neg_integer()},
    member_list_broadcasts := non_neg_integer(),
    session_syncs := non_neg_integer(),
    push_notifications_sent := non_neg_integer(),
    push_notification_times := [non_neg_integer()],
    guild_state_changes := #{term() => non_neg_integer()},
    channel_events_fanout := #{term() => non_neg_integer()}
}.

-define(DEFAULT_REPORT_INTERVAL_MS, 30000).

-spec start_link() -> {ok, pid()} | {error, term()}.
start_link() ->
    gen_server:start_link({local, ?MODULE}, ?MODULE, [], []).

-spec init(list()) -> {ok, state()}.
init([]) ->
    Enabled = get_enabled(),
    ReportInterval = get_report_interval(),
    BaseState = #{
        report_interval_ms => ReportInterval,
        timer_ref => undefined,
        connections => 0,
        disconnections => 0,
        heartbeat_success => 0,
        heartbeat_failure => 0,
        resume_success => 0,
        resume_failure => 0,
        identify_rate_limited => 0,
        rpc_latencies => [],
        fanout_success => 0,
        fanout_failure => 0,
        guild_events_dispatched => #{},
        member_list_broadcasts => 0,
        session_syncs => 0,
        push_notifications_sent => 0,
        push_notification_times => [],
        guild_state_changes => #{},
        channel_events_fanout => #{}
    },
    case Enabled of
        true ->
            TimerRef = schedule_collection(ReportInterval),
            {ok, BaseState#{timer_ref := TimerRef}};
        false ->
            {ok, BaseState}
    end.

-spec handle_call(term(), gen_server:from(), state()) -> {reply, term(), state()}.
handle_call(_Request, _From, State) ->
    {reply, ok, State}.

-spec handle_cast(term(), state()) -> {noreply, state()}.
handle_cast(inc_connections, #{connections := Connections} = State) ->
    {noreply, State#{connections := Connections + 1}};
handle_cast(inc_disconnections, #{disconnections := Disconnections} = State) ->
    {noreply, State#{disconnections := Disconnections + 1}};
handle_cast(inc_heartbeat_success, #{heartbeat_success := HeartbeatSuccess} = State) ->
    {noreply, State#{heartbeat_success := HeartbeatSuccess + 1}};
handle_cast(inc_heartbeat_failure, #{heartbeat_failure := HeartbeatFailure} = State) ->
    {noreply, State#{heartbeat_failure := HeartbeatFailure + 1}};
handle_cast(inc_resume_success, #{resume_success := ResumeSuccess} = State) ->
    {noreply, State#{resume_success := ResumeSuccess + 1}};
handle_cast(inc_resume_failure, #{resume_failure := ResumeFailure} = State) ->
    {noreply, State#{resume_failure := ResumeFailure + 1}};
handle_cast(inc_identify_rate_limited, #{identify_rate_limited := IdentifyRateLimited} = State) ->
    {noreply, State#{identify_rate_limited := IdentifyRateLimited + 1}};
handle_cast({record_rpc_latency, LatencyMs}, #{rpc_latencies := Latencies} = State) ->
    MaxLatencies = 1000,
    NewLatencies =
        case length(Latencies) >= MaxLatencies of
            true -> [LatencyMs | lists:sublist(Latencies, MaxLatencies - 1)];
            false -> [LatencyMs | Latencies]
        end,
    {noreply, State#{rpc_latencies := NewLatencies}};
handle_cast(
    {inc_fanout, Success},
    #{fanout_success := FanoutSuccess, fanout_failure := FanoutFailure} = State
) ->
    case Success of
        1 -> {noreply, State#{fanout_success := FanoutSuccess + 1}};
        _ -> {noreply, State#{fanout_failure := FanoutFailure + 1}}
    end;
handle_cast({inc_guild_event_dispatched, EventType}, #{guild_events_dispatched := Events} = State) ->
    Count = maps:get(EventType, Events, 0),
    {noreply, State#{guild_events_dispatched := maps:put(EventType, Count + 1, Events)}};
handle_cast(inc_member_list_broadcast, #{member_list_broadcasts := Broadcasts} = State) ->
    {noreply, State#{member_list_broadcasts := Broadcasts + 1}};
handle_cast(inc_session_sync, #{session_syncs := Syncs} = State) ->
    {noreply, State#{session_syncs := Syncs + 1}};
handle_cast(inc_push_notification_sent, #{push_notifications_sent := Sent} = State) ->
    {noreply, State#{push_notifications_sent := Sent + 1}};
handle_cast({record_push_notification_time, TimeMs}, #{push_notification_times := Times} = State) ->
    MaxTimes = 1000,
    NewTimes =
        case length(Times) >= MaxTimes of
            true -> [TimeMs | lists:sublist(Times, MaxTimes - 1)];
            false -> [TimeMs | Times]
        end,
    {noreply, State#{push_notification_times := NewTimes}};
handle_cast({inc_guild_state_change, ChangeType}, #{guild_state_changes := Changes} = State) ->
    Count = maps:get(ChangeType, Changes, 0),
    {noreply, State#{guild_state_changes := maps:put(ChangeType, Count + 1, Changes)}};
handle_cast({inc_channel_event_fanout, EventType}, #{channel_events_fanout := Events} = State) ->
    Count = maps:get(EventType, Events, 0),
    {noreply, State#{channel_events_fanout := maps:put(EventType, Count + 1, Events)}};
handle_cast(_Msg, State) ->
    {noreply, State}.

-spec handle_info(term(), state()) -> {noreply, state()}.
handle_info(collect_and_report, #{report_interval_ms := Interval} = State) ->
    collect_and_report_metrics(State),
    TimerRef = schedule_collection(Interval),
    ResetState = State#{
        timer_ref := TimerRef,
        connections := 0,
        disconnections := 0,
        heartbeat_success := 0,
        heartbeat_failure := 0,
        resume_success := 0,
        resume_failure := 0,
        identify_rate_limited := 0,
        rpc_latencies := [],
        fanout_success := 0,
        fanout_failure := 0,
        guild_events_dispatched => #{},
        member_list_broadcasts => 0,
        session_syncs => 0,
        push_notifications_sent => 0,
        push_notification_times => [],
        guild_state_changes => #{},
        channel_events_fanout => #{}
    },
    {noreply, ResetState};
handle_info(_Info, State) ->
    {noreply, State}.

-spec terminate(term(), state()) -> ok.
terminate(_Reason, #{timer_ref := TimerRef}) ->
    case TimerRef of
        undefined -> ok;
        Ref -> erlang:cancel_timer(Ref)
    end,
    ok.

-spec code_change(term(), state() | tuple(), term()) -> {ok, state()}.
code_change(
    _OldVsn,
    {state, ReportIntervalMs, TimerRef, Connections, Disconnections, HeartbeatSuccess,
        HeartbeatFailure, ResumeSuccess, ResumeFailure, IdentifyRateLimited, RpcLatencies,
        FanoutSuccess, FanoutFailure},
    _Extra
) ->
    {ok, #{
        report_interval_ms => ReportIntervalMs,
        timer_ref => TimerRef,
        connections => Connections,
        disconnections => Disconnections,
        heartbeat_success => HeartbeatSuccess,
        heartbeat_failure => HeartbeatFailure,
        resume_success => ResumeSuccess,
        resume_failure => ResumeFailure,
        identify_rate_limited => IdentifyRateLimited,
        rpc_latencies => RpcLatencies,
        fanout_success => FanoutSuccess,
        fanout_failure => FanoutFailure
    }};
code_change(_OldVsn, State, _Extra) ->
    {ok, State}.

-spec schedule_collection(pos_integer()) -> reference().
schedule_collection(IntervalMs) ->
    erlang:send_after(IntervalMs, self(), collect_and_report).

-spec get_enabled() -> boolean().
get_enabled() ->
    case fluxer_gateway_env:get(gateway_metrics_enabled) of
        false -> false;
        _ -> true
    end.

-spec get_report_interval() -> pos_integer().
get_report_interval() ->
    case fluxer_gateway_env:get(gateway_metrics_report_interval_ms) of
        Value when is_integer(Value), Value > 0 -> Value;
        _ -> ?DEFAULT_REPORT_INTERVAL_MS
    end.

-spec collect_and_report_metrics(state()) -> ok.
collect_and_report_metrics(State) ->
    record_process_counts(),
    record_mailbox_sizes(),
    record_memory_stats(),
    record_system_stats(),
    record_event_metrics(State),
    ok.

-spec record_event_metrics(state()) -> ok.
record_event_metrics(State) ->
    #{
        rpc_latencies := RpcLatencies,
        connections := Connections,
        disconnections := Disconnections,
        heartbeat_success := HeartbeatSuccess,
        heartbeat_failure := HeartbeatFailure,
        resume_success := ResumeSuccess,
        resume_failure := ResumeFailure,
        identify_rate_limited := IdentifyRateLimited,
        fanout_success := FanoutSuccess,
        fanout_failure := FanoutFailure,
        guild_events_dispatched := GuildEvents,
        member_list_broadcasts := MemberListBroadcasts,
        session_syncs := SessionSyncs,
        push_notifications_sent := PushNotificationsSent,
        push_notification_times := PushNotificationTimes,
        guild_state_changes := GuildStateChanges,
        channel_events_fanout := ChannelEventsFanout
    } = State,
    otel_metrics:counter(<<"gateway.websocket.connections">>, Connections, #{}),
    otel_metrics:counter(<<"gateway.websocket.disconnections">>, Disconnections, #{}),
    otel_metrics:counter(<<"gateway.heartbeat.success">>, HeartbeatSuccess, #{}),
    otel_metrics:counter(<<"gateway.heartbeat.failure">>, HeartbeatFailure, #{}),
    otel_metrics:counter(<<"gateway.resume.success">>, ResumeSuccess, #{}),
    otel_metrics:counter(<<"gateway.resume.failure">>, ResumeFailure, #{}),
    otel_metrics:counter(<<"gateway.identify.rate_limited">>, IdentifyRateLimited, #{}),
    otel_metrics:counter(<<"gateway.websocket.fanout.success">>, FanoutSuccess, #{}),
    otel_metrics:counter(<<"gateway.websocket.fanout.failure">>, FanoutFailure, #{}),
    report_rpc_latency_stats(RpcLatencies),
    otel_metrics:counter(<<"gateway.rpc.latency.count">>, length(RpcLatencies), #{}),

    report_guild_event_metrics(GuildEvents),
    otel_metrics:counter(<<"gateway.guild.member_list.broadcasts">>, MemberListBroadcasts, #{}),
    otel_metrics:counter(<<"gateway.guild.session.syncs">>, SessionSyncs, #{}),
    otel_metrics:counter(
        <<"gateway.guild.push_notifications.sent">>, PushNotificationsSent, #{}
    ),
    report_push_notification_time_stats(PushNotificationTimes),
    report_guild_state_change_metrics(GuildStateChanges),
    report_channel_event_fanout_metrics(ChannelEventsFanout),
    ok.

-spec report_rpc_latency_stats([non_neg_integer()]) -> ok.
report_rpc_latency_stats([]) ->
    ok;
report_rpc_latency_stats(Latencies) ->
    Sorted = lists:sort(Latencies),
    Count = length(Sorted),
    Sum = lists:sum(Sorted),
    Avg = Sum / Count,
    Min = hd(Sorted),
    Max = lists:last(Sorted),
    P50 = percentile(Sorted, 50),
    P95 = percentile(Sorted, 95),
    P99 = percentile(Sorted, 99),
    otel_metrics:gauge(<<"gateway.rpc.latency.avg">>, Avg, #{}),
    otel_metrics:gauge(<<"gateway.rpc.latency.min">>, Min, #{}),
    otel_metrics:gauge(<<"gateway.rpc.latency.max">>, Max, #{}),
    otel_metrics:gauge(<<"gateway.rpc.latency.p50">>, P50, #{}),
    otel_metrics:gauge(<<"gateway.rpc.latency.p95">>, P95, #{}),
    otel_metrics:gauge(<<"gateway.rpc.latency.p99">>, P99, #{}),
    otel_metrics:gauge(<<"gateway.rpc.latency.sample.count">>, Count, #{}),
    ok.

-spec percentile([number()], number()) -> number().
percentile(SortedList, Percent) ->
    Len = length(SortedList),
    Index = max(1, min(Len, round(Len * Percent / 100))),
    lists:nth(Index, SortedList).

-spec record_process_counts() -> ok.
record_process_counts() ->
    otel_metrics:gauge(<<"gateway.sessions.count">>, get_manager_count(session_manager), #{}),
    otel_metrics:gauge(<<"gateway.guilds.count">>, get_manager_count(guild_manager), #{}),
    otel_metrics:gauge(<<"gateway.presences.count">>, get_manager_count(presence_manager), #{}),
    otel_metrics:gauge(<<"gateway.calls.count">>, get_manager_count(call_manager), #{}),
    ok.

-spec get_manager_count(atom()) -> non_neg_integer().
get_manager_count(Manager) ->
    case catch gen_server:call(Manager, get_global_count, 1000) of
        {ok, Count} when is_integer(Count) -> Count;
        Count when is_integer(Count) -> Count;
        _ -> 0
    end.

-spec record_mailbox_sizes() -> ok.
record_mailbox_sizes() ->
    Managers = [
        {session_manager, <<"gateway.mailbox.session_manager">>},
        {guild_manager, <<"gateway.mailbox.guild_manager">>},
        {presence_manager, <<"gateway.mailbox.presence_manager">>},
        {call_manager, <<"gateway.mailbox.call_manager">>},
        {push, <<"gateway.mailbox.push">>},
        {presence_cache, <<"gateway.mailbox.presence_cache">>},
        {presence_bus, <<"gateway.mailbox.presence_bus">>}
    ],
    lists:foreach(
        fun({Manager, MetricName}) ->
            case get_mailbox_size(Manager) of
                undefined -> ok;
                Size -> otel_metrics:gauge(MetricName, Size, #{})
            end
        end,
        Managers
    ),
    TotalMailbox = lists:foldl(
        fun({Manager, _}, Acc) ->
            case get_mailbox_size(Manager) of
                undefined -> Acc;
                Size -> Acc + Size
            end
        end,
        0,
        Managers
    ),
    otel_metrics:gauge(<<"gateway.mailbox.total">>, TotalMailbox, #{}),
    ok.

-spec get_mailbox_size(atom()) -> non_neg_integer() | undefined.
get_mailbox_size(Manager) ->
    case whereis(Manager) of
        undefined ->
            undefined;
        Pid ->
            case erlang:process_info(Pid, message_queue_len) of
                {message_queue_len, Size} -> Size;
                undefined -> undefined
            end
    end.

-spec record_memory_stats() -> ok.
record_memory_stats() ->
    otel_metrics:gauge(<<"gateway.memory.presence_cache">>, get_presence_cache_memory(), #{}),
    otel_metrics:gauge(<<"gateway.memory.push">>, get_push_process_memory(), #{}),
    record_guild_memory_stats(),
    ok.

-spec record_guild_memory_stats() -> ok.
record_guild_memory_stats() ->
    case catch process_memory_stats:get_guild_memory_stats(10000) of
        GuildStats when is_list(GuildStats), length(GuildStats) > 0 ->
            Memories = [maps:get(memory, G, 0) || G <- GuildStats],
            TotalMemory = lists:sum(Memories),
            GuildCount = length(Memories),
            AvgMemory = TotalMemory / GuildCount,
            MaxMemory = lists:max(Memories),
            MinMemory = lists:min(Memories),
            otel_metrics:gauge(<<"gateway.memory.guilds.total">>, TotalMemory, #{}),
            otel_metrics:gauge(<<"gateway.memory.guilds.count">>, GuildCount, #{}),
            otel_metrics:gauge(<<"gateway.memory.guilds.avg">>, AvgMemory, #{}),
            otel_metrics:gauge(<<"gateway.memory.guilds.max">>, MaxMemory, #{}),
            otel_metrics:gauge(<<"gateway.memory.guilds.min">>, MinMemory, #{}),
            ok;
        _ ->
            ok
    end.

-spec get_presence_cache_memory() -> non_neg_integer().
get_presence_cache_memory() ->
    case catch presence_cache:get_memory_stats() of
        {ok, #{memory_bytes := Bytes}} -> Bytes;
        _ -> 0
    end.

-spec get_push_process_memory() -> non_neg_integer().
get_push_process_memory() ->
    case whereis(push) of
        undefined ->
            0;
        Pid ->
            case erlang:process_info(Pid, memory) of
                {memory, Bytes} -> Bytes;
                undefined -> 0
            end
    end.

-spec record_system_stats() -> ok.
record_system_stats() ->
    {TotalMemory, ProcessMemory, SystemMemory} = get_memory_info(),
    otel_metrics:gauge(<<"gateway.memory.total">>, TotalMemory, #{}),
    otel_metrics:gauge(<<"gateway.memory.processes">>, ProcessMemory, #{}),
    otel_metrics:gauge(<<"gateway.memory.system">>, SystemMemory, #{}),
    otel_metrics:gauge(<<"gateway.process_count">>, erlang:system_info(process_count), #{}),
    ok.

-spec get_memory_info() -> {non_neg_integer(), non_neg_integer(), non_neg_integer()}.
get_memory_info() ->
    MemData = erlang:memory(),
    Total = proplists:get_value(total, MemData, 0),
    Processes = proplists:get_value(processes, MemData, 0),
    System = proplists:get_value(system, MemData, 0),
    {Total, Processes, System}.

-spec inc_connections() -> ok.
inc_connections() ->
    gen_server:cast(?MODULE, inc_connections).

-spec inc_disconnections() -> ok.
inc_disconnections() ->
    gen_server:cast(?MODULE, inc_disconnections).

-spec inc_heartbeat_success() -> ok.
inc_heartbeat_success() ->
    gen_server:cast(?MODULE, inc_heartbeat_success).

-spec inc_heartbeat_failure() -> ok.
inc_heartbeat_failure() ->
    gen_server:cast(?MODULE, inc_heartbeat_failure).

-spec inc_resume_success() -> ok.
inc_resume_success() ->
    gen_server:cast(?MODULE, inc_resume_success).

-spec inc_resume_failure() -> ok.
inc_resume_failure() ->
    gen_server:cast(?MODULE, inc_resume_failure).

-spec inc_identify_rate_limited() -> ok.
inc_identify_rate_limited() ->
    gen_server:cast(?MODULE, inc_identify_rate_limited).

-spec record_rpc_latency(non_neg_integer()) -> ok.
record_rpc_latency(LatencyMs) ->
    gen_server:cast(?MODULE, {record_rpc_latency, LatencyMs}).

-spec inc_websocket_close(term()) -> ok.
inc_websocket_close(Reason) ->
    ReasonBin = metric_label_to_binary(Reason),
    otel_metrics:counter(<<"gateway.websocket.close">>, 1, #{<<"reason">> => ReasonBin}),
    ok.

-spec inc_fanout(non_neg_integer()) -> ok.
inc_fanout(Success) when Success =:= 1; Success =:= 0 ->
    gen_server:cast(?MODULE, {inc_fanout, Success}).

-spec inc_guild_event_dispatched(atom() | binary(), 0..1) -> ok.
inc_guild_event_dispatched(EventType, Success)
    when Success =:= 0; Success =:= 1 ->
    OutcomeBin =
        case Success of
            1 -> <<"success">>;
            0 -> <<"failure">>
        end,
    otel_metrics:counter(<<"gateway.guild.events.dispatched">>, 1, #{
        <<"event_type">> => event_type_to_binary(EventType),
        <<"outcome">> => OutcomeBin
    }),
    gen_server:cast(?MODULE, {inc_guild_event_dispatched, EventType}).

-spec inc_member_list_broadcast() -> ok.
inc_member_list_broadcast() ->
    gen_server:cast(?MODULE, inc_member_list_broadcast).

-spec inc_session_sync() -> ok.
inc_session_sync() ->
    gen_server:cast(?MODULE, inc_session_sync).

-spec inc_push_notification_sent() -> ok.
inc_push_notification_sent() ->
    gen_server:cast(?MODULE, inc_push_notification_sent).

-spec record_push_notification_time(non_neg_integer()) -> ok.
record_push_notification_time(TimeMs) ->
    otel_metrics:histogram(<<"gateway.guild.push_notifications.time">>, TimeMs, #{}),
    gen_server:cast(?MODULE, {record_push_notification_time, TimeMs}).

-spec inc_guild_state_change(term()) -> ok.
inc_guild_state_change(ChangeType) ->
    otel_metrics:counter(<<"gateway.guild.state_changes">>, 1, #{
        <<"change_type">> => metric_label_to_binary(ChangeType)
    }),
    gen_server:cast(?MODULE, {inc_guild_state_change, ChangeType}).

-spec inc_channel_event_fanout(term(), 0..1) -> ok.
inc_channel_event_fanout(EventType, Success) when Success =:= 0; Success =:= 1 ->
    OutcomeBin =
        case Success of
            1 -> <<"success">>;
            0 -> <<"failure">>
        end,
    otel_metrics:counter(<<"gateway.channel.events.fanout">>, 1, #{
        <<"event_type">> => event_type_to_binary(EventType),
        <<"outcome">> => OutcomeBin
    }),
    gen_server:cast(?MODULE, {inc_channel_event_fanout, EventType}).

-spec report_guild_event_metrics(#{atom() | binary() => non_neg_integer()}) -> ok.
report_guild_event_metrics(Events) when map_size(Events) =:= 0 ->
    ok;
report_guild_event_metrics(Events) ->
    maps:foreach(
        fun(EventType, Count) ->
            otel_metrics:counter(<<"gateway.guild.events.dispatched">>, Count, #{
                <<"event_type">> => event_type_to_binary(EventType)
            })
        end,
        Events
    ),
    ok.

-spec report_push_notification_time_stats([non_neg_integer()]) -> ok.
report_push_notification_time_stats([]) ->
    ok;
report_push_notification_time_stats(Times) ->
    Sorted = lists:sort(Times),
    Count = length(Sorted),
    Sum = lists:sum(Sorted),
    Avg = Sum / Count,
    Min = hd(Sorted),
    Max = lists:last(Sorted),
    P50 = percentile(Sorted, 50),
    P95 = percentile(Sorted, 95),
    P99 = percentile(Sorted, 99),
    otel_metrics:gauge(<<"gateway.guild.push_notifications.time.avg">>, Avg, #{}),
    otel_metrics:gauge(<<"gateway.guild.push_notifications.time.min">>, Min, #{}),
    otel_metrics:gauge(<<"gateway.guild.push_notifications.time.max">>, Max, #{}),
    otel_metrics:gauge(<<"gateway.guild.push_notifications.time.p50">>, P50, #{}),
    otel_metrics:gauge(<<"gateway.guild.push_notifications.time.p95">>, P95, #{}),
    otel_metrics:gauge(<<"gateway.guild.push_notifications.time.p99">>, P99, #{}),
    otel_metrics:gauge(<<"gateway.guild.push_notifications.time.count">>, Count, #{}),
    ok.

-spec report_guild_state_change_metrics(#{term() => non_neg_integer()}) -> ok.
report_guild_state_change_metrics(Changes) when map_size(Changes) =:= 0 ->
    ok;
report_guild_state_change_metrics(Changes) ->
    maps:foreach(
        fun(ChangeType, Count) ->
            otel_metrics:counter(<<"gateway.guild.state_changes">>, Count, #{
                <<"change_type">> => metric_label_to_binary(ChangeType)
            })
        end,
        Changes
    ),
    ok.

-spec report_channel_event_fanout_metrics(#{term() => non_neg_integer()}) -> ok.
report_channel_event_fanout_metrics(Events) when map_size(Events) =:= 0 ->
    ok;
report_channel_event_fanout_metrics(Events) ->
    maps:foreach(
        fun(EventType, Count) ->
            otel_metrics:counter(<<"gateway.channel.events.fanout">>, Count, #{
                <<"event_type">> => event_type_to_binary(EventType)
            })
        end,
        Events
    ),
    ok.

-spec event_type_to_binary(term()) -> binary().
event_type_to_binary(EventType) when is_atom(EventType) ->
    atom_to_binary(EventType, utf8);
event_type_to_binary(EventType) when is_binary(EventType) ->
    EventType;
event_type_to_binary(EventType) ->
    metric_label_to_binary(EventType).

-spec metric_label_to_binary(term()) -> binary().
metric_label_to_binary(Value) when is_binary(Value) ->
    Value;
metric_label_to_binary(Value) when is_atom(Value) ->
    atom_to_binary(Value, utf8);
metric_label_to_binary(Value) when is_integer(Value) ->
    integer_to_binary(Value);
metric_label_to_binary(Value) when is_float(Value) ->
    float_to_binary(Value, [compact]);
metric_label_to_binary(Value) when is_list(Value) ->
    try
        unicode:characters_to_binary(Value)
    catch
        _:_ ->
            <<"invalid">>
    end;
metric_label_to_binary(Value) ->
    try
        unicode:characters_to_binary(io_lib:format("~p", [Value]))
    catch
        _:_ ->
            <<"invalid">>
    end.
