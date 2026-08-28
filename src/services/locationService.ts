import { requireSupabase } from '@/lib/supabase';
import { LocationRow, Presence } from '@/lib/types';

export async function loadLocations(groupId: string) {
  const { data, error } = await requireSupabase().from('locations').select('*').eq('group_id', groupId);
  if (error) throw error;
  return (data ?? []) as LocationRow[];
}

export async function loadPresence(groupId: string) {
  const { data, error } = await requireSupabase().from('group_presence').select('*').eq('group_id', groupId);
  if (error) throw error;
  return (data ?? []) as Presence[];
}

export async function upsertLocation(row: LocationRow) {
  const { error } = await requireSupabase().from('locations').upsert(row, { onConflict: 'group_id,user_id' });
  if (error) throw error;
}

export async function deleteOwnLocations(userId: string) {
  const { error } = await requireSupabase().from('locations').delete().eq('user_id', userId);
  if (error) throw error;
}

export async function touchPresence(row: Presence) {
  const { error } = await requireSupabase().from('group_presence').upsert(row, { onConflict: 'group_id,user_id' });
  if (error) throw error;
}
