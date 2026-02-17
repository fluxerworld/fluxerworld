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

-module(push_utils).

-export([
    construct_avatar_url/2,
    get_default_avatar_url/1,
    extract_origin/1,
    generate_vapid_token/3,
    base64url_encode/1,
    base64url_decode/1,
    encrypt_payload/4,
    decode_subscription_key/1,
    hkdf_expand/4,
    hkdf_expand_loop/6,
    parse_timestamp/1
]).

-spec construct_avatar_url(binary(), binary()) -> binary().
construct_avatar_url(UserId, Hash) ->
    MediaProxyBin = media_proxy_endpoint_binary(),
    iolist_to_binary([
        MediaProxyBin,
        <<"/avatars/">>,
        UserId,
        <<"/">>,
        Hash,
        <<".png">>
    ]).

-spec get_default_avatar_url(binary()) -> binary().
get_default_avatar_url(UserId) ->
    Index = avatar_index(UserId),
    iolist_to_binary([
        <<"https://fluxerstatic.com/avatars/">>,
        integer_to_binary(Index),
        <<".png">>
    ]).

-spec avatar_index(binary()) -> non_neg_integer().
avatar_index(UserId) ->
    case catch binary_to_integer(UserId) of
        {'EXIT', _} -> 0;
        Value -> wrap_avatar_index(Value)
    end.

-spec wrap_avatar_index(integer()) -> non_neg_integer().
wrap_avatar_index(Value) ->
    Rem = Value rem 6,
    case Rem < 0 of
        true -> Rem + 6;
        false -> Rem
    end.

-spec media_proxy_endpoint_binary() -> binary().
media_proxy_endpoint_binary() ->
    case fluxer_gateway_env:get(media_proxy_endpoint) of
        undefined ->
            erlang:error({missing_config, media_proxy_endpoint});
        Endpoint ->
            value_to_binary(Endpoint)
    end.

-spec value_to_binary(binary() | list()) -> binary().
value_to_binary(Value) when is_binary(Value) ->
    Value;
value_to_binary(Value) when is_list(Value) ->
    list_to_binary(Value).

-spec extract_origin(binary()) -> binary().
extract_origin(Url) ->
    case binary:split(Url, <<"://">>) of
        [Protocol, Rest] ->
            case binary:split(Rest, <<"/">>) of
                [Host | _] -> <<Protocol/binary, "://", Host/binary>>;
                _ -> Url
            end;
        _ ->
            Url
    end.

-spec generate_vapid_token(map(), binary(), binary()) -> binary().
generate_vapid_token(Claims, PublicKeyB64Url, PrivateKeyB64Url) ->
    try
        application:ensure_all_started(crypto),
        application:ensure_all_started(public_key),
        application:ensure_all_started(jose),
        PrivRaw =
            case base64url_decode(PrivateKeyB64Url) of
                error ->
                    erlang:error(invalid_private_key);
                PrivDecoded ->
                    PrivDecoded
            end,
        PubRaw =
            case base64url_decode(PublicKeyB64Url) of
                error ->
                    erlang:error(invalid_public_key);
                PubDecoded ->
                    PubDecoded
            end,
        <<4, X:32/binary, Y:32/binary>> = PubRaw,
        B64 = fun(Bin) -> base64url_encode(Bin) end,
        JWKMap = #{
            <<"kty">> => <<"EC">>,
            <<"crv">> => <<"P-256">>,
            <<"d">> => B64(PrivRaw),
            <<"x">> => B64(X),
            <<"y">> => B64(Y)
        },
        JWK0 = jose_jwk:from_map(JWKMap),
        JWK =
            case JWK0 of
                {JW, _Fields} -> JW;
                JW -> JW
            end,
        Header = #{<<"alg">> => <<"ES256">>, <<"typ">> => <<"JWT">>},
        JWS = jose_jwt:sign(JWK, Header, Claims),
        Compact0 = jose_jws:compact(JWS),
        CompactBin =
            case Compact0 of
                {_Meta, Bin} when is_binary(Bin) -> Bin;
                Other ->
                    erlang:error({unexpected_compact_return, Other})
            end,
        CompactBin
    catch
        C:R:_Stack ->
            erlang:error({vapid_token_generation_failed, C, R})
    end.

-spec base64url_encode(binary()) -> binary().
base64url_encode(Data) ->
    jose_base64url:encode(Data).

-spec base64url_decode(binary()) -> binary() | error.
base64url_decode(Data) ->
    case jose_base64url:decode(Data) of
        {ok, Decoded} -> Decoded;
        error -> error
    end.

-spec encrypt_payload(binary(), binary(), binary(), non_neg_integer()) ->
    {ok, binary()} | {error, term()}.
encrypt_payload(Message, PeerPubB64, AuthSecretB64, RecordSize0) ->
    try
        PeerPub = decode_subscription_key(PeerPubB64),
        AuthSecret = decode_subscription_key(AuthSecretB64),
        RecordSize =
            case RecordSize0 of
                0 -> 4096;
                _ -> RecordSize0
            end,
        RecordLen = RecordSize - 16,
        Salt = crypto:strong_rand_bytes(16),
        {LocalPub, LocalPriv} = crypto:generate_key(ecdh, prime256v1),
        <<4, _/binary>> = PeerPub,
        Secret = crypto:compute_key(ecdh, PeerPub, LocalPriv, prime256v1),
        PRKInfo = <<"WebPush: info", 0, PeerPub/binary, LocalPub/binary>>,
        IKM = hkdf_expand(Secret, AuthSecret, PRKInfo, 32),
        CEKInfo = <<"Content-Encoding: aes128gcm", 0>>,
        NonceInfo = <<"Content-Encoding: nonce", 0>>,
        CEK = hkdf_expand(IKM, Salt, CEKInfo, 16),
        Nonce = hkdf_expand(IKM, Salt, NonceInfo, 12),
        HeaderLen = 16 + 4 + 1 + byte_size(LocalPub),
        Data0 = <<Message/binary, 16#02>>,
        Required = RecordLen - HeaderLen,
        Data0Len = byte_size(Data0),
        case Data0Len =< Required of
            false ->
                {error, max_pad_exceeded};
            true ->
                PadLen = Required - Data0Len,
                Padding =
                    case PadLen of
                        0 -> <<>>;
                        _ -> binary:copy(<<0>>, PadLen)
                    end,
                Data = <<Data0/binary, Padding/binary>>,
                {Cipher, Tag} = crypto:crypto_one_time_aead(
                    aes_gcm, CEK, Nonce, Data, <<>>, 16, true
                ),
                Ciphertext = <<Cipher/binary, Tag/binary>>,
                Body = <<
                    Salt/binary,
                    RecordSize:32/big-unsigned-integer,
                    (byte_size(LocalPub)):8,
                    LocalPub/binary,
                    Ciphertext/binary
                >>,
                {ok, Body}
        end
    catch
        _C:_R:_Stack ->
            {error, encryption_failed}
    end.

-spec decode_subscription_key(binary()) -> binary().
decode_subscription_key(B64) when is_binary(B64) ->
    Padded =
        case byte_size(B64) rem 4 of
            0 -> B64;
            Rem -> <<B64/binary, (binary:copy(<<"=">>, 4 - Rem))/binary>>
        end,
    case jose_base64url:decode(Padded) of
        {ok, Decoded} ->
            Decoded;
        _ ->
            try base64:decode(Padded) of
                Decoded when is_binary(Decoded) -> Decoded
            catch
                _:_ -> erlang:error(decode_key_error)
            end
    end.

-spec hkdf_expand(binary(), binary(), binary(), pos_integer()) -> binary().
hkdf_expand(IKM, Salt, Info, Length) ->
    PRK = crypto:mac(hmac, sha256, Salt, IKM),
    hkdf_expand_loop(PRK, Info, Length, 1, <<>>, <<>>).

-spec hkdf_expand_loop(binary(), binary(), pos_integer(), pos_integer(), binary(), binary()) ->
    binary().
hkdf_expand_loop(_PRK, _Info, Length, _I, _Tprev, Acc) when byte_size(Acc) >= Length ->
    binary:part(Acc, 0, Length);
hkdf_expand_loop(PRK, Info, Length, I, Tprev, Acc) ->
    T = crypto:mac(hmac, sha256, PRK, <<Tprev/binary, Info/binary, I:8/integer>>),
    hkdf_expand_loop(PRK, Info, Length, I + 1, T, <<Acc/binary, T/binary>>).

-spec parse_timestamp(binary() | term()) -> integer() | undefined.
parse_timestamp(Str) when is_binary(Str) ->
    try
        binary_to_integer(Str)
    catch
        _:_ -> undefined
    end;
parse_timestamp(_) ->
    undefined.

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").

extract_origin_test() ->
    ?assertEqual(
        <<"https://example.com">>, extract_origin(<<"https://example.com/path/to/resource">>)
    ),
    ?assertEqual(<<"http://localhost:8080">>, extract_origin(<<"http://localhost:8080/api">>)),
    ?assertEqual(<<"invalid">>, extract_origin(<<"invalid">>)).

get_default_avatar_url_test() ->
    Url = get_default_avatar_url(<<"123">>),
    ?assert(is_binary(Url)),
    ?assertMatch(<<"https://fluxerstatic.com/avatars/", _/binary>>, Url).

avatar_index_test() ->
    ?assertEqual(0, avatar_index(<<"0">>)),
    ?assertEqual(1, avatar_index(<<"1">>)),
    ?assertEqual(2, avatar_index(<<"2">>)),
    ?assertEqual(0, avatar_index(<<"6">>)),
    ?assertEqual(0, avatar_index(<<"invalid">>)).

wrap_avatar_index_test() ->
    ?assertEqual(0, wrap_avatar_index(0)),
    ?assertEqual(1, wrap_avatar_index(1)),
    ?assertEqual(0, wrap_avatar_index(6)),
    ?assertEqual(1, wrap_avatar_index(7)).

parse_timestamp_valid_test() ->
    ?assertEqual(123456789, parse_timestamp(<<"123456789">>)),
    ?assertEqual(0, parse_timestamp(<<"0">>)).

parse_timestamp_invalid_test() ->
    ?assertEqual(undefined, parse_timestamp(<<"not_a_number">>)),
    ?assertEqual(undefined, parse_timestamp(123)),
    ?assertEqual(undefined, parse_timestamp(undefined)).

base64url_encode_test() ->
    Encoded = base64url_encode(<<"test">>),
    ?assert(is_binary(Encoded)).

base64url_decode_test() ->
    Encoded = base64url_encode(<<"test">>),
    ?assertEqual(<<"test">>, base64url_decode(Encoded)).

hkdf_expand_test() ->
    IKM = crypto:strong_rand_bytes(32),
    Salt = crypto:strong_rand_bytes(16),
    Info = <<"test info">>,
    Result = hkdf_expand(IKM, Salt, Info, 32),
    ?assertEqual(32, byte_size(Result)).

-endif.
