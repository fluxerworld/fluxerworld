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

-module(fluxer_gateway_crypto).

-export([
    init/0,
    decrypt/2,
    encrypt/2,
    derive_shared_secret/2,
    generate_keypair/0,
    get_public_key/0,
    new_crypto_state/1,
    is_encrypted_frame/1,
    unwrap_encrypted_frame/1,
    wrap_encrypted_frame/1
]).

-define(KEYPAIR_KEY, {?MODULE, instance_keypair}).
-define(ENCRYPTED_FRAME_PREFIX, 16#FE).
-define(NONCE_SIZE, 12).
-define(TAG_SIZE, 16).
-define(KEY_SIZE, 32).

-type keypair() :: #{public := binary(), private := binary()}.
-type crypto_state() :: #{
    shared_secret := binary(),
    send_counter := non_neg_integer(),
    recv_counter := non_neg_integer()
}.

-export_type([keypair/0, crypto_state/0]).

-spec init() -> ok.
init() ->
    case persistent_term:get(?KEYPAIR_KEY, undefined) of
        undefined ->
            Keypair = generate_keypair(),
            persistent_term:put(?KEYPAIR_KEY, Keypair),
            ok;
        _ ->
            ok
    end.

-spec generate_keypair() -> keypair().
generate_keypair() ->
    {Public, Private} = crypto:generate_key(ecdh, x25519),
    #{public => Public, private => Private}.

-spec get_public_key() -> binary() | undefined.
get_public_key() ->
    case persistent_term:get(?KEYPAIR_KEY, undefined) of
        undefined -> undefined;
        #{public := Public} -> Public
    end.

-spec derive_shared_secret(binary(), keypair()) -> {ok, binary()} | {error, term()}.
derive_shared_secret(PeerPublic, #{private := Private}) when
    byte_size(PeerPublic) =:= ?KEY_SIZE
->
    try
        SharedSecret = crypto:compute_key(ecdh, PeerPublic, Private, x25519),
        {ok, SharedSecret}
    catch
        error:Reason ->
            {error, {key_exchange_failed, Reason}}
    end;
derive_shared_secret(PeerPublic, _Keypair) ->
    {error, {invalid_peer_key_size, byte_size(PeerPublic)}}.

-spec new_crypto_state(binary()) -> crypto_state().
new_crypto_state(SharedSecret) when byte_size(SharedSecret) =:= ?KEY_SIZE ->
    #{
        shared_secret => SharedSecret,
        send_counter => 0,
        recv_counter => 0
    }.

-spec encrypt(binary(), crypto_state()) ->
    {ok, binary(), crypto_state()} | {error, term()}.
encrypt(Plaintext, State = #{shared_secret := Key, send_counter := Counter}) ->
    try
        Nonce = counter_to_nonce(Counter),
        AAD = <<>>,
        {Ciphertext, Tag} = crypto:crypto_one_time_aead(
            aes_256_gcm,
            Key,
            Nonce,
            Plaintext,
            AAD,
            ?TAG_SIZE,
            true
        ),
        Encrypted = <<Nonce/binary, Tag/binary, Ciphertext/binary>>,
        NewState = State#{send_counter => Counter + 1},
        {ok, Encrypted, NewState}
    catch
        error:Reason ->
            {error, {encrypt_failed, Reason}}
    end.

-spec decrypt(binary(), crypto_state()) ->
    {ok, binary(), crypto_state()} | {error, term()}.
decrypt(Data, State = #{shared_secret := Key, recv_counter := Counter}) ->
    MinSize = ?NONCE_SIZE + ?TAG_SIZE,
    case byte_size(Data) > MinSize of
        false ->
            {error, {invalid_encrypted_data, too_short}};
        true ->
            <<Nonce:?NONCE_SIZE/binary, Tag:?TAG_SIZE/binary, Ciphertext/binary>> = Data,
            ExpectedNonce = counter_to_nonce(Counter),
            case validate_nonce(Nonce, ExpectedNonce, Counter) of
                {ok, ActualCounter} ->
                    do_decrypt(Ciphertext, Key, Nonce, Tag, State, ActualCounter);
                {error, Reason} ->
                    {error, Reason}
            end
    end.

-spec do_decrypt(binary(), binary(), binary(), binary(), crypto_state(), non_neg_integer()) ->
    {ok, binary(), crypto_state()} | {error, term()}.
do_decrypt(Ciphertext, Key, Nonce, Tag, State, ActualCounter) ->
    AAD = <<>>,
    try
        case crypto:crypto_one_time_aead(
            aes_256_gcm,
            Key,
            Nonce,
            Ciphertext,
            AAD,
            Tag,
            false
        ) of
            Plaintext when is_binary(Plaintext) ->
                NewState = State#{recv_counter => ActualCounter + 1},
                {ok, Plaintext, NewState};
            error ->
                {error, authentication_failed}
        end
    catch
        error:Reason ->
            {error, {decrypt_failed, Reason}}
    end.

-spec counter_to_nonce(non_neg_integer()) -> binary().
counter_to_nonce(Counter) ->
    <<0:32, Counter:64/big-unsigned-integer>>.

-spec validate_nonce(binary(), binary(), non_neg_integer()) ->
    {ok, non_neg_integer()} | {error, term()}.
validate_nonce(Nonce, ExpectedNonce, Counter) when Nonce =:= ExpectedNonce ->
    {ok, Counter};
validate_nonce(Nonce, _ExpectedNonce, Counter) ->
    <<_Prefix:4/binary, ReceivedCounter:64/big-unsigned-integer>> = Nonce,
    MaxWindow = 32,
    case ReceivedCounter > Counter andalso ReceivedCounter =< Counter + MaxWindow of
        true ->
            {ok, ReceivedCounter};
        false ->
            {error, {nonce_mismatch, Counter, ReceivedCounter}}
    end.

-spec is_encrypted_frame(binary()) -> boolean().
is_encrypted_frame(<<?ENCRYPTED_FRAME_PREFIX, _Rest/binary>>) ->
    true;
is_encrypted_frame(_) ->
    false.

-spec unwrap_encrypted_frame(binary()) -> {ok, binary()} | {error, not_encrypted}.
unwrap_encrypted_frame(<<?ENCRYPTED_FRAME_PREFIX, Data/binary>>) ->
    {ok, Data};
unwrap_encrypted_frame(_) ->
    {error, not_encrypted}.

-spec wrap_encrypted_frame(binary()) -> binary().
wrap_encrypted_frame(Data) ->
    <<?ENCRYPTED_FRAME_PREFIX, Data/binary>>.

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").

generate_keypair_test() ->
    Keypair = generate_keypair(),
    ?assert(is_map(Keypair)),
    ?assertEqual(?KEY_SIZE, byte_size(maps:get(public, Keypair))),
    ?assertEqual(?KEY_SIZE, byte_size(maps:get(private, Keypair))).

derive_shared_secret_test() ->
    Keypair1 = generate_keypair(),
    Keypair2 = generate_keypair(),
    {ok, Secret1} = derive_shared_secret(maps:get(public, Keypair2), Keypair1),
    {ok, Secret2} = derive_shared_secret(maps:get(public, Keypair1), Keypair2),
    ?assertEqual(Secret1, Secret2),
    ?assertEqual(?KEY_SIZE, byte_size(Secret1)).

derive_shared_secret_invalid_key_test() ->
    Keypair = generate_keypair(),
    Result = derive_shared_secret(<<"short">>, Keypair),
    ?assertMatch({error, {invalid_peer_key_size, _}}, Result).

new_crypto_state_test() ->
    Secret = crypto:strong_rand_bytes(?KEY_SIZE),
    State = new_crypto_state(Secret),
    ?assertEqual(Secret, maps:get(shared_secret, State)),
    ?assertEqual(0, maps:get(send_counter, State)),
    ?assertEqual(0, maps:get(recv_counter, State)).

encrypt_decrypt_roundtrip_test() ->
    Secret = crypto:strong_rand_bytes(?KEY_SIZE),
    State = new_crypto_state(Secret),
    Plaintext = <<"hello world">>,
    {ok, Ciphertext, State2} = encrypt(Plaintext, State),
    ?assert(byte_size(Ciphertext) > byte_size(Plaintext)),
    ?assertEqual(1, maps:get(send_counter, State2)),
    {ok, Decrypted, State3} = decrypt(Ciphertext, State),
    ?assertEqual(Plaintext, Decrypted),
    ?assertEqual(1, maps:get(recv_counter, State3)).

encrypt_multiple_messages_test() ->
    Secret = crypto:strong_rand_bytes(?KEY_SIZE),
    SendState = new_crypto_state(Secret),
    RecvState = new_crypto_state(Secret),
    Messages = [<<"msg1">>, <<"msg2">>, <<"msg3">>],
    {FinalSendState, FinalRecvState, DecryptedMsgs} = lists:foldl(
        fun(Msg, {SS, RS, Acc}) ->
            {ok, Cipher, SS2} = encrypt(Msg, SS),
            {ok, Plain, RS2} = decrypt(Cipher, RS),
            {SS2, RS2, [Plain | Acc]}
        end,
        {SendState, RecvState, []},
        Messages
    ),
    ?assertEqual(3, maps:get(send_counter, FinalSendState)),
    ?assertEqual(3, maps:get(recv_counter, FinalRecvState)),
    ?assertEqual(Messages, lists:reverse(DecryptedMsgs)).

decrypt_tampered_test() ->
    Secret = crypto:strong_rand_bytes(?KEY_SIZE),
    State = new_crypto_state(Secret),
    {ok, Ciphertext, _} = encrypt(<<"hello">>, State),
    Tampered = <<(binary:first(Ciphertext) bxor 1), (binary:part(Ciphertext, 1, byte_size(Ciphertext) - 1))/binary>>,
    Result = decrypt(Tampered, State),
    ?assertMatch({error, _}, Result).

decrypt_too_short_test() ->
    Secret = crypto:strong_rand_bytes(?KEY_SIZE),
    State = new_crypto_state(Secret),
    Result = decrypt(<<"short">>, State),
    ?assertMatch({error, {invalid_encrypted_data, too_short}}, Result).

is_encrypted_frame_test() ->
    ?assertEqual(true, is_encrypted_frame(<<16#FE, "data">>)),
    ?assertEqual(false, is_encrypted_frame(<<"data">>)),
    ?assertEqual(false, is_encrypted_frame(<<16#FF, "data">>)),
    ?assertEqual(false, is_encrypted_frame(<<>>)).

unwrap_encrypted_frame_test() ->
    ?assertEqual({ok, <<"data">>}, unwrap_encrypted_frame(<<16#FE, "data">>)),
    ?assertEqual({error, not_encrypted}, unwrap_encrypted_frame(<<"data">>)).

wrap_encrypted_frame_test() ->
    ?assertEqual(<<16#FE, "data">>, wrap_encrypted_frame(<<"data">>)).

counter_to_nonce_test() ->
    Nonce0 = counter_to_nonce(0),
    ?assertEqual(?NONCE_SIZE, byte_size(Nonce0)),
    ?assertEqual(<<0:32, 0:64>>, Nonce0),
    Nonce1 = counter_to_nonce(1),
    ?assertEqual(<<0:32, 1:64>>, Nonce1).

init_creates_keypair_test() ->
    persistent_term:erase(?KEYPAIR_KEY),
    ok = init(),
    Public = get_public_key(),
    ?assert(is_binary(Public)),
    ?assertEqual(?KEY_SIZE, byte_size(Public)),
    persistent_term:erase(?KEYPAIR_KEY).

init_idempotent_test() ->
    persistent_term:erase(?KEYPAIR_KEY),
    ok = init(),
    Public1 = get_public_key(),
    ok = init(),
    Public2 = get_public_key(),
    ?assertEqual(Public1, Public2),
    persistent_term:erase(?KEYPAIR_KEY).

-endif.
