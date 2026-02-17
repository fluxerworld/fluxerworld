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

-module(push_dispatcher).
-behaviour(gen_server).

-export([start_link/0, enqueue_send_notifications/8]).
-export([init/1, handle_call/3, handle_cast/2, handle_info/2, terminate/2, code_change/3]).

-define(DEFAULT_MAX_INFLIGHT, 16).
-define(DEFAULT_MAX_QUEUE, 2048).

-type push_job() :: #{
    user_ids := [integer()],
    message_data := map(),
    guild_id := integer(),
    channel_id := integer(),
    message_id := integer(),
    guild_name := binary() | undefined,
    channel_name := binary() | undefined,
    state_snapshot := map()
}.

-type state() :: #{
    queue := queue:queue(push_job()),
    queued := non_neg_integer(),
    inflight := non_neg_integer(),
    workers := #{reference() => true},
    max_inflight := pos_integer(),
    max_queue := pos_integer()
}.

-spec start_link() -> {ok, pid()} | {error, term()}.
start_link() ->
    gen_server:start_link({local, ?MODULE}, ?MODULE, [], []).

-spec enqueue_send_notifications(
    [integer()], map(), integer(), integer(), integer(), binary() | undefined, binary() | undefined, map()
) -> ok.
enqueue_send_notifications(
    UserIds,
    MessageData,
    GuildId,
    ChannelId,
    MessageId,
    GuildName,
    ChannelName,
    StateSnapshot
) ->
    Job = #{
        user_ids => UserIds,
        message_data => MessageData,
        guild_id => GuildId,
        channel_id => ChannelId,
        message_id => MessageId,
        guild_name => GuildName,
        channel_name => ChannelName,
        state_snapshot => StateSnapshot
    },
    logger:debug(
        "Push: enqueuing dispatch job",
        #{
            message_id => MessageId,
            channel_id => ChannelId,
            guild_id => GuildId,
            user_count => length(UserIds)
        }
    ),
    gen_server:cast(?MODULE, {enqueue, Job}).

-spec init([]) -> {ok, state()}.
init([]) ->
    {ok, #{
        queue => queue:new(),
        queued => 0,
        inflight => 0,
        workers => #{},
        max_inflight => get_int_or_default(push_dispatcher_max_inflight, ?DEFAULT_MAX_INFLIGHT),
        max_queue => get_int_or_default(push_dispatcher_max_queue, ?DEFAULT_MAX_QUEUE)
    }}.

-spec handle_call(term(), gen_server:from(), state()) -> {reply, ok, state()}.
handle_call(_Request, _From, State) ->
    {reply, ok, State}.

-spec handle_cast(term(), state()) -> {noreply, state()}.
handle_cast({enqueue, Job}, State) ->
    {noreply, maybe_enqueue_or_start(Job, State)};
handle_cast(_Msg, State) ->
    {noreply, State}.

-spec handle_info(term(), state()) -> {noreply, state()}.
handle_info({'DOWN', Ref, process, _Pid, _Reason}, State) ->
    Workers = maps:get(workers, State),
    case maps:is_key(Ref, Workers) of
        true ->
            RemainingWorkers = maps:remove(Ref, Workers),
            DecrementedInflight = max(0, maps:get(inflight, State) - 1),
            drain_queue(State#{
                workers := RemainingWorkers,
                inflight := DecrementedInflight
            });
        false ->
            {noreply, State}
    end;
handle_info(_Info, State) ->
    {noreply, State}.

-spec terminate(term(), state()) -> ok.
terminate(_Reason, _State) ->
    ok.

-spec code_change(term(), state(), term()) -> {ok, state()}.
code_change(_OldVsn, State, _Extra) ->
    {ok, State}.

-spec maybe_enqueue_or_start(push_job(), state()) -> state().
maybe_enqueue_or_start(Job, State) ->
    Inflight = maps:get(inflight, State),
    MaxInflight = maps:get(max_inflight, State),
    case Inflight < MaxInflight of
        true ->
            logger:debug(
                "Push: starting job immediately",
                #{
                    message_id => maps:get(message_id, Job),
                    inflight => Inflight,
                    max_inflight => MaxInflight
                }
            ),
            start_job(Job, State);
        false ->
            logger:debug(
                "Push: at capacity, queueing job",
                #{
                    message_id => maps:get(message_id, Job),
                    inflight => Inflight,
                    max_inflight => MaxInflight,
                    queued => maps:get(queued, State)
                }
            ),
            maybe_enqueue(Job, State)
    end.

-spec maybe_enqueue(push_job(), state()) -> state().
maybe_enqueue(Job, State) ->
    Queued = maps:get(queued, State),
    MaxQueue = maps:get(max_queue, State),
    case Queued < MaxQueue of
        true ->
            Queue0 = maps:get(queue, State),
            Queue1 = queue:in(Job, Queue0),
            State#{queue := Queue1, queued := Queued + 1};
        false ->
            logger:debug(
                "Push: queue full, dropping job",
                #{
                    message_id => maps:get(message_id, Job),
                    queued => Queued,
                    max_queue => MaxQueue
                }
            ),
            otel_metrics:counter(<<"push.dispatch_dropped">>, 1, #{}),
            State
    end.

-spec start_job(push_job(), state()) -> state().
start_job(Job, State) ->
    {_Pid, Ref} =
        spawn_monitor(fun() ->
            run_job(Job)
        end),
    Workers = maps:get(workers, State),
    Inflight = maps:get(inflight, State),
    State#{
        workers := maps:put(Ref, true, Workers),
        inflight := Inflight + 1
    }.

-spec drain_queue(state()) -> {noreply, state()}.
drain_queue(State) ->
    Inflight = maps:get(inflight, State),
    MaxInflight = maps:get(max_inflight, State),
    Queue0 = maps:get(queue, State),
    case Inflight < MaxInflight of
        true ->
            case queue:out(Queue0) of
                {{value, Job}, Queue1} ->
                    Queued = max(0, maps:get(queued, State) - 1),
                    State1 = State#{queue := Queue1, queued := Queued},
                    State2 = start_job(Job, State1),
                    drain_queue(State2);
                {empty, _} ->
                    {noreply, State}
            end;
        false ->
            {noreply, State}
    end.

-spec run_job(push_job()) -> ok.
run_job(Job) ->
    MessageId = maps:get(message_id, Job),
    try
        logger:debug(
            "Push: worker starting send_push_notifications",
            #{message_id => MessageId, user_count => length(maps:get(user_ids, Job))}
        ),
        _ = push_sender:send_push_notifications(
            maps:get(user_ids, Job),
            maps:get(message_data, Job),
            maps:get(guild_id, Job),
            maps:get(channel_id, Job),
            MessageId,
            maps:get(guild_name, Job),
            maps:get(channel_name, Job),
            maps:get(state_snapshot, Job)
        ),
        logger:debug("Push: worker completed", #{message_id => MessageId}),
        ok
    catch
        Class:Reason ->
            logger:debug(
                "Push: worker crashed",
                #{message_id => MessageId, class => Class, reason => Reason}
            ),
            ok
    end.

-spec get_int_or_default(atom(), integer()) -> integer().
get_int_or_default(Key, Default) ->
    case fluxer_gateway_env:get_optional(Key) of
        Value when is_integer(Value), Value > 0 -> Value;
        _ -> Default
    end.
