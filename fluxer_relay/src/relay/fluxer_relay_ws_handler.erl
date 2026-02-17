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

-module(fluxer_relay_ws_handler).
-behaviour(cowboy_websocket).

-export([
    init/2,
    websocket_init/1,
    websocket_handle/2,
    websocket_info/2,
    terminate/3
]).

-export([
    encode_multiplexed_frame/3,
    decode_multiplexed_frame/1
]).

-define(ENCRYPTED_FRAME_PREFIX, 16#FE).
-define(MULTIPLEXED_FRAME_PREFIX, 16#FD).

-spec init(cowboy_req:req(), term()) -> {cowboy_websocket, cowboy_req:req(), map(), map()}.
init(Req, _State) ->
    Headers = cowboy_req:headers(Req),
    QsVals = cowboy_req:parse_qs(Req),
    OriginFromQs = proplists:get_value(<<"origin">>, QsVals, undefined),
    OriginFromHeader = maps:get(<<"x-relay-origin">>, Headers, undefined),
    OriginInstance = case OriginFromQs of
        undefined -> OriginFromHeader;
        Val -> Val
    end,
    TokenFromQs = proplists:get_value(<<"relay_token">>, QsVals, undefined),
    TokenFromHeader = maps:get(<<"x-relay-token">>, Headers, undefined),
    RelayToken = case TokenFromQs of
        undefined -> TokenFromHeader;
        Val2 -> Val2
    end,
    InitState = #{
        origin_instance => OriginInstance,
        relay_token => RelayToken,
        headers => Headers,
        instances => #{},
        conn_to_instance => #{},
        sequences => #{}
    },
    IdleTimeout = fluxer_relay_env:get(idle_timeout_ms),
    {cowboy_websocket, Req, InitState, #{idle_timeout => IdleTimeout}}.

-spec websocket_init(map()) -> {[{text, binary()}], map()}.
websocket_init(State) ->
    case validate_connection(State) of
        ok ->
            lager:info("Relay WebSocket connection initialised"),
            {[], State};
        {error, Reason} ->
            ErrorMsg = json:encode(#{
                <<"op">> => 9,
                <<"d">> => #{<<"message">> => Reason}
            }),
            {[{close, 4000, Reason}], State#{error => ErrorMsg}}
    end.

-spec validate_connection(map()) -> ok | {error, binary()}.
validate_connection(State) ->
    OriginInstance = maps:get(origin_instance, State),
    RelayToken = maps:get(relay_token, State),
    case {OriginInstance, RelayToken} of
        {undefined, _} ->
            {error, <<"Missing origin parameter">>};
        {_, undefined} ->
            {error, <<"Missing relay_token parameter">>};
        {_, _} ->
            ok
    end.

-spec websocket_handle({text | binary, binary()}, map()) -> {[{text | binary, binary()}], map()}.
websocket_handle({text, _Data}, State) ->
    lager:warning("Received unsupported text frame in multiplexed relay"),
    {[], State};
websocket_handle({binary, Data}, State) ->
    case is_multiplexed_frame(Data) of
        true ->
            case decode_multiplexed_frame(Data) of
                {ok, InstanceId, Seq, EncryptedPayload} ->
                    handle_multiplexed_frame(InstanceId, Seq, EncryptedPayload, State);
                {error, Reason} ->
                    lager:warning("Failed to decode multiplexed frame: ~p", [Reason]),
                    {[], State}
            end;
        false ->
            lager:warning("Received non-multiplexed binary frame - ignoring"),
            {[], State}
    end;
websocket_handle(_Frame, State) ->
    {[], State}.

-spec is_multiplexed_frame(binary()) -> boolean().
is_multiplexed_frame(<<?MULTIPLEXED_FRAME_PREFIX, _Rest/binary>>) ->
    true;
is_multiplexed_frame(_) ->
    false.

-spec encode_multiplexed_frame(binary(), non_neg_integer(), binary()) -> binary().
encode_multiplexed_frame(InstanceId, Seq, EncryptedPayload) when is_binary(InstanceId), is_integer(Seq), is_binary(EncryptedPayload) ->
    InstanceIdLen = byte_size(InstanceId),
    PayloadLen = byte_size(EncryptedPayload),
    <<?MULTIPLEXED_FRAME_PREFIX:8,
      InstanceIdLen:16/big-unsigned,
      InstanceId/binary,
      Seq:32/big-unsigned,
      PayloadLen:32/big-unsigned,
      EncryptedPayload/binary>>.

-spec decode_multiplexed_frame(binary()) -> {ok, binary(), non_neg_integer(), binary()} | {error, term()}.
decode_multiplexed_frame(<<?MULTIPLEXED_FRAME_PREFIX:8, Rest/binary>>) ->
    decode_multiplexed_frame_body(Rest);
decode_multiplexed_frame(_) ->
    {error, invalid_prefix}.

-spec decode_multiplexed_frame_body(binary()) -> {ok, binary(), non_neg_integer(), binary()} | {error, term()}.
decode_multiplexed_frame_body(<<InstanceIdLen:16/big-unsigned, Rest/binary>>) when byte_size(Rest) >= InstanceIdLen ->
    case Rest of
        <<InstanceId:InstanceIdLen/binary, Seq:32/big-unsigned, PayloadLen:32/big-unsigned, Payload/binary>> ->
            case byte_size(Payload) >= PayloadLen of
                true ->
                    <<EncryptedPayload:PayloadLen/binary, _Trailing/binary>> = Payload,
                    {ok, InstanceId, Seq, EncryptedPayload};
                false ->
                    {error, payload_too_short}
            end;
        _ ->
            {error, incomplete_header}
    end;
decode_multiplexed_frame_body(_) ->
    {error, incomplete_instance_id}.


-spec handle_multiplexed_frame(binary(), non_neg_integer(), binary(), map()) -> {[{text | binary, binary()}], map()}.
handle_multiplexed_frame(InstanceId, Seq, EncryptedPayload, State) ->
    Instances = maps:get(instances, State, #{}),
    case maps:get(InstanceId, Instances, undefined) of
        undefined ->
            case connect_to_instance(InstanceId, State) of
                {ok, NewState} ->
                    forward_to_instance(InstanceId, EncryptedPayload, Seq, NewState);
                {error, Reason} ->
                    lager:error("Failed to connect to instance ~s: ~p", [InstanceId, Reason]),
                    ErrorPayload = json:encode(#{
                        <<"error">> => <<"connection_failed">>,
                        <<"instance">> => InstanceId,
                        <<"reason">> => list_to_binary(io_lib:format("~p", [Reason]))
                    }),
                    ErrorFrame = encode_multiplexed_frame(InstanceId, 0, ErrorPayload),
                    {[{binary, ErrorFrame}], State}
            end;
        _ConnInfo ->
            forward_to_instance(InstanceId, EncryptedPayload, Seq, State)
    end.

-spec connect_to_instance(binary(), map()) -> {ok, map()} | {error, term()}.
connect_to_instance(InstanceId, State) ->
    Config = fluxer_relay_env:get_map(),
    Timeout = maps:get(connection_timeout_ms, Config, 30000),

    OriginInstance = maps:get(origin_instance, State),
    GatewayResult = case InstanceId of
        OriginInstance ->
            UpstreamHost = maps:get(upstream_gateway_host, Config, "localhost:8081"),
            Tls = maps:get(upstream_use_tls, Config, false),
            {H, P} = parse_host_port(UpstreamHost, Tls),
            {ok, #{host => H, port => P, use_tls => Tls}};
        _ ->
            fluxer_relay_instance_discovery:discover_gateway(InstanceId)
    end,

    case GatewayResult of
        {ok, #{host := Host, port := Port, use_tls := UseTls}} ->
            connect_to_gateway(Host, Port, UseTls, InstanceId, Timeout, State);
        {error, DiscoveryError} ->
            lager:error("Instance discovery failed for ~s: ~p", [InstanceId, DiscoveryError]),
            {error, {discovery_failed, DiscoveryError}}
    end.

-spec connect_to_gateway(string(), inet:port_number(), boolean(), binary(), non_neg_integer(), map()) ->
    {ok, map()} | {error, term()}.
connect_to_gateway(Host, Port, UseTls, InstanceId, Timeout, State) ->
    OriginInstance = maps:get(origin_instance, State),
    Transport = case UseTls of true -> tls; false -> tcp end,
    GunOpts = #{
        transport => Transport,
        connect_timeout => Timeout,
        ws_opts => #{compress => true}
    },

    case gun:open(Host, Port, GunOpts) of
        {ok, ConnPid} ->
            case gun:await_up(ConnPid, Timeout) of
                {ok, _Protocol} ->
                    RelayToken = maps:get(relay_token, State, <<>>),
                    WsHeaders = [
                        {<<"x-relay-origin">>, OriginInstance},
                        {<<"x-relay-target">>, InstanceId},
                        {<<"x-relay-proxied">>, <<"true">>},
                        {<<"x-relay-token">>, RelayToken}
                    ],
                    StreamRef = gun:ws_upgrade(ConnPid, "/", WsHeaders),
                    case gun:await(ConnPid, StreamRef, Timeout) of
                        {upgrade, [<<"websocket">>], _Headers} ->
                            lager:info("Connected to instance gateway ~s", [InstanceId]),

                            Instances = maps:get(instances, State, #{}),
                            ConnToInstance = maps:get(conn_to_instance, State, #{}),

                            NewInstances = maps:put(InstanceId, #{
                                conn => ConnPid,
                                stream => StreamRef
                            }, Instances),
                            NewConnToInstance = maps:put(ConnPid, InstanceId, ConnToInstance),

                            NewState = State#{
                                instances => NewInstances,
                                conn_to_instance => NewConnToInstance
                            },
                            {ok, NewState};
                        {error, Reason} ->
                            gun:close(ConnPid),
                            lager:error("WebSocket upgrade failed for ~s: ~p", [InstanceId, Reason]),
                            {error, ws_upgrade_failed}
                    end;
                {error, Reason} ->
                    gun:close(ConnPid),
                    lager:error("Failed to connect to instance ~s: ~p", [InstanceId, Reason]),
                    {error, connection_failed}
            end;
        {error, Reason} ->
            lager:error("Failed to open connection to instance ~s: ~p", [InstanceId, Reason]),
            {error, Reason}
    end.

-spec forward_to_instance(binary(), binary(), non_neg_integer(), map()) -> {[{text | binary, binary()}], map()}.
forward_to_instance(InstanceId, EncryptedPayload, Seq, State) ->
    Instances = maps:get(instances, State, #{}),
    case maps:get(InstanceId, Instances, undefined) of
        undefined ->
            lager:warning("No connection found for instance ~s", [InstanceId]),
            {[], State};
        #{conn := ConnPid, stream := StreamRef} ->
            Sequences = maps:get(sequences, State, #{}),
            NewSequences = maps:put(InstanceId, Seq, Sequences),

            gun:ws_send(ConnPid, StreamRef, {binary, EncryptedPayload}),
            {[], State#{sequences => NewSequences}}
    end.

-spec find_instance_by_conn(pid(), map()) -> binary() | undefined.
find_instance_by_conn(ConnPid, State) ->
    ConnToInstance = maps:get(conn_to_instance, State, #{}),
    maps:get(ConnPid, ConnToInstance, undefined).

-spec remove_instance_connection(binary(), map()) -> map().
remove_instance_connection(InstanceId, State) ->
    Instances = maps:get(instances, State, #{}),
    ConnToInstance = maps:get(conn_to_instance, State, #{}),
    Sequences = maps:get(sequences, State, #{}),

    ConnPid = case maps:get(InstanceId, Instances, undefined) of
        undefined -> undefined;
        #{conn := Pid} -> Pid
    end,

    NewInstances = maps:remove(InstanceId, Instances),
    NewConnToInstance = case ConnPid of
        undefined -> ConnToInstance;
        _ -> maps:remove(ConnPid, ConnToInstance)
    end,
    NewSequences = maps:remove(InstanceId, Sequences),

    State#{
        instances => NewInstances,
        conn_to_instance => NewConnToInstance,
        sequences => NewSequences
    }.

-spec websocket_info(term(), map()) -> {[{text | binary, binary()}], map()} | {[{close, integer(), binary()}], map()}.
websocket_info({gun_ws, ConnPid, _StreamRef, {text, Data}}, State) ->
    case find_instance_by_conn(ConnPid, State) of
        undefined ->
            lager:warning("Received message from unknown connection pid"),
            {[], State};
        InstanceId ->
            {Seq, NewState} = get_and_increment_downstream_seq(InstanceId, State),
            Frame = encode_multiplexed_frame(InstanceId, Seq, Data),
            {[{binary, Frame}], NewState}
    end;
websocket_info({gun_ws, ConnPid, _StreamRef, {binary, Data}}, State) ->
    case find_instance_by_conn(ConnPid, State) of
        undefined ->
            lager:warning("Received message from unknown connection pid"),
            {[], State};
        InstanceId ->
            {Seq, NewState} = get_and_increment_downstream_seq(InstanceId, State),
            Frame = encode_multiplexed_frame(InstanceId, Seq, Data),
            {[{binary, Frame}], NewState}
    end;
websocket_info({gun_ws, ConnPid, _StreamRef, close}, State) ->
    case find_instance_by_conn(ConnPid, State) of
        undefined ->
            lager:warning("Received close from unknown connection pid"),
            {[], State};
        InstanceId ->
            lager:info("Instance ~s WebSocket closed", [InstanceId]),
            NewState = remove_instance_connection(InstanceId, State),
            ClosePayload = json:encode(#{
                <<"event">> => <<"instance_disconnected">>,
                <<"instance">> => InstanceId,
                <<"code">> => 1000,
                <<"reason">> => <<"closed">>
            }),
            Frame = encode_multiplexed_frame(InstanceId, 0, ClosePayload),
            {[{binary, Frame}], NewState}
    end;
websocket_info({gun_ws, ConnPid, _StreamRef, {close, Code, Reason}}, State) ->
    case find_instance_by_conn(ConnPid, State) of
        undefined ->
            lager:warning("Received close from unknown connection pid: code=~p reason=~s", [Code, Reason]),
            {[], State};
        InstanceId ->
            lager:info("Instance ~s WebSocket closed with code ~p: ~s", [InstanceId, Code, Reason]),
            NewState = remove_instance_connection(InstanceId, State),
            ClosePayload = json:encode(#{
                <<"event">> => <<"instance_disconnected">>,
                <<"instance">> => InstanceId,
                <<"code">> => Code,
                <<"reason">> => Reason
            }),
            Frame = encode_multiplexed_frame(InstanceId, 0, ClosePayload),
            {[{binary, Frame}], NewState}
    end;
websocket_info({gun_down, ConnPid, _Protocol, Reason, _KilledStreams}, State) ->
    case find_instance_by_conn(ConnPid, State) of
        undefined ->
            lager:warning("Connection down from unknown pid: ~p", [Reason]),
            {[], State};
        InstanceId ->
            lager:warning("Instance ~s connection down: ~p", [InstanceId, Reason]),
            NewState = remove_instance_connection(InstanceId, State),
            ClosePayload = json:encode(#{
                <<"event">> => <<"instance_disconnected">>,
                <<"instance">> => InstanceId,
                <<"code">> => 1001,
                <<"reason">> => <<"connection_lost">>
            }),
            Frame = encode_multiplexed_frame(InstanceId, 0, ClosePayload),
            {[{binary, Frame}], NewState}
    end;
websocket_info({gun_error, ConnPid, _StreamRef, Reason}, State) ->
    case find_instance_by_conn(ConnPid, State) of
        undefined ->
            lager:warning("Error from unknown connection pid: ~p", [Reason]),
            {[], State};
        InstanceId ->
            lager:error("Instance ~s WebSocket error: ~p", [InstanceId, Reason]),
            NewState = remove_instance_connection(InstanceId, State),
            ErrorPayload = json:encode(#{
                <<"event">> => <<"instance_error">>,
                <<"instance">> => InstanceId,
                <<"code">> => 1011,
                <<"reason">> => list_to_binary(io_lib:format("~p", [Reason]))
            }),
            Frame = encode_multiplexed_frame(InstanceId, 0, ErrorPayload),
            {[{binary, Frame}], NewState}
    end;
websocket_info(_Info, State) ->
    {[], State}.

-spec get_and_increment_downstream_seq(binary(), map()) -> {non_neg_integer(), map()}.
get_and_increment_downstream_seq(InstanceId, State) ->
    Sequences = maps:get(sequences, State, #{}),
    CurrentSeq = maps:get(InstanceId, Sequences, 0),
    NextSeq = CurrentSeq + 1,
    NewSequences = maps:put(InstanceId, NextSeq, Sequences),
    {NextSeq, State#{sequences => NewSequences}}.

-spec terminate(term(), term(), map()) -> ok.
terminate(_Reason, _Req, State) ->
    Instances = maps:get(instances, State, #{}),
    maps:foreach(
        fun(_InstanceId, #{conn := InstConnPid}) ->
            gun:close(InstConnPid)
        end,
        Instances
    ),
    ok.

-spec parse_host_port(string(), boolean()) -> {string(), inet:port_number()}.
parse_host_port(HostPort, UseTls) ->
    DefaultPort = case UseTls of true -> 443; false -> 80 end,
    case string:split(HostPort, ":") of
        [Host, PortStr] ->
            Port = list_to_integer(PortStr),
            {Host, Port};
        [Host] ->
            {Host, DefaultPort}
    end.
