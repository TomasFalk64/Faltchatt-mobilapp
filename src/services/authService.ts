import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

import { SYMBOL_COLORS, SYMBOLS } from '@/constants/faltchatt';
import { requireSupabase } from '@/lib/supabase';
import { Profile } from '@/lib/types';

export async function getInitialSession() {
  return requireSupabase().auth.getSession();
}

export function onAuthStateChange(handler: (event: AuthChangeEvent, session: Session | null) => void | Promise<void>) {
  return requireSupabase().auth.onAuthStateChange(handler);
}

export async function signIn(email: string, password: string) {
  return requireSupabase().auth.signInWithPassword({ email, password });
}

export async function signUp(email: string, password: string) {
  return requireSupabase().auth.signUp({ email, password });
}

export async function signOut() {
  return requireSupabase().auth.signOut();
}

export async function sendPasswordReset(email: string) {
  return requireSupabase().auth.resetPasswordForEmail(email, { redirectTo: Linking.createURL('/') });
}

export async function setRecoverySession(accessToken: string, refreshToken: string) {
  return requireSupabase().auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
}

export async function updatePassword(password: string) {
  return requireSupabase().auth.updateUser({ password });
}

export async function ensureProfile(user: User): Promise<Profile> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('id, alias, symbol, symbol_color, updated_at')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as Profile;

  const { error: ensureError } = await client.rpc('ensure_own_profile');
  if (!ensureError) {
    const { data: ensured, error: ensuredError } = await client
      .from('profiles')
      .select('id, alias, symbol, symbol_color, updated_at')
      .eq('id', user.id)
      .maybeSingle();
    if (ensuredError) throw ensuredError;
    if (ensured) return ensured as Profile;
  }

  const { data: created, error: createError } = await client
    .from('profiles')
    .insert({
      id: user.id,
      alias: 'Fältanvändare',
      symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)].id,
      symbol_color: SYMBOL_COLORS[Math.floor(Math.random() * SYMBOL_COLORS.length)],
    })
    .select('id, alias, symbol, symbol_color, updated_at')
    .single();
  if (createError) {
    console.warn('Kunde inte skapa profilrad.', ensureError ?? createError);
    return {
      id: user.id,
      alias: 'Fältanvändare',
      symbol: SYMBOLS[0].id,
      symbol_color: SYMBOL_COLORS[0],
    };
  }
  return created as Profile;
}

export async function saveProfile(profile: Profile) {
  return requireSupabase().from('profiles').upsert({
    id: profile.id,
    alias: profile.alias,
    symbol: profile.symbol,
    symbol_color: profile.symbol_color,
    updated_at: new Date().toISOString(),
  });
}

export async function touchAccountActivity() {
  try {
    await requireSupabase().rpc('touch_account_activity');
  } catch {
    // The deployed web backend has this RPC; tolerate older local databases.
  }
}

export async function deleteAccount(confirmEmail: string) {
  return requireSupabase().functions.invoke('delete-my-account', { body: { confirmEmail } });
}
