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

-module(gateway_rpc_tcp_connection).

-export([serve/1]).

-define(DEFAULT_MAX_INFLIGHT, 1024).
-define(DEFAULT_MAX_INPUT_BUFFER_BYTES, 2097152).
-define(DEFAULT_DISPATCH_RESERVE_DIVISOR, 8).
-define(MAX_FRAME_BYTES, 1048576).
-define(PROTOCOL_VERSION, <<"fluxer.rpc.tcp.v1">>).

-type state() :: #{
    socket := inet:socket(),
    buffer := binary(),
    authenticated := boolean(),
    inflight := non_neg_integer(),
    max_inflight := pos_integer(),
    max_input_buffer_bytes := pos_integer()
}.

-type rpc_result() :: {ok, term()} | {error, binary()}.

-spec serve(inet:socket()) -> ok.
serve(Socket) ->
    ok = inet:setopts(Socket, [{active, once}, {nodelay, true}, {keepalive, true}]),
    State = #{
        socket => Socket,
        buffer => <<>>,
        authenticated => false,
        inflight => 0,
        max_inflight => max_inflight(),
        max_input_buffer_bytes => max_input_buffer_bytes()
    },
    loop(State).

-spec loop(state()) -> ok.
loop(#{socket := Socket} = State) ->
    receive
        {tcp, Socket, Data} ->
            case handle_tcp_data(Data, State) of
                {ok, NewState} ->
                    ok = inet:setopts(Socket, [{active, once}]),
                    loop(NewState);
                {stop, Reason, _NewState} ->
                    logger:debug("Gateway TCP RPC connection closed: ~p", [Reason]),
                    close_socket(Socket),
                    ok
            end;
        {tcp_closed, Socket} ->
            ok;
        {tcp_error, Socket, Reason} ->
            logger:warning("Gateway TCP RPC socket error: ~p", [Reason]),
            close_socket(Socket),
            ok;
        {rpc_response, RequestId, Result} ->
            NewState = handle_rpc_response(RequestId, Result, State),
            loop(NewState);
        _Other ->
            loop(State)
    end.

-spec handle_tcp_data(binary(), state()) -> {ok, state()} | {stop, term(), state()}.
handle_tcp_data(Data, #{buffer := Buffer, max_input_buffer_bytes := MaxInputBufferBytes} = State) ->
    case byte_size(Buffer) + byte_size(Data) =< MaxInputBufferBytes of
        false ->
            _ = send_error_frame(State, protocol_error_binary(input_buffer_limit_exceeded)),
            {stop, input_buffer_limit_exceeded, State};
        true ->
            Combined = <<Buffer/binary, Data/binary>>,
            decode_tcp_frames(Combined, State)
    end.

-spec decode_tcp_frames(binary(), state()) -> {ok, state()} | {stop, term(), state()}.
decode_tcp_frames(Combined, State) ->
    case decode_frames(Combined, []) of
        {ok, Frames, Rest} ->
            process_frames(Frames, State#{buffer => Rest});
        {error, Reason} ->
            _ = send_error_frame(State, protocol_error_binary(Reason)),
            {stop, Reason, State}
    end.

-spec process_frames([map()], state()) -> {ok, state()} | {stop, term(), state()}.
process_frames([], State) ->
    {ok, State};
process_frames([Frame | Rest], State) ->
    case process_frame(Frame, State) of
        {ok, NewState} ->
            process_frames(Rest, NewState);
        {stop, Reason, NewState} ->
            {stop, Reason, NewState}
    end.

-spec process_frame(map(), state()) -> {ok, state()} | {stop, term(), state()}.
process_frame(#{<<"type">> := <<"hello">>} = Frame, #{authenticated := false} = State) ->
    handle_hello_frame(Frame, State);
process_frame(#{<<"type">> := <<"hello">>}, State) ->
    _ = send_error_frame(State, <<"duplicate_hello">>),
    {stop, duplicate_hello, State};
process_frame(#{<<"type">> := <<"request">>} = Frame, #{authenticated := true} = State) ->
    handle_request_frame(Frame, State);
process_frame(#{<<"type">> := <<"request">>}, State) ->
    _ = send_error_frame(State, <<"unauthorized">>),
    {stop, unauthorized, State};
process_frame(#{<<"type">> := <<"ping">>}, State) ->
    _ = send_frame(State, #{<<"type">> => <<"pong">>}),
    {ok, State};
process_frame(#{<<"type">> := <<"pong">>}, State) ->
    {ok, State};
process_frame(#{<<"type">> := <<"close">>}, State) ->
    {stop, client_close, State};
process_frame(_Frame, State) ->
    _ = send_error_frame(State, <<"unknown_frame_type">>),
    {stop, unknown_frame_type, State}.

-spec handle_hello_frame(map(), state()) -> {ok, state()} | {stop, term(), state()}.
handle_hello_frame(Frame, State) ->
    case {maps:get(<<"protocol">>, Frame, undefined), maps:get(<<"authorization">>, Frame, undefined)} of
        {?PROTOCOL_VERSION, AuthHeader} when is_binary(AuthHeader) ->
            authorize_hello(AuthHeader, State);
        _ ->
            _ = send_error_frame(State, <<"invalid_hello">>),
            {stop, invalid_hello, State}
    end.

-spec authorize_hello(binary(), state()) -> {ok, state()} | {stop, term(), state()}.
authorize_hello(AuthHeader, State) ->
    case fluxer_gateway_env:get(rpc_secret_key) of
        Secret when is_binary(Secret) ->
            Expected = <<"Bearer ", Secret/binary>>,
            case secure_compare(AuthHeader, Expected) of
                true ->
                    HelloAck = #{
                        <<"type">> => <<"hello_ack">>,
                        <<"protocol">> => ?PROTOCOL_VERSION,
                        <<"max_in_flight">> => maps:get(max_inflight, State),
                        <<"ping_interval_ms">> => 15000
                    },
                    _ = send_frame(State, HelloAck),
                    {ok, State#{authenticated => true}};
                false ->
                    _ = send_error_frame(State, <<"unauthorized">>),
                    {stop, unauthorized, State}
            end;
        _ ->
            _ = send_error_frame(State, <<"rpc_secret_not_configured">>),
            {stop, rpc_secret_not_configured, State}
    end.

-spec handle_request_frame(map(), state()) -> {ok, state()}.
handle_request_frame(Frame, State) ->
    RequestId = request_id_from_frame(Frame),
    Method = maps:get(<<"method">>, Frame, undefined),
    case should_reject_request(Method, State) of
        true ->
            _ =
                send_response_frame(
                    State,
                    RequestId,
                    false,
                    undefined,
                    <<"overloaded">>
                ),
            {ok, State};
        false ->
            case {Method, maps:get(<<"params">>, Frame, undefined)} of
                {MethodName, Params} when is_binary(RequestId), is_binary(MethodName), is_map(Params) ->
                    Parent = self(),
                    _ = spawn(fun() ->
                        Parent ! {rpc_response, RequestId, execute_method(MethodName, Params)}
                    end),
                    {ok, increment_inflight(State)};
                _ ->
                    _ =
                        send_response_frame(
                            State,
                            RequestId,
                            false,
                            undefined,
                            <<"invalid_request">>
                        ),
                    {ok, State}
            end
    end.

-spec should_reject_request(term(), state()) -> boolean().
should_reject_request(Method, #{inflight := Inflight, max_inflight := MaxInflight}) ->
    case is_dispatch_method(Method) of
        true ->
            Inflight >= MaxInflight;
        false ->
            Inflight >= non_dispatch_inflight_limit(MaxInflight)
    end.

-spec non_dispatch_inflight_limit(pos_integer()) -> pos_integer().
non_dispatch_inflight_limit(MaxInflight) ->
    Reserve = dispatch_reserve_slots(MaxInflight),
    max(1, MaxInflight - Reserve).

-spec dispatch_reserve_slots(pos_integer()) -> pos_integer().
dispatch_reserve_slots(MaxInflight) ->
    max(1, MaxInflight div ?DEFAULT_DISPATCH_RESERVE_DIVISOR).

-spec is_dispatch_method(term()) -> boolean().
is_dispatch_method(Method) when is_binary(Method) ->
    Suffix = <<".dispatch">>,
    MethodSize = byte_size(Method),
    SuffixSize = byte_size(Suffix),
    MethodSize >= SuffixSize andalso
        binary:part(Method, MethodSize - SuffixSize, SuffixSize) =:= Suffix;
is_dispatch_method(_) ->
    false.

-spec execute_method(binary(), map()) -> rpc_result().
execute_method(Method, Params) ->
    try
        Result = gateway_rpc_router:execute(Method, Params),
        {ok, Result}
    catch
        throw:{error, Message} ->
            {error, error_binary(Message)};
        exit:timeout ->
            {error, <<"timeout">>};
        exit:{timeout, _} ->
            {error, <<"timeout">>};
        Class:Reason ->
            logger:error(
                "Gateway TCP RPC method execution failed. method=~ts class=~p reason=~p",
                [Method, Class, Reason]
            ),
            {error, <<"internal_error">>}
    end.

-spec handle_rpc_response(binary(), rpc_result(), state()) -> state().
handle_rpc_response(RequestId, {ok, Result}, State) ->
    _ = send_response_frame(State, RequestId, true, Result, undefined),
    decrement_inflight(State);
handle_rpc_response(RequestId, {error, Error}, State) ->
    _ = send_response_frame(State, RequestId, false, undefined, Error),
    decrement_inflight(State).

-spec send_response_frame(state(), binary(), boolean(), term(), binary() | undefined) -> ok | {error, term()}.
send_response_frame(State, RequestId, true, Result, _Error) ->
    send_frame(State, #{
        <<"type">> => <<"response">>,
        <<"id">> => RequestId,
        <<"ok">> => true,
        <<"result">> => Result
    });
send_response_frame(State, RequestId, false, _Result, Error) ->
    send_frame(State, #{
        <<"type">> => <<"response">>,
        <<"id">> => RequestId,
        <<"ok">> => false,
        <<"error">> => Error
    }).

-spec send_error_frame(state(), binary()) -> ok | {error, term()}.
send_error_frame(State, Error) ->
    send_frame(State, #{
        <<"type">> => <<"error">>,
        <<"error">> => Error
    }).

-spec send_frame(state(), map()) -> ok | {error, term()}.
send_frame(#{socket := Socket}, Frame) ->
    gen_tcp:send(Socket, encode_frame(Frame)).

-spec encode_frame(map()) -> binary().
encode_frame(Frame) ->
    Payload = iolist_to_binary(json:encode(Frame)),
    Length = integer_to_binary(byte_size(Payload)),
    <<Length/binary, "\n", Payload/binary>>.

-spec decode_frames(binary(), [map()]) -> {ok, [map()], binary()} | {error, term()}.
decode_frames(Buffer, Acc) ->
    case binary:match(Buffer, <<"\n">>) of
        nomatch ->
            {ok, lists:reverse(Acc), Buffer};
        {Pos, 1} ->
            LengthBin = binary:part(Buffer, 0, Pos),
            case parse_length(LengthBin) of
                {ok, Length} ->
                    HeaderSize = Pos + 1,
                    RequiredSize = HeaderSize + Length,
                    case byte_size(Buffer) >= RequiredSize of
                        false ->
                            {ok, lists:reverse(Acc), Buffer};
                        true ->
                            Payload = binary:part(Buffer, HeaderSize, Length),
                            RestSize = byte_size(Buffer) - RequiredSize,
                            Rest = binary:part(Buffer, RequiredSize, RestSize),
                            case decode_payload(Payload) of
                                {ok, Frame} ->
                                    decode_frames(Rest, [Frame | Acc]);
                                {error, Reason} ->
                                    {error, Reason}
                            end
                    end;
                {error, Reason} ->
                    {error, Reason}
            end
    end.

-spec decode_payload(binary()) -> {ok, map()} | {error, term()}.
decode_payload(Payload) ->
    case catch json:decode(Payload) of
        {'EXIT', _} ->
            {error, invalid_json};
        Frame when is_map(Frame) ->
            {ok, Frame};
        _ ->
            {error, invalid_json}
    end.

-spec parse_length(binary()) -> {ok, non_neg_integer()} | {error, term()}.
parse_length(<<>>) ->
    {error, invalid_frame_length};
parse_length(LengthBin) ->
    try
        Length = binary_to_integer(LengthBin),
        case Length >= 0 andalso Length =< ?MAX_FRAME_BYTES of
            true -> {ok, Length};
            false -> {error, invalid_frame_length}
        end
    catch
        _:_ ->
            {error, invalid_frame_length}
    end.

-spec secure_compare(binary(), binary()) -> boolean().
secure_compare(Left, Right) when is_binary(Left), is_binary(Right) ->
    case byte_size(Left) =:= byte_size(Right) of
        true ->
            crypto:hash_equals(Left, Right);
        false ->
            false
    end.

-spec request_id_from_frame(map()) -> binary().
request_id_from_frame(Frame) ->
    case maps:get(<<"id">>, Frame, <<>>) of
        Id when is_binary(Id) ->
            Id;
        Id when is_integer(Id) ->
            integer_to_binary(Id);
        _ ->
            <<>>
    end.

-spec increment_inflight(state()) -> state().
increment_inflight(#{inflight := Inflight} = State) ->
    State#{inflight => Inflight + 1}.

-spec decrement_inflight(state()) -> state().
decrement_inflight(#{inflight := Inflight} = State) when Inflight > 0 ->
    State#{inflight => Inflight - 1};
decrement_inflight(State) ->
    State.

-spec error_binary(term()) -> binary().
error_binary(Value) when is_binary(Value) ->
    Value;
error_binary(Value) when is_list(Value) ->
    unicode:characters_to_binary(Value);
error_binary(Value) when is_atom(Value) ->
    atom_to_binary(Value, utf8);
error_binary(Value) ->
    unicode:characters_to_binary(io_lib:format("~p", [Value])).

-spec protocol_error_binary(term()) -> binary().
protocol_error_binary(invalid_json) ->
    <<"invalid_json">>;
protocol_error_binary(invalid_frame_length) ->
    <<"invalid_frame_length">>;
protocol_error_binary(input_buffer_limit_exceeded) ->
    <<"input_buffer_limit_exceeded">>.

-spec close_socket(inet:socket()) -> ok.
close_socket(Socket) ->
    catch gen_tcp:close(Socket),
    ok.

-spec max_inflight() -> pos_integer().
max_inflight() ->
    case fluxer_gateway_env:get(gateway_http_rpc_max_concurrency) of
        Value when is_integer(Value), Value > 0 ->
            Value;
        _ ->
            ?DEFAULT_MAX_INFLIGHT
    end.

-spec max_input_buffer_bytes() -> pos_integer().
max_input_buffer_bytes() ->
    case fluxer_gateway_env:get(gateway_rpc_tcp_max_input_buffer_bytes) of
        Value when is_integer(Value), Value > 0 ->
            Value;
        _ ->
            ?DEFAULT_MAX_INPUT_BUFFER_BYTES
    end.

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").

decode_single_frame_test() ->
    Frame = #{<<"type">> => <<"ping">>},
    Encoded = encode_frame(Frame),
    ?assertEqual({ok, [Frame], <<>>}, decode_frames(Encoded, [])).

decode_multiple_frames_test() ->
    FrameA = #{<<"type">> => <<"ping">>},
    FrameB = #{<<"type">> => <<"pong">>},
    Encoded = <<(encode_frame(FrameA))/binary, (encode_frame(FrameB))/binary>>,
    ?assertEqual({ok, [FrameA, FrameB], <<>>}, decode_frames(Encoded, [])).

decode_partial_frame_test() ->
    Frame = #{<<"type">> => <<"ping">>},
    Encoded = encode_frame(Frame),
    Prefix = binary:part(Encoded, 0, 3),
    ?assertEqual({ok, [], Prefix}, decode_frames(Prefix, [])).

invalid_length_test() ->
    ?assertEqual({error, invalid_frame_length}, decode_frames(<<"x\n{}">>, [])).

secure_compare_test() ->
    ?assert(secure_compare(<<"abc">>, <<"abc">>)),
    ?assertNot(secure_compare(<<"abc">>, <<"abd">>)),
    ?assertNot(secure_compare(<<"abc">>, <<"abcd">>)).

-endif.
