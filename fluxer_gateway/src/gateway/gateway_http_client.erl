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

-module(gateway_http_client).
-behaviour(gen_server).

-export([start_link/0, request/5, request/6]).
-export([init/1, handle_call/3, handle_cast/2, handle_info/2, terminate/2, code_change/3]).

-define(SERVER, ?MODULE).
-define(CIRCUIT_TABLE, gateway_http_circuit_breaker).
-define(INFLIGHT_TABLE, gateway_http_inflight).

-define(DEFAULT_RPC_CONNECT_TIMEOUT_MS, 5000).
-define(DEFAULT_RPC_RECV_TIMEOUT_MS, 30000).
-define(DEFAULT_PUSH_CONNECT_TIMEOUT_MS, 3000).
-define(DEFAULT_PUSH_RECV_TIMEOUT_MS, 5000).

-define(DEFAULT_RPC_MAX_CONCURRENCY, 512).
-define(DEFAULT_PUSH_MAX_CONCURRENCY, 256).

-define(DEFAULT_FAILURE_THRESHOLD, 6).
-define(DEFAULT_RECOVERY_TIMEOUT_MS, 15000).
-define(DEFAULT_CLEANUP_INTERVAL_MS, 30000).
-define(DEFAULT_CLEANUP_MAX_AGE_MS, 300000).

-type workload() :: rpc | push.
-type method() :: get | post | put | patch | delete | head | options.
-type request_headers() :: [{binary() | string(), binary() | string()}].
-type request_options() :: #{
    connect_timeout => timeout(),
    recv_timeout => timeout(),
    max_concurrency => pos_integer(),
    failure_threshold => pos_integer(),
    recovery_timeout_ms => pos_integer(),
    content_type => binary() | string()
}.
-type response() :: {ok, non_neg_integer(), [{binary(), binary()}], binary()} | {error, term()}.

-type state() :: #{}.

-spec start_link() -> {ok, pid()} | {error, term()}.
start_link() ->
    case whereis(?SERVER) of
        undefined ->
            case gen_server:start_link({local, ?SERVER}, ?MODULE, [], []) of
                {error, {already_started, Pid}} when is_pid(Pid) ->
                    {ok, Pid};
                Other ->
                    Other
            end;
        Pid when is_pid(Pid) ->
            {ok, Pid}
    end.

-spec request(workload(), method(), iodata(), request_headers(), iodata() | undefined) -> response().
request(Workload, Method, Url, Headers, Body) ->
    request(Workload, Method, Url, Headers, Body, #{}).

-spec request(workload(), method(), iodata(), request_headers(), iodata() | undefined, request_options()) ->
    response().
request(Workload, Method, Url, Headers, Body, Opts) when is_map(Opts) ->
    ensure_runtime(Workload),
    WorkloadOpts = merged_workload_options(Workload, Opts),
    MaxConcurrency = maps:get(max_concurrency, WorkloadOpts),
    FailureThreshold = maps:get(failure_threshold, WorkloadOpts),
    RecoveryTimeoutMs = maps:get(recovery_timeout_ms, WorkloadOpts),
    Host = extract_host_key(Url),
    CircuitKey = {Workload, Host},
    case allow_circuit_request(CircuitKey, RecoveryTimeoutMs) of
        ok ->
            case acquire_inflight_slot(Workload, MaxConcurrency) of
                ok ->
                    Result = safe_do_request(Workload, Method, Url, Headers, Body, WorkloadOpts),
                    release_inflight_slot(Workload),
                    update_circuit_state(CircuitKey, Result, FailureThreshold),
                    Result;
                {error, overloaded} ->
                    {error, overloaded}
            end;
        {error, circuit_open} ->
            {error, circuit_open}
    end.

-spec safe_do_request(
    workload(), method(), iodata(), request_headers(), iodata() | undefined, request_options()
) ->
    response().
safe_do_request(Workload, Method, Url, Headers, Body, Opts) ->
    try do_request(Workload, Method, Url, Headers, Body, Opts) of
        Result ->
            Result
    catch
        Class:Reason:Stacktrace ->
            {error,
                {request_exception, #{
                    class => Class,
                    reason => Reason,
                    frame => first_stack_frame(Stacktrace),
                    workload => Workload,
                    method => Method,
                    url => ensure_binary(Url)
                }}}
    end.

-spec init([]) -> {ok, state()}.
init([]) ->
    process_flag(trap_exit, true),
    ensure_table(
        ?CIRCUIT_TABLE,
        [named_table, public, set, {read_concurrency, true}, {write_concurrency, true}]
    ),
    ensure_table(
        ?INFLIGHT_TABLE,
        [named_table, public, set, {read_concurrency, true}, {write_concurrency, true}]
    ),
    ok = ensure_httpc_profile(profile_for(rpc), rpc),
    ok = ensure_httpc_profile(profile_for(push), push),
    schedule_cleanup(),
    {ok, #{}}.

-spec handle_call(term(), gen_server:from(), state()) -> {reply, ok, state()}.
handle_call(_Request, _From, State) ->
    {reply, ok, State}.

-spec handle_cast(term(), state()) -> {noreply, state()}.
handle_cast(_Msg, State) ->
    {noreply, State}.

-spec handle_info(term(), state()) -> {noreply, state()}.
handle_info(cleanup_circuits, State) ->
    prune_circuit_table(),
    schedule_cleanup(),
    {noreply, State};
handle_info(_Info, State) ->
    {noreply, State}.

-spec terminate(term(), state()) -> ok.
terminate(_Reason, _State) ->
    ok.

-spec code_change(term(), state(), term()) -> {ok, state()}.
code_change(_OldVsn, State, _Extra) ->
    {ok, State}.

-spec ensure_table(atom(), [term()]) -> ok.
ensure_table(Name, Options) ->
    case ets:whereis(Name) of
        undefined ->
            try
                _ = ets:new(Name, Options),
                ok
            catch
                error:badarg -> ok
            end;
        _ ->
            ok
    end.

-spec ensure_runtime(workload()) -> ok.
ensure_runtime(Workload) ->
    ok = ensure_started(),
    _ = Workload,
    ok.

-spec ensure_started() -> ok.
ensure_started() ->
    case start_link() of
        {ok, _Pid} ->
            ok;
        _ ->
            ok
    end.

-spec schedule_cleanup() -> reference().
schedule_cleanup() ->
    erlang:send_after(cleanup_interval_ms(), self(), cleanup_circuits).

-spec prune_circuit_table() -> ok.
prune_circuit_table() ->
    Now = erlang:system_time(millisecond),
    MaxAgeMs = cleanup_max_age_ms(),
    _ =
        ets:foldl(
            fun({Key, CircuitState}, Acc) ->
                case is_stale_circuit(CircuitState, Now, MaxAgeMs) of
                    true ->
                        ets:delete(?CIRCUIT_TABLE, Key),
                        Acc;
                    false ->
                        Acc
                end
            end,
            ok,
            ?CIRCUIT_TABLE
        ),
    ok.

-spec is_stale_circuit(map(), integer(), integer()) -> boolean().
is_stale_circuit(#{state := open, opened_at := OpenedAt}, Now, MaxAgeMs) ->
    Now - OpenedAt > MaxAgeMs;
is_stale_circuit(#{state := closed, failures := 0, updated_at := UpdatedAt}, Now, MaxAgeMs) ->
    Now - UpdatedAt > MaxAgeMs;
is_stale_circuit(_, _, _) ->
    false.

-spec allow_circuit_request({workload(), binary()}, pos_integer()) -> ok | {error, circuit_open}.
allow_circuit_request(CircuitKey, RecoveryTimeoutMs) ->
    Now = erlang:system_time(millisecond),
    case safe_lookup_circuit(CircuitKey) of
        [] ->
            ok;
        [{_, #{state := open, opened_at := OpenedAt}} = Entry] ->
            case Now - OpenedAt >= RecoveryTimeoutMs of
                true ->
                    {_, State0} = Entry,
                    NewState = State0#{state => half_open, updated_at => Now},
                    ets:insert(?CIRCUIT_TABLE, {CircuitKey, NewState}),
                    ok;
                false ->
                    {error, circuit_open}
            end;
        _ ->
            ok
    end.

-spec safe_lookup_circuit({workload(), binary()}) -> list().
safe_lookup_circuit(Key) ->
    try ets:lookup(?CIRCUIT_TABLE, Key) of
        Result -> Result
    catch
        error:badarg -> []
    end.

-spec acquire_inflight_slot(workload(), pos_integer()) -> ok | {error, overloaded}.
acquire_inflight_slot(Workload, MaxConcurrency) ->
    case safe_update_counter(?INFLIGHT_TABLE, Workload, {2, 1}) of
        {ok, Count} when Count =< MaxConcurrency ->
            ok;
        {ok, _Count} ->
            _ = safe_update_counter(?INFLIGHT_TABLE, Workload, {2, -1}),
            {error, overloaded};
        {error, _Reason} ->
            {error, overloaded}
    end.

-spec release_inflight_slot(workload()) -> ok.
release_inflight_slot(Workload) ->
    _ = safe_update_counter(?INFLIGHT_TABLE, Workload, {2, -1}),
    ok.

-spec safe_update_counter(atom(), term(), {pos_integer(), integer()}) ->
    {ok, integer()} | {error, term()}.
safe_update_counter(Table, Key, Op) ->
    try
        {ok, ets:update_counter(Table, Key, Op, {Key, 0})}
    catch
        error:badarg ->
            ok = ensure_started(),
            try
                {ok, ets:update_counter(Table, Key, Op, {Key, 0})}
            catch
                error:badarg ->
                    {error, badarg}
            end
    end.

-spec update_circuit_state({workload(), binary()}, response(), pos_integer()) -> ok.
update_circuit_state(CircuitKey, Result, FailureThreshold) ->
    Now = erlang:system_time(millisecond),
    case should_count_failure(Result) of
        true ->
            record_failure(CircuitKey, FailureThreshold, Now);
        false ->
            record_success(CircuitKey, Now)
    end.

-spec should_count_failure(response()) -> boolean().
should_count_failure({error, _Reason}) ->
    true;
should_count_failure({ok, StatusCode, _Headers, _Body}) when StatusCode >= 500 ->
    true;
should_count_failure(_) ->
    false.

-spec record_failure({workload(), binary()}, pos_integer(), integer()) -> ok.
record_failure(CircuitKey, Threshold, Now) ->
    case safe_lookup_circuit(CircuitKey) of
        [] ->
            ets:insert(?CIRCUIT_TABLE, {CircuitKey, #{
                state => closed,
                failures => 1,
                opened_at => undefined,
                updated_at => Now
            }}),
            ok;
        [{_, #{failures := Failures} = Existing}] ->
            NewFailures = Failures + 1,
            NewState =
                case NewFailures >= Threshold of
                    true -> open;
                    false -> maps:get(state, Existing, closed)
                end,
            OpenedAt =
                case NewState of
                    open -> Now;
                    _ -> maps:get(opened_at, Existing, undefined)
                end,
            ets:insert(?CIRCUIT_TABLE, {CircuitKey, Existing#{
                state => NewState,
                failures => NewFailures,
                opened_at => OpenedAt,
                updated_at => Now
            }}),
            ok
    end.

-spec record_success({workload(), binary()}, integer()) -> ok.
record_success(CircuitKey, Now) ->
    case safe_lookup_circuit(CircuitKey) of
        [] ->
            ok;
        [{_, Existing}] ->
            NewState = Existing#{
                state => closed,
                failures => 0,
                updated_at => Now
            },
            ets:insert(?CIRCUIT_TABLE, {CircuitKey, maps:remove(opened_at, NewState)}),
            ok
    end.

-spec do_request(workload(), method(), iodata(), request_headers(), iodata() | undefined, request_options()) ->
    response().
do_request(Workload, Method, Url, Headers, Body, Opts) ->
    HttpMethod = normalize_method(Method),
    UrlString = ensure_list(Url),
    RequestHeaders = normalize_request_headers(Headers),
    RequestTuple = build_request_tuple(UrlString, RequestHeaders, Body, Opts),
    ConnectTimeout = maps:get(connect_timeout, Opts),
    RecvTimeout = maps:get(recv_timeout, Opts),
    HttpOptions = [
        {connect_timeout, ConnectTimeout},
        {timeout, RecvTimeout},
        {autoredirect, false}
    ],
    RequestOptions = [{body_format, binary}],
    case httpc:request(HttpMethod, RequestTuple, HttpOptions, RequestOptions, profile_for(Workload)) of
        {ok, {{_HttpVersion, StatusCode, _ReasonPhrase}, RespHeaders, RespBody}} ->
            {ok, StatusCode, normalize_response_headers(RespHeaders), ensure_binary(RespBody)};
        {error, Reason} ->
            {error, Reason}
    end.

-spec normalize_method(method() | atom()) -> method().
normalize_method(post) -> post;
normalize_method(get) -> get;
normalize_method(put) -> put;
normalize_method(patch) -> patch;
normalize_method(delete) -> delete;
normalize_method(head) -> head;
normalize_method(options) -> options;
normalize_method(_) -> post.

-spec build_request_tuple(string(), [{string(), string()}], iodata() | undefined, request_options()) ->
    {string(), [{string(), string()}]}
    | {string(), [{string(), string()}], string(), iodata()}.
build_request_tuple(Url, Headers, undefined, _Opts) ->
    {Url, Headers};
build_request_tuple(Url, Headers, Body, Opts) ->
    ContentType = resolve_content_type(Headers, Opts),
    {Url, Headers, ContentType, Body}.

-spec resolve_content_type([{string(), string()}], request_options()) -> string().
resolve_content_type(Headers, Opts) ->
    case maps:get(content_type, Opts, undefined) of
        undefined ->
            case find_content_type_header(Headers) of
                undefined -> "application/json";
                Value -> Value
            end;
        Value ->
            ensure_list(Value)
    end.

-spec find_content_type_header([{string(), string()}]) -> string() | undefined.
find_content_type_header([]) ->
    undefined;
find_content_type_header([{Name, Value} | Rest]) ->
    case string:lowercase(Name) of
        "content-type" -> Value;
        _ -> find_content_type_header(Rest)
    end.

-spec normalize_request_headers(request_headers()) -> [{string(), string()}].
normalize_request_headers(Headers) ->
    [
        {ensure_list(Name), ensure_list(Value)}
     || {Name, Value} <- Headers
    ].

-spec normalize_response_headers([{string(), string()}]) -> [{binary(), binary()}].
normalize_response_headers(Headers) ->
    [
        {list_to_binary(Name), list_to_binary(Value)}
     || {Name, Value} <- Headers
    ].

-spec extract_host_key(iodata()) -> binary().
extract_host_key(Url) ->
    UrlString = ensure_list(Url),
    try
        Parsed = uri_string:parse(UrlString),
        case maps:get(host, Parsed, undefined) of
            undefined -> <<"unknown">>;
            Host when is_binary(Host) -> normalize_host(Host);
            Host when is_list(Host) -> normalize_host(list_to_binary(Host));
            _ -> <<"unknown">>
        end
    catch
        _:_ -> <<"unknown">>
    end.

-spec normalize_host(binary()) -> binary().
normalize_host(Host) ->
    list_to_binary(string:lowercase(binary_to_list(Host))).

-spec ensure_binary(iodata()) -> binary().
ensure_binary(Value) when is_binary(Value) ->
    Value;
ensure_binary(Value) ->
    iolist_to_binary(Value).

-spec ensure_list(iodata()) -> string().
ensure_list(Value) when is_binary(Value) ->
    binary_to_list(Value);
ensure_list(Value) when is_list(Value) ->
    Value;
ensure_list(Value) when is_atom(Value) ->
    atom_to_list(Value);
ensure_list(Value) when is_integer(Value) ->
    integer_to_list(Value);
ensure_list(_Value) ->
    "".

-spec ensure_httpc_profile(atom(), workload()) -> ok.
ensure_httpc_profile(Profile, Workload) ->
    _ =
        case inets:start(httpc, [{profile, Profile}]) of
            {ok, _Pid} -> ok;
            {error, {already_started, _Pid}} -> ok;
            {error, {already_started, _Pid, _}} -> ok;
            {error, _Reason} -> ok
        end,
    Options = workload_httpc_options(Workload),
    _ = httpc:set_options(Options, Profile),
    ok.

-spec workload_httpc_options(workload()) -> list().
workload_httpc_options(rpc) ->
    [
        {max_sessions, 1024},
        {max_keep_alive_length, 256}
    ];
workload_httpc_options(push) ->
    [
        {max_sessions, 2048},
        {max_keep_alive_length, 512}
    ].

-spec merged_workload_options(workload(), request_options()) -> request_options().
merged_workload_options(Workload, Opts) ->
    maps:merge(default_options(Workload), Opts).

-spec default_options(workload()) -> request_options().
default_options(rpc) ->
    #{
        connect_timeout => get_int_or_default(gateway_http_rpc_connect_timeout_ms, ?DEFAULT_RPC_CONNECT_TIMEOUT_MS),
        recv_timeout => get_int_or_default(gateway_http_rpc_recv_timeout_ms, ?DEFAULT_RPC_RECV_TIMEOUT_MS),
        max_concurrency =>
            get_int_or_default(gateway_http_rpc_max_concurrency, ?DEFAULT_RPC_MAX_CONCURRENCY),
        failure_threshold =>
            get_int_or_default(gateway_http_failure_threshold, ?DEFAULT_FAILURE_THRESHOLD),
        recovery_timeout_ms =>
            get_int_or_default(gateway_http_recovery_timeout_ms, ?DEFAULT_RECOVERY_TIMEOUT_MS),
        content_type => <<"application/json">>
    };
default_options(push) ->
    #{
        connect_timeout => get_int_or_default(gateway_http_push_connect_timeout_ms, ?DEFAULT_PUSH_CONNECT_TIMEOUT_MS),
        recv_timeout => get_int_or_default(gateway_http_push_recv_timeout_ms, ?DEFAULT_PUSH_RECV_TIMEOUT_MS),
        max_concurrency =>
            get_int_or_default(gateway_http_push_max_concurrency, ?DEFAULT_PUSH_MAX_CONCURRENCY),
        failure_threshold =>
            get_int_or_default(gateway_http_failure_threshold, ?DEFAULT_FAILURE_THRESHOLD),
        recovery_timeout_ms =>
            get_int_or_default(gateway_http_recovery_timeout_ms, ?DEFAULT_RECOVERY_TIMEOUT_MS),
        content_type => <<"application/octet-stream">>
    }.

-spec cleanup_interval_ms() -> pos_integer().
cleanup_interval_ms() ->
    get_int_or_default(gateway_http_cleanup_interval_ms, ?DEFAULT_CLEANUP_INTERVAL_MS).

-spec cleanup_max_age_ms() -> pos_integer().
cleanup_max_age_ms() ->
    get_int_or_default(gateway_http_cleanup_max_age_ms, ?DEFAULT_CLEANUP_MAX_AGE_MS).

-spec get_int_or_default(atom(), integer()) -> integer().
get_int_or_default(Key, Default) ->
    case fluxer_gateway_env:get_optional(Key) of
        Value when is_integer(Value), Value > 0 -> Value;
        _ -> Default
    end.

-spec profile_for(workload()) -> atom().
profile_for(rpc) ->
    gateway_http_rpc_profile;
profile_for(push) ->
    gateway_http_push_profile.

-spec first_stack_frame(list()) -> term().
first_stack_frame([Frame | _]) ->
    Frame;
first_stack_frame([]) ->
    undefined.
