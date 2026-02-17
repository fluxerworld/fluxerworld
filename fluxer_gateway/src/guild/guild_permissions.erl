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

-module(guild_permissions).

-define(ALL_PERMISSIONS, 16#FFFFFFFFFFFFFFFF).

-export([
    get_member_permissions/3,
    can_view_channel/4,
    can_view_channel_by_permissions/4,
    can_manage_channel/3,
    can_access_message_by_permissions/3,
    apply_channel_overwrites/5,
    get_max_role_position/2,
    find_member_by_user_id/2,
    find_role_by_id/2,
    find_channel_by_id/2
]).

-export_type([permission/0]).

-type permission() :: non_neg_integer().
-type user_id() :: integer().
-type role_id() :: integer().
-type channel_id() :: integer().
-type maybe_channel_id() :: channel_id() | undefined.
-type guild_state() :: map().
-type guild_data() :: map().
-type member() :: map().
-type role() :: map().
-type channel() :: map().
-type overwrite() :: map().
-type member_roles() :: [role_id()].
-type maybe_member() :: member() | undefined.

-spec get_member_permissions(user_id(), maybe_channel_id(), guild_state()) -> permission().
get_member_permissions(UserId, ChannelId, State) ->
    compute_member_permissions(UserId, ChannelId, undefined, State).

-spec can_view_channel(user_id(), channel_id(), maybe_member(), guild_state()) -> boolean().
can_view_channel(UserId, ChannelId, Member, State) ->
    guild_virtual_channel_access:has_virtual_access(UserId, ChannelId, State) orelse
        can_view_channel_by_permissions(UserId, ChannelId, Member, State).

-spec can_view_channel_by_permissions(user_id(), channel_id(), maybe_member(), guild_state()) ->
    boolean().
can_view_channel_by_permissions(UserId, ChannelId, Member, State) ->
    Perms = compute_member_permissions(UserId, ChannelId, Member, State),
    (Perms band constants:view_channel_permission()) =/= 0.

-spec can_manage_channel(user_id(), maybe_channel_id(), guild_state()) -> boolean().
can_manage_channel(UserId, ChannelId, State) ->
    Perms = get_member_permissions(UserId, ChannelId, State),
    (Perms band constants:manage_channels_permission()) =/= 0.

-spec can_access_message_by_permissions(permission(), binary(), guild_state()) -> boolean().
can_access_message_by_permissions(Permissions, MessageId, State) ->
    HasReadHistory = (Permissions band constants:read_message_history_permission()) =/= 0,
    case HasReadHistory of
        true ->
            true;
        false ->
            case get_message_history_cutoff(State) of
                null ->
                    false;
                CutoffMs ->
                    MessageMs = snowflake_util:extract_timestamp(MessageId),
                    MessageMs >= CutoffMs
            end
    end.

-spec get_message_history_cutoff(guild_state()) -> integer() | null.
get_message_history_cutoff(State) ->
    case resolve_data_map(State) of
        undefined ->
            null;
        Data ->
            Guild = maps:get(<<"guild">>, Data, #{}),
            case maps:get(<<"message_history_cutoff">>, Guild, null) of
                null ->
                    null;
                CutoffBin when is_binary(CutoffBin) ->
                    calendar:rfc3339_to_system_time(
                        binary_to_list(CutoffBin), [{unit, millisecond}]
                    );
                CutoffInt when is_integer(CutoffInt) ->
                    CutoffInt
            end
    end.

-spec apply_channel_overwrites(permission(), user_id(), member_roles(), channel(), role_id()) ->
    permission().
apply_channel_overwrites(BasePerms, UserId, MemberRoles, Channel, EveryoneRoleId) ->
    Overwrites = channel_overwrites(Channel),
    EveryonePerms = apply_everyone_overwrites(BasePerms, Overwrites, EveryoneRoleId),
    {RoleAllow, RoleDeny} = accumulate_role_overwrites(MemberRoles, Overwrites),
    RolePerms = (EveryonePerms band bnot RoleDeny) bor RoleAllow,
    apply_user_overwrites(RolePerms, Overwrites, UserId).

-spec get_max_role_position(user_id(), guild_state()) -> integer().
get_max_role_position(UserId, State) ->
    case {find_member_by_user_id(UserId, State), resolve_data_map(State)} of
        {undefined, _} ->
            -1;
        {_, undefined} ->
            -1;
        {Member, Data} ->
            Roles = guild_data_index:role_index(Data),
            compute_max_position(Member, Roles)
    end.

-spec compute_max_position(member(), [role()] | map()) -> integer().
compute_max_position(Member, Roles) ->
    lists:foldl(
        fun(RoleId, MaxPos) ->
            case find_role_by_id(RoleId, Roles) of
                undefined ->
                    MaxPos;
                Role ->
                    Position = maps:get(<<"position">>, Role, 0),
                    max(Position, MaxPos)
            end
        end,
        -1,
        member_role_ids(Member)
    ).

-spec find_member_by_user_id(user_id(), guild_state()) -> member() | undefined.
find_member_by_user_id(UserId, State) when is_integer(UserId) ->
    case resolve_data_map(State) of
        undefined ->
            undefined;
        Data ->
            Members = guild_data_index:member_map(Data),
            maps:get(UserId, Members, undefined)
    end;
find_member_by_user_id(_, _) ->
    undefined.

-spec find_role_by_id(role_id(), [role()] | map()) -> role() | undefined.
find_role_by_id(RoleId, Roles) when is_map(Roles) ->
    maps:get(to_int(RoleId), Roles, undefined);
find_role_by_id(RoleId, Roles) ->
    TargetId = to_int(RoleId),
    lists:foldl(
        fun
            (_, Found) when Found =/= undefined -> Found;
            (Role, undefined) ->
                case role_id(Role) =:= TargetId of
                    true -> Role;
                    false -> undefined
                end
        end,
        undefined,
        ensure_list(Roles)
    ).

-spec find_channel_by_id(channel_id(), guild_state()) -> channel() | undefined.
find_channel_by_id(ChannelId, State) when is_integer(ChannelId) ->
    case resolve_data_map(State) of
        undefined ->
            undefined;
        Data ->
            Channels = guild_data_index:channel_index(Data),
            maps:get(ChannelId, Channels, undefined)
    end;
find_channel_by_id(_, _) ->
    undefined.

-spec compute_member_permissions(user_id(), maybe_channel_id(), maybe_member(), guild_state()) ->
    permission().
compute_member_permissions(UserId, ChannelId, ProvidedMember, State) when is_integer(UserId) ->
    case resolve_data_map(State) of
        undefined ->
            0;
        Data ->
            OwnerId = guild_owner_id(Data),
            case UserId =:= OwnerId of
                true ->
                    ?ALL_PERMISSIONS;
                false ->
                    compute_non_owner_permissions(UserId, ChannelId, ProvidedMember, State, Data)
            end
    end;
compute_member_permissions(_, _, _, _) ->
    0.

-spec compute_non_owner_permissions(
    user_id(), maybe_channel_id(), maybe_member(), guild_state(), guild_data()
) ->
    permission().
compute_non_owner_permissions(UserId, ChannelId, ProvidedMember, State, Data) ->
    case resolve_member(UserId, ProvidedMember, State) of
        undefined ->
            0;
        Member ->
            GuildId = guild_id(State),
            Roles = guild_data_index:role_index(Data),
            BasePermissions = base_role_permissions(GuildId, Roles),
            MemberRoles = member_role_ids(Member),
            Permissions = aggregate_role_permissions(MemberRoles, Roles, BasePermissions),
            case (Permissions band constants:administrator_permission()) =/= 0 of
                true ->
                    ?ALL_PERMISSIONS;
                false ->
                    maybe_apply_channel_overwrites(
                        Permissions, UserId, MemberRoles, ChannelId, GuildId, State
                    )
            end
    end.

-spec resolve_member(user_id(), maybe_member(), guild_state()) -> maybe_member().
resolve_member(_UserId, Member, _State) when is_map(Member) ->
    Member;
resolve_member(UserId, _Member, State) ->
    find_member_by_user_id(UserId, State).

-spec guild_owner_id(guild_data()) -> user_id().
guild_owner_id(Data) ->
    Guild = maps:get(<<"guild">>, Data, #{}),
    to_int(maps:get(<<"owner_id">>, Guild, <<"0">>)).

-spec guild_id(guild_state()) -> integer().
guild_id(State) ->
    case maps:get(id, State, undefined) of
        undefined -> to_int(maps:get(<<"id">>, State, 0));
        GuildId when is_integer(GuildId) -> GuildId;
        GuildId -> to_int(GuildId)
    end.

-spec base_role_permissions(role_id(), map()) -> permission().
base_role_permissions(GuildId, Roles) ->
    case find_role_by_id(GuildId, Roles) of
        undefined -> 0;
        Role -> role_permissions(Role)
    end.

-spec aggregate_role_permissions(member_roles(), [role()] | map(), permission()) -> permission().
aggregate_role_permissions(MemberRoles, Roles, BasePermissions) ->
    lists:foldl(
        fun(RoleId, Acc) ->
            case find_role_by_id(RoleId, Roles) of
                undefined -> Acc;
                Role -> Acc bor role_permissions(Role)
            end
        end,
        BasePermissions,
        MemberRoles
    ).

-spec maybe_apply_channel_overwrites(
    permission(), user_id(), member_roles(), maybe_channel_id(), role_id(), guild_state()
) -> permission().
maybe_apply_channel_overwrites(Permissions, _UserId, _MemberRoles, undefined, _GuildId, _State) ->
    Permissions;
maybe_apply_channel_overwrites(Permissions, UserId, MemberRoles, ChannelId, GuildId, State) when
    is_integer(ChannelId)
->
    case find_channel_by_id(ChannelId, State) of
        undefined -> Permissions;
        Channel -> apply_channel_overwrites(Permissions, UserId, MemberRoles, Channel, GuildId)
    end;
maybe_apply_channel_overwrites(Permissions, _UserId, _MemberRoles, _ChannelId, _GuildId, _State) ->
    Permissions.

-spec member_role_ids(member()) -> member_roles().
member_role_ids(Member) ->
    RoleIds = maps:get(<<"roles">>, Member, []),
    extract_integer_list(RoleIds).

-spec role_permissions(role()) -> permission().
role_permissions(Role) ->
    to_int(maps:get(<<"permissions">>, Role, <<"0">>)).

-spec role_id(role()) -> role_id().
role_id(Role) ->
    to_int(maps:get(<<"id">>, Role, <<"0">>)).

-spec channel_overwrites(channel()) -> [overwrite()].
channel_overwrites(Channel) ->
    case maps:get(<<"permission_overwrites">>, Channel, []) of
        Overwrites when is_list(Overwrites) -> Overwrites;
        _ -> []
    end.

-spec apply_everyone_overwrites(permission(), [overwrite()], role_id()) -> permission().
apply_everyone_overwrites(BasePerms, Overwrites, EveryoneRoleId) ->
    lists:foldl(
        fun(Overwrite, Acc) ->
            case overwrite_matches_role(Overwrite, EveryoneRoleId) of
                true ->
                    apply_allow_deny(Acc, overwrite_allow(Overwrite), overwrite_deny(Overwrite));
                false ->
                    Acc
            end
        end,
        BasePerms,
        Overwrites
    ).

-spec accumulate_role_overwrites(member_roles(), [overwrite()]) -> {permission(), permission()}.
accumulate_role_overwrites(MemberRoles, Overwrites) ->
    lists:foldl(
        fun(RoleId, {AllowAcc, DenyAcc}) ->
            lists:foldl(
                fun(Overwrite, {A, D}) ->
                    case overwrite_matches_role(Overwrite, RoleId) of
                        true -> {A bor overwrite_allow(Overwrite), D bor overwrite_deny(Overwrite)};
                        false -> {A, D}
                    end
                end,
                {AllowAcc, DenyAcc},
                Overwrites
            )
        end,
        {0, 0},
        MemberRoles
    ).

-spec apply_user_overwrites(permission(), [overwrite()], user_id()) -> permission().
apply_user_overwrites(Perms, Overwrites, UserId) ->
    lists:foldl(
        fun(Overwrite, Acc) ->
            case overwrite_matches_user(Overwrite, UserId) of
                true ->
                    apply_allow_deny(Acc, overwrite_allow(Overwrite), overwrite_deny(Overwrite));
                false ->
                    Acc
            end
        end,
        Perms,
        Overwrites
    ).

-spec overwrite_matches_role(overwrite(), role_id()) -> boolean().
overwrite_matches_role(Overwrite, RoleId) when is_map(Overwrite), is_integer(RoleId) ->
    overwrite_type(Overwrite) =:= 0 andalso overwrite_id(Overwrite) =:= RoleId;
overwrite_matches_role(_, _) ->
    false.

-spec overwrite_matches_user(overwrite(), user_id()) -> boolean().
overwrite_matches_user(Overwrite, UserId) when is_map(Overwrite), is_integer(UserId) ->
    overwrite_type(Overwrite) =:= 1 andalso overwrite_id(Overwrite) =:= UserId;
overwrite_matches_user(_, _) ->
    false.

-spec overwrite_id(overwrite()) -> integer().
overwrite_id(Overwrite) ->
    to_int(maps:get(<<"id">>, Overwrite, <<"0">>)).

-spec overwrite_type(overwrite()) -> integer().
overwrite_type(Overwrite) ->
    maps:get(<<"type">>, Overwrite, 0).

-spec overwrite_allow(overwrite()) -> permission().
overwrite_allow(Overwrite) ->
    to_int(maps:get(<<"allow">>, Overwrite, <<"0">>)).

-spec overwrite_deny(overwrite()) -> permission().
overwrite_deny(Overwrite) ->
    to_int(maps:get(<<"deny">>, Overwrite, <<"0">>)).

-spec apply_allow_deny(permission(), permission(), permission()) -> permission().
apply_allow_deny(Acc, Allow, Deny) ->
    (Acc band bnot Deny) bor Allow.

-spec extract_integer_list(list()) -> [integer()].
extract_integer_list(List) when is_list(List) ->
    lists:reverse(
        lists:foldl(
            fun(Value, Acc) ->
                case type_conv:to_integer(Value) of
                    undefined -> Acc;
                    Int -> [Int | Acc]
                end
            end,
            [],
            List
        )
    );
extract_integer_list(_) ->
    [].

-spec ensure_list(term()) -> list().
ensure_list(List) when is_list(List) -> List;
ensure_list(_) -> [].

-spec to_int(term()) -> integer().
to_int(Value) ->
    case type_conv:to_integer(Value) of
        undefined -> 0;
        Int -> Int
    end.

-spec resolve_data_map(guild_state() | map()) -> guild_data() | undefined.
resolve_data_map(State) when is_map(State) ->
    case maps:find(data, State) of
        {ok, Data} when is_map(Data) -> Data;
        {ok, Data} ->
            Data;
        error ->
            case maps:is_key(<<"members">>, State) of
                true -> State;
                false -> undefined
            end
    end;
resolve_data_map(_) ->
    undefined.

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").

owner_receives_full_permissions_test() ->
    OwnerId = 1,
    GuildId = 100,
    State = #{
        id => GuildId,
        data => #{
            <<"guild">> => #{<<"owner_id">> => integer_to_binary(OwnerId)},
            <<"roles">> => [#{<<"id">> => integer_to_binary(GuildId), <<"permissions">> => <<"0">>}]
        }
    },
    ?assertEqual(?ALL_PERMISSIONS, get_member_permissions(OwnerId, undefined, State)).

channel_scope_permissions_test() ->
    GuildId = 42,
    UserId = 600,
    ChannelId = 700,
    RoleId = 800,
    View = constants:view_channel_permission(),
    State = #{
        id => GuildId,
        data => #{
            <<"guild">> => #{<<"owner_id">> => integer_to_binary(GuildId + 1)},
            <<"roles">> => [
                #{<<"id">> => integer_to_binary(GuildId), <<"permissions">> => <<"0">>},
                #{<<"id">> => integer_to_binary(RoleId), <<"permissions">> => <<"0">>}
            ],
            <<"members">> => [
                #{
                    <<"user">> => #{<<"id">> => integer_to_binary(UserId)},
                    <<"roles">> => [integer_to_binary(RoleId)]
                }
            ],
            <<"channels">> => [
                #{
                    <<"id">> => integer_to_binary(ChannelId),
                    <<"permission_overwrites">> => [
                        #{
                            <<"id">> => integer_to_binary(GuildId),
                            <<"type">> => 0,
                            <<"allow">> => <<"0">>,
                            <<"deny">> => <<"0">>
                        },
                        #{
                            <<"id">> => integer_to_binary(RoleId),
                            <<"type">> => 0,
                            <<"allow">> => integer_to_binary(View),
                            <<"deny">> => <<"0">>
                        }
                    ]
                }
            ]
        }
    },
    ?assertEqual(0, get_member_permissions(UserId, undefined, State)),
    ChannelPerms = get_member_permissions(UserId, ChannelId, State),
    ?assert((ChannelPerms band View) =/= 0).

apply_channel_overwrites_e2e_test() ->
    View = constants:view_channel_permission(),
    GuildId = 5,
    RoleId = 9,
    UserId = 11,
    Channel = #{
        <<"permission_overwrites">> => [
            #{
                <<"id">> => integer_to_binary(GuildId),
                <<"type">> => 0,
                <<"allow">> => <<"0">>,
                <<"deny">> => integer_to_binary(View)
            },
            #{
                <<"id">> => integer_to_binary(RoleId),
                <<"type">> => 0,
                <<"allow">> => integer_to_binary(View),
                <<"deny">> => <<"0">>
            },
            #{
                <<"id">> => integer_to_binary(UserId),
                <<"type">> => 1,
                <<"allow">> => <<"0">>,
                <<"deny">> => integer_to_binary(View)
            }
        ]
    },
    Base = View,
    Result = apply_channel_overwrites(Base, UserId, [RoleId], Channel, GuildId),
    ?assertEqual(0, Result).

administrator_role_grants_all_permissions_test() ->
    Admin = constants:administrator_permission(),
    GuildId = 100,
    UserId = 200,
    ChannelId = 300,
    OwnerId = 999,
    State = #{
        id => GuildId,
        data => #{
            <<"guild">> => #{<<"owner_id">> => integer_to_binary(OwnerId)},
            <<"roles">> => [
                #{
                    <<"id">> => integer_to_binary(GuildId),
                    <<"permissions">> => integer_to_binary(Admin)
                }
            ],
            <<"members">> => [
                #{<<"user">> => #{<<"id">> => integer_to_binary(UserId)}, <<"roles">> => []}
            ],
            <<"channels">> => [
                #{<<"id">> => integer_to_binary(ChannelId), <<"permission_overwrites">> => []}
            ]
        }
    },
    ?assertEqual(?ALL_PERMISSIONS, get_member_permissions(UserId, undefined, State)),
    ?assertEqual(?ALL_PERMISSIONS, get_member_permissions(UserId, ChannelId, State)),
    ?assert(can_view_channel(UserId, ChannelId, undefined, State)).

find_member_by_user_id_found_test() ->
    State = #{
        data => #{
            <<"members">> => [
                #{<<"user">> => #{<<"id">> => <<"123">>}, <<"nick">> => <<"Test">>}
            ]
        }
    },
    Result = find_member_by_user_id(123, State),
    ?assertEqual(<<"Test">>, maps:get(<<"nick">>, Result)).

find_member_by_user_id_not_found_test() ->
    State = #{data => #{<<"members">> => []}},
    ?assertEqual(undefined, find_member_by_user_id(123, State)).

find_member_by_user_id_map_storage_test() ->
    State = #{
        data => #{
            <<"members">> => #{
                321 => #{<<"user">> => #{<<"id">> => <<"321">>}, <<"nick">> => <<"Mapped">>}
            }
        }
    },
    Result = find_member_by_user_id(321, State),
    ?assertEqual(<<"Mapped">>, maps:get(<<"nick">>, Result)).

find_role_by_id_found_test() ->
    Roles = [#{<<"id">> => <<"100">>, <<"name">> => <<"Admin">>}],
    Result = find_role_by_id(100, Roles),
    ?assertEqual(<<"Admin">>, maps:get(<<"name">>, Result)).

find_role_by_id_not_found_test() ->
    Roles = [#{<<"id">> => <<"100">>}],
    ?assertEqual(undefined, find_role_by_id(999, Roles)).

find_role_by_id_map_index_test() ->
    Roles = #{
        100 => #{<<"id">> => <<"100">>, <<"name">> => <<"Admin">>}
    },
    Result = find_role_by_id(100, Roles),
    ?assertEqual(<<"Admin">>, maps:get(<<"name">>, Result)).

find_channel_by_id_with_index_test() ->
    State = #{
        data => #{
            <<"channels">> => [#{<<"id">> => <<"900">>, <<"name">> => <<"general">>}],
            <<"channel_index">> => #{900 => #{<<"id">> => <<"900">>, <<"name">> => <<"general">>}}
        }
    },
    Result = find_channel_by_id(900, State),
    ?assertEqual(<<"general">>, maps:get(<<"name">>, Result)).

to_int_test() ->
    ?assertEqual(123, to_int(123)),
    ?assertEqual(123, to_int(<<"123">>)),
    ?assertEqual(0, to_int(undefined)).

ensure_list_test() ->
    ?assertEqual([1, 2], ensure_list([1, 2])),
    ?assertEqual([], ensure_list(undefined)),
    ?assertEqual([], ensure_list(#{})).

can_access_message_with_read_history_test() ->
    ReadHistory = constants:read_message_history_permission(),
    State = #{data => #{<<"guild">> => #{}}},
    MessageId = <<"100">>,
    ?assertEqual(true, can_access_message_by_permissions(ReadHistory, MessageId, State)).

can_access_message_no_read_history_no_cutoff_test() ->
    State = #{data => #{<<"guild">> => #{}}},
    MessageId = <<"100">>,
    ?assertEqual(false, can_access_message_by_permissions(0, MessageId, State)).

can_access_message_no_read_history_null_cutoff_test() ->
    State = #{data => #{<<"guild">> => #{<<"message_history_cutoff">> => null}}},
    MessageId = <<"100">>,
    ?assertEqual(false, can_access_message_by_permissions(0, MessageId, State)).

can_access_message_no_read_history_message_before_cutoff_test() ->
    CutoffMs = 1704067200000,
    BeforeCutoffTimestamp = CutoffMs - 60000,
    FluxerEpoch = 1420070400000,
    RelativeTs = BeforeCutoffTimestamp - FluxerEpoch,
    Snowflake = RelativeTs bsl 22,
    MessageId = integer_to_binary(Snowflake),
    State = #{data => #{<<"guild">> => #{<<"message_history_cutoff">> => CutoffMs}}},
    ?assertEqual(false, can_access_message_by_permissions(0, MessageId, State)).

can_access_message_no_read_history_message_after_cutoff_test() ->
    CutoffMs = 1704067200000,
    AfterCutoffTimestamp = CutoffMs + 60000,
    FluxerEpoch = 1420070400000,
    RelativeTs = AfterCutoffTimestamp - FluxerEpoch,
    Snowflake = RelativeTs bsl 22,
    MessageId = integer_to_binary(Snowflake),
    State = #{data => #{<<"guild">> => #{<<"message_history_cutoff">> => CutoffMs}}},
    ?assertEqual(true, can_access_message_by_permissions(0, MessageId, State)).

can_access_message_no_read_history_message_at_cutoff_test() ->
    CutoffMs = 1704067200000,
    FluxerEpoch = 1420070400000,
    RelativeTs = CutoffMs - FluxerEpoch,
    Snowflake = RelativeTs bsl 22,
    MessageId = integer_to_binary(Snowflake),
    State = #{data => #{<<"guild">> => #{<<"message_history_cutoff">> => CutoffMs}}},
    ?assertEqual(true, can_access_message_by_permissions(0, MessageId, State)).

can_access_message_with_rfc3339_cutoff_test() ->
    CutoffBin = <<"2024-01-01T00:00:00Z">>,
    CutoffMs = calendar:rfc3339_to_system_time("2024-01-01T00:00:00Z", [{unit, millisecond}]),
    AfterCutoffTimestamp = CutoffMs + 60000,
    FluxerEpoch = 1420070400000,
    RelativeTs = AfterCutoffTimestamp - FluxerEpoch,
    Snowflake = RelativeTs bsl 22,
    MessageId = integer_to_binary(Snowflake),
    State = #{data => #{<<"guild">> => #{<<"message_history_cutoff">> => CutoffBin}}},
    ?assertEqual(true, can_access_message_by_permissions(0, MessageId, State)).

-endif.
