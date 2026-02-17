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

-module(guild_manager_shard).
-behaviour(gen_server).

-include_lib("fluxer_gateway/include/timeout_config.hrl").

-define(GUILD_API_CANARY_PERCENTAGE, 5).
-define(BATCH_SIZE, 10).
-define(BATCH_DELAY_MS, 100).

-export([start_link/1]).
-export([init/1, handle_call/3, handle_cast/2, handle_info/2, terminate/2, code_change/3]).

-type guild_id() :: integer().
-type guild_ref() :: {pid(), reference()}.
-type guild_data() :: #{binary() => term()}.
-type fetch_result() :: {ok, guild_data()} | {error, term()}.
-type state() :: #{
    guilds := #{guild_id() => guild_ref() | loading},
    api_host := string(),
    api_canary_host := undefined | string(),
    pending_requests := #{guild_id() => [gen_server:from()]},
    shard_index := non_neg_integer()
}.

-spec start_link(non_neg_integer()) -> {ok, pid()} | {error, term()}.
start_link(ShardIndex) ->
    gen_server:start_link(?MODULE, #{shard_index => ShardIndex}, []).

-spec init(map()) -> {ok, state()}.
init(Args) ->
    process_flag(trap_exit, true),
    fluxer_gateway_env:load(),
    ApiHost = fluxer_gateway_env:get(api_host),
    ApiCanaryHost = fluxer_gateway_env:get(api_canary_host),
    ShardIndex = maps:get(shard_index, Args, 0),
    {ok, #{
        guilds => #{},
        api_host => ApiHost,
        api_canary_host => ApiCanaryHost,
        pending_requests => #{},
        shard_index => ShardIndex
    }}.

-spec handle_call(term(), gen_server:from(), state()) ->
    {reply, term(), state()} | {noreply, state()}.
handle_call({start_or_lookup, GuildId}, From, State) ->
    do_start_or_lookup(GuildId, From, State);
handle_call({stop_guild, GuildId}, _From, State) ->
    do_stop_guild(GuildId, State);
handle_call({reload_guild, GuildId}, From, State) ->
    do_reload_guild(GuildId, From, State);
handle_call({reload_all_guilds, GuildIds}, From, State) ->
    do_reload_all_guilds(GuildIds, From, State);
handle_call({shutdown_guild, GuildId}, _From, State) ->
    do_shutdown_guild(GuildId, State);
handle_call(get_local_count, _From, State) ->
    Guilds = maps:get(guilds, State),
    Count = process_registry:get_count(Guilds),
    {reply, {ok, Count}, State};
handle_call(get_global_count, _From, State) ->
    Guilds = maps:get(guilds, State),
    Count = process_registry:get_count(Guilds),
    {reply, {ok, Count}, State};
handle_call(_Unknown, _From, State) ->
    {reply, ok, State}.

-spec handle_cast(term(), state()) -> {noreply, state()}.
handle_cast({guild_data_fetched, GuildId, Result}, State) ->
    handle_guild_data_fetched(GuildId, Result, State);
handle_cast({guild_data_reloaded, GuildId, Pid, From, Result}, State) ->
    handle_guild_data_reloaded(GuildId, Pid, From, Result, State);
handle_cast({all_guilds_reloaded, From, Count}, State) ->
    gen_server:reply(From, #{count => Count}),
    {noreply, State};
handle_cast(_Unknown, State) ->
    {noreply, State}.

-spec handle_info(term(), state()) -> {noreply, state()}.
handle_info({'DOWN', _Ref, process, Pid, _Reason}, State) ->
    Guilds = maps:get(guilds, State),
    NewGuilds = process_registry:cleanup_on_down(Pid, Guilds),
    {noreply, State#{guilds => NewGuilds}};
handle_info(_Unknown, State) ->
    {noreply, State}.

-spec terminate(term(), state()) -> ok.
terminate(_Reason, _State) ->
    ok.

-spec code_change(term(), term(), term()) -> {ok, state()}.
code_change(_OldVsn, State, _Extra) when is_map(State) ->
    {ok, State}.

-spec do_start_or_lookup(guild_id(), gen_server:from(), state()) ->
    {reply, {ok, pid()} | {error, term()}, state()} | {noreply, state()}.
do_start_or_lookup(GuildId, From, State) ->
    Guilds = maps:get(guilds, State),
    case maps:get(GuildId, Guilds, undefined) of
        {Pid, _Ref} ->
            {reply, {ok, Pid}, State};
        loading ->
            add_pending_request(GuildId, From, State);
        undefined ->
            lookup_or_fetch(GuildId, From, State)
    end.

-spec lookup_or_fetch(guild_id(), gen_server:from(), state()) ->
    {reply, {ok, pid()}, state()} | {noreply, state()}.
lookup_or_fetch(GuildId, From, State) ->
    GuildName = process_registry:build_process_name(guild, GuildId),
    case whereis(GuildName) of
        undefined ->
            start_fetch(GuildId, From, State);
        _ExistingPid ->
            Guilds = maps:get(guilds, State),
            case process_registry:lookup_or_monitor(GuildName, GuildId, Guilds) of
                {ok, Pid, _Ref, NewGuilds} ->
                    {reply, {ok, Pid}, State#{guilds => NewGuilds}};
                {error, not_found} ->
                    {reply, {error, process_died}, State}
            end
    end.

-spec start_fetch(guild_id(), gen_server:from(), state()) -> {noreply, state()}.
start_fetch(GuildId, From, State) ->
    Guilds = maps:get(guilds, State),
    NewGuilds = maps:put(GuildId, loading, Guilds),
    Pending = maps:get(pending_requests, State),
    NewPending = maps:put(GuildId, [From], Pending),
    NewState = State#{guilds => NewGuilds, pending_requests => NewPending},
    spawn_fetch(GuildId, State),
    {noreply, NewState}.

-spec spawn_fetch(guild_id(), state()) -> pid().
spawn_fetch(GuildId, State) ->
    Manager = self(),
    ApiHostInfo = select_api_host(State),
    spawn(fun() ->
        try
            Result = fetch_guild_data_with_fallback(GuildId, ApiHostInfo, State),
            gen_server:cast(Manager, {guild_data_fetched, GuildId, Result})
        catch
            _:_:_ ->
                gen_server:cast(Manager, {guild_data_fetched, GuildId, {error, fetch_failed}})
        end
    end).

-spec add_pending_request(guild_id(), gen_server:from(), state()) -> {noreply, state()}.
add_pending_request(GuildId, From, State) ->
    Pending = maps:get(pending_requests, State),
    Requests = maps:get(GuildId, Pending, []),
    NewPending = maps:put(GuildId, [From | Requests], Pending),
    {noreply, State#{pending_requests => NewPending}}.

-spec handle_guild_data_fetched(guild_id(), fetch_result(), state()) -> {noreply, state()}.
handle_guild_data_fetched(GuildId, Result, State) ->
    Pending = maps:get(pending_requests, State),
    Requests = maps:get(GuildId, Pending, []),
    Guilds = maps:get(guilds, State),
    case Result of
        {ok, Data} ->
            case start_guild(GuildId, Data, State) of
                {ok, Pid, NewState} ->
                    reply_to_all(Requests, {ok, Pid}),
                    NewPending = maps:remove(GuildId, Pending),
                    {noreply, NewState#{pending_requests => NewPending}};
                {error, Reason} ->
                    reply_to_all(Requests, {error, Reason}),
                    NewGuilds = maps:remove(GuildId, Guilds),
                    NewPending = maps:remove(GuildId, Pending),
                    {noreply, State#{guilds => NewGuilds, pending_requests => NewPending}}
            end;
        {error, Reason} ->
            reply_to_all(Requests, {error, Reason}),
            NewGuilds = maps:remove(GuildId, Guilds),
            NewPending = maps:remove(GuildId, Pending),
            {noreply, State#{guilds => NewGuilds, pending_requests => NewPending}}
    end.

-spec handle_guild_data_reloaded(guild_id(), pid(), gen_server:from(), fetch_result(), state()) ->
    {noreply, state()}.
handle_guild_data_reloaded(_GuildId, Pid, From, Result, State) ->
    case Result of
        {ok, Data} ->
            catch gen_server:call(Pid, {reload, Data}, ?GUILD_CALL_TIMEOUT),
            gen_server:reply(From, ok);
        _ ->
            gen_server:reply(From, {error, fetch_failed})
    end,
    {noreply, State}.

-spec reply_to_all([gen_server:from()], term()) -> ok.
reply_to_all(Requests, Reply) ->
    lists:foreach(fun(From) -> gen_server:reply(From, Reply) end, Requests).

-spec do_stop_guild(guild_id(), state()) -> {reply, ok, state()}.
do_stop_guild(GuildId, State) ->
    Guilds = maps:get(guilds, State),
    GuildName = process_registry:build_process_name(guild, GuildId),
    case maps:get(GuildId, Guilds, undefined) of
        {Pid, Ref} ->
            demonitor(Ref, [flush]),
            catch gen_server:stop(Pid, normal, ?SHUTDOWN_TIMEOUT),
            process_registry:safe_unregister(GuildName),
            NewGuilds = maps:remove(GuildId, Guilds),
            {reply, ok, State#{guilds => NewGuilds}};
        _ ->
            case whereis(GuildName) of
                undefined ->
                    {reply, ok, State};
                ExistingPid ->
                    catch gen_server:stop(ExistingPid, normal, ?SHUTDOWN_TIMEOUT),
                    process_registry:safe_unregister(GuildName),
                    {reply, ok, State}
            end
    end.

-spec do_reload_guild(guild_id(), gen_server:from(), state()) ->
    {reply, {error, not_found}, state()} | {noreply, state()}.
do_reload_guild(GuildId, From, State) ->
    Guilds = maps:get(guilds, State),
    GuildName = process_registry:build_process_name(guild, GuildId),
    case maps:get(GuildId, Guilds, undefined) of
        {Pid, _Ref} ->
            spawn_reload(GuildId, Pid, From, State),
            {noreply, State};
        _ ->
            case whereis(GuildName) of
                undefined ->
                    {reply, {error, not_found}, State};
                _ExistingPid ->
                    case process_registry:lookup_or_monitor(GuildName, GuildId, Guilds) of
                        {ok, Pid, _Ref, NewGuilds} ->
                            NewState = State#{guilds => NewGuilds},
                            spawn_reload(GuildId, Pid, From, NewState),
                            {noreply, NewState};
                        {error, not_found} ->
                            {reply, {error, not_found}, State}
                    end
            end
    end.

-spec spawn_reload(guild_id(), pid(), gen_server:from(), state()) -> pid().
spawn_reload(GuildId, Pid, From, State) ->
    Manager = self(),
    ApiHostInfo = select_api_host(State),
    spawn(fun() ->
        try
            Result = fetch_guild_data_with_fallback(GuildId, ApiHostInfo, State),
            gen_server:cast(Manager, {guild_data_reloaded, GuildId, Pid, From, Result})
        catch
            _:_:_ ->
                gen_server:cast(
                    Manager, {guild_data_reloaded, GuildId, Pid, From, {error, fetch_failed}}
                )
        end
    end).

-spec do_reload_all_guilds([guild_id()], gen_server:from(), state()) -> {noreply, state()}.
do_reload_all_guilds(GuildIds, From, State) ->
    Guilds = maps:get(guilds, State),
    GuildsToReload = select_guilds_to_reload(GuildIds, Guilds),
    Manager = self(),
    spawn(fun() ->
        try
            reload_guilds_in_batches(GuildsToReload, State),
            gen_server:cast(Manager, {all_guilds_reloaded, From, length(GuildsToReload)})
        catch
            _:_:_ ->
                gen_server:cast(Manager, {all_guilds_reloaded, From, 0})
        end
    end),
    {noreply, State}.

-spec select_guilds_to_reload([guild_id()], #{guild_id() => guild_ref() | loading}) ->
    [{guild_id(), pid()}].
select_guilds_to_reload([], Guilds) ->
    [{GuildId, Pid} || {GuildId, {Pid, _Ref}} <- maps:to_list(Guilds)];
select_guilds_to_reload(GuildIds, Guilds) ->
    lists:filtermap(
        fun(GuildId) ->
            case maps:get(GuildId, Guilds, undefined) of
                {Pid, _Ref} -> {true, {GuildId, Pid}};
                _ -> false
            end
        end,
        GuildIds
    ).

-spec reload_guilds_in_batches([{guild_id(), pid()}], state()) -> ok.
reload_guilds_in_batches([], _State) ->
    ok;
reload_guilds_in_batches(Guilds, State) ->
    {Batch, Remaining} = lists:split(min(?BATCH_SIZE, length(Guilds)), Guilds),
    reload_batch(Batch, State),
    case Remaining of
        [] ->
            ok;
        _ ->
            timer:sleep(?BATCH_DELAY_MS),
            reload_guilds_in_batches(Remaining, State)
    end.

-spec reload_batch([{guild_id(), pid()}], state()) -> ok.
reload_batch(Batch, State) ->
    ApiHostInfo = select_api_host(State),
    lists:foreach(
        fun({GuildId, Pid}) ->
            spawn(fun() ->
                try
                    case fetch_guild_data_with_fallback(GuildId, ApiHostInfo, State) of
                        {ok, Data} ->
                            catch gen_server:call(Pid, {reload, Data}, ?GUILD_CALL_TIMEOUT);
                        {error, _Reason} ->
                            ok
                    end
                catch
                    _:_ -> ok
                end
            end)
        end,
        Batch
    ).

-spec do_shutdown_guild(guild_id(), state()) -> {reply, ok, state()}.
do_shutdown_guild(GuildId, State) ->
    Guilds = maps:get(guilds, State),
    GuildName = process_registry:build_process_name(guild, GuildId),
    case maps:get(GuildId, Guilds, undefined) of
        {Pid, Ref} ->
            demonitor(Ref, [flush]),
            catch gen_server:call(Pid, {terminate}, ?SHUTDOWN_TIMEOUT),
            process_registry:safe_unregister(GuildName),
            NewGuilds = maps:remove(GuildId, Guilds),
            {reply, ok, State#{guilds => NewGuilds}};
        _ ->
            case whereis(GuildName) of
                undefined ->
                    {reply, ok, State};
                ExistingPid ->
                    catch gen_server:call(ExistingPid, {terminate}, ?SHUTDOWN_TIMEOUT),
                    process_registry:safe_unregister(GuildName),
                    {reply, ok, State}
            end
    end.

-spec start_guild(guild_id(), guild_data(), state()) -> {ok, pid(), state()} | {error, term()}.
start_guild(GuildId, Data, State) ->
    GuildName = process_registry:build_process_name(guild, GuildId),
    case whereis(GuildName) of
        undefined ->
            start_new_guild(GuildId, Data, GuildName, State);
        _ExistingPid ->
            lookup_existing_guild(GuildId, GuildName, State)
    end.

-spec start_new_guild(guild_id(), guild_data(), atom(), state()) ->
    {ok, pid(), state()} | {error, term()}.
start_new_guild(GuildId, Data, GuildName, State) ->
    GuildState = #{
        id => GuildId,
        data => Data,
        sessions => #{}
    },
    Guilds = maps:get(guilds, State),
    GuildModule =
        case is_very_large_guild(Data) of
            true -> very_large_guild;
            false -> guild
        end,
    case GuildModule:start_link(GuildState) of
        {ok, Pid} ->
            case process_registry:register_and_monitor(GuildName, Pid, Guilds) of
                {ok, RegisteredPid, Ref, NewGuilds0} ->
                    CleanGuilds = maps:remove(GuildName, NewGuilds0),
                    NewGuilds = maps:put(GuildId, {RegisteredPid, Ref}, CleanGuilds),
                    {ok, RegisteredPid, State#{guilds => NewGuilds}};
                {error, Reason} ->
                    {error, Reason}
            end;
        Error ->
            Error
    end.

-spec is_very_large_guild(guild_data()) -> boolean().
is_very_large_guild(Data) when is_map(Data) ->
    Guild = maps:get(<<"guild">>, Data, #{}),
    Features = maps:get(<<"features">>, Guild, []),
    lists:member(<<"VERY_LARGE_GUILD">>, Features);
is_very_large_guild(_) ->
    false.

-spec lookup_existing_guild(guild_id(), atom(), state()) -> {ok, pid(), state()} | {error, term()}.
lookup_existing_guild(GuildId, GuildName, State) ->
    Guilds = maps:get(guilds, State),
    case process_registry:lookup_or_monitor(GuildName, GuildId, Guilds) of
        {ok, Pid, _Ref, NewGuilds} ->
            {ok, Pid, State#{guilds => NewGuilds}};
        {error, not_found} ->
            {error, process_died}
    end.

-spec fetch_guild_data(guild_id(), string()) -> fetch_result().
fetch_guild_data(GuildId, ApiHost) ->
    RpcRequest = #{
        <<"type">> => <<"guild">>,
        <<"guild_id">> => type_conv:to_binary(GuildId),
        <<"version">> => 1
    },
    Url = rpc_client:get_rpc_url(ApiHost),
    Headers = rpc_client:get_rpc_headers() ++ [{<<"content-type">>, <<"application/json">>}],
    Body = json:encode(RpcRequest),
    case gateway_http_client:request(rpc, post, Url, Headers, Body) of
        {ok, 200, _RespHeaders, RespBody} ->
            handle_fetch_response(RespBody);
        {ok, StatusCode, _RespHeaders, _RespBody} ->
            handle_fetch_error(StatusCode);
        {error, Reason} ->
            {error, {request_failed, Reason}}
    end.

-spec handle_fetch_response(binary()) -> fetch_result().
handle_fetch_response(RespBody) ->
    Response = json:decode(RespBody),
    Data = maps:get(<<"data">>, Response, #{}),
    {ok, Data}.

-spec handle_fetch_error(integer()) -> {error, {http_status, integer()}}.
handle_fetch_error(StatusCode) ->
    {error, {http_status, StatusCode}}.

-spec select_api_host(state()) -> {string(), boolean()}.
select_api_host(State) ->
    case maps:get(api_canary_host, State) of
        undefined ->
            {maps:get(api_host, State), false};
        _ ->
            case should_use_canary_api() of
                true -> {maps:get(api_canary_host, State), true};
                false -> {maps:get(api_host, State), false}
            end
    end.

-spec should_use_canary_api() -> boolean().
should_use_canary_api() ->
    erlang:unique_integer([positive]) rem 100 < ?GUILD_API_CANARY_PERCENTAGE.

-spec fetch_guild_data_with_fallback(guild_id(), {string(), boolean()}, state()) -> fetch_result().
fetch_guild_data_with_fallback(GuildId, {ApiHost, false}, _State) ->
    fetch_guild_data(GuildId, ApiHost);
fetch_guild_data_with_fallback(GuildId, {ApiHost, true}, State) ->
    case fetch_guild_data(GuildId, ApiHost) of
        {ok, Data} ->
            {ok, Data};
        Error ->
            StableHost = maps:get(api_host, State),
            case StableHost == ApiHost of
                true ->
                    Error;
                false ->
                    fetch_guild_data(GuildId, StableHost)
            end
    end.

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").

select_api_host_no_canary_test() ->
    State = #{api_host => "http://api.local", api_canary_host => undefined},
    {Host, IsCanary} = select_api_host(State),
    ?assertEqual("http://api.local", Host),
    ?assertEqual(false, IsCanary).

should_use_canary_api_returns_boolean_test() ->
    Result = should_use_canary_api(),
    ?assert(is_boolean(Result)).

select_guilds_to_reload_empty_ids_test() ->
    Guilds = #{1 => {self(), make_ref()}, 2 => {self(), make_ref()}},
    Result = select_guilds_to_reload([], Guilds),
    ?assertEqual(2, length(Result)).

select_guilds_to_reload_specific_ids_test() ->
    Pid = self(),
    Ref = make_ref(),
    Guilds = #{1 => {Pid, Ref}, 2 => {Pid, Ref}, 3 => loading},
    Result = select_guilds_to_reload([1, 3], Guilds),
    ?assertEqual(1, length(Result)).

reply_to_all_empty_list_test() ->
    ?assertEqual(ok, reply_to_all([], ok)).

do_start_or_lookup_loading_deduplicates_requests_test() ->
    GuildId = 4444,
    From1 = {self(), make_ref()},
    From2 = {self(), make_ref()},
    State0 = #{
        guilds => #{GuildId => loading},
        api_host => "http://api.local",
        api_canary_host => undefined,
        pending_requests => #{},
        shard_index => 0
    },
    {noreply, State1} = do_start_or_lookup(GuildId, From1, State0),
    Pending1 = maps:get(pending_requests, State1),
    ?assertEqual([From1], maps:get(GuildId, Pending1)),
    {noreply, State2} = do_start_or_lookup(GuildId, From2, State1),
    Pending2 = maps:get(pending_requests, State2),
    Requests = maps:get(GuildId, Pending2),
    ?assertEqual(2, length(Requests)),
    ?assert(lists:member(From1, Requests)),
    ?assert(lists:member(From2, Requests)).

-endif.
