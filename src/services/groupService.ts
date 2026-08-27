import { groupExpired } from '@/lib/format';
import { requireSupabase } from '@/lib/supabase';
import { Member, Membership } from '@/lib/types';

export async function loadMemberships(userId: string) {
  const { data, error } = await requireSupabase()
    .from('group_members')
    .select('*, groups(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Membership[]).filter((membership) => membership.groups && !groupExpired(membership.groups.expires_at));
}

export async function loadMembers(groupId: string) {
  const { data, error } = await requireSupabase()
    .from('group_members')
    .select('*, profiles(id, alias, symbol, symbol_color)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Member[];
}

export async function createGroup(groupName: string) {
  const { data, error } = await requireSupabase().rpc('create_group_with_owner', { group_name: groupName });
  if (error) throw error;
  return data as string;
}

export async function requestMembership(joinCode: string) {
  const { error } = await requireSupabase().rpc('request_group_membership', { requested_join_code: joinCode });
  if (error) throw error;
}

export async function updateMember(memberId: string, patch: Partial<Member>) {
  const { error } = await requireSupabase().from('group_members').update(patch).eq('id', memberId);
  if (error) throw error;
}

export async function removeMember(memberId: string) {
  const { error } = await requireSupabase().from('group_members').delete().eq('id', memberId);
  if (error) throw error;
}

export async function leaveGroup(groupId: string) {
  const { error } = await requireSupabase().rpc('leave_group', { target_group_id: groupId });
  if (error) throw error;
}

export async function clearLocationPins(groupId: string) {
  const { error } = await requireSupabase().rpc('clear_group_location_messages', { target_group_id: groupId });
  if (error) throw error;
}

export async function clearGroupChat(groupId: string) {
  const { error } = await requireSupabase().rpc('clear_group_chat', { target_group_id: groupId });
  if (error) throw error;
}

export async function deleteGroup(groupId: string) {
  const { error } = await requireSupabase().rpc('delete_group', { target_group_id: groupId });
  if (error) throw error;
}
