import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Callout, Marker, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ACTIVE_LOCATION_MS,
  ACTIVE_PRESENCE_MS,
  HIDDEN_LOCATION_MS,
  MAX_SEND_INTERVAL_MS,
  MIN_SEND_DISTANCE_METERS,
  MIN_SEND_INTERVAL_MS,
  SYMBOL_COLORS,
  SYMBOLS,
  symbolGlyph,
  symbolLabel,
} from '@/constants/faltchatt';
import { distanceMeters, formatDateTime, formatRelative, friendlyError, groupExpired } from '@/lib/format';
import { isSupabaseConfigured, requireSupabase, supabase } from '@/lib/supabase';
import { Group, LocationRow, Member, Membership, Message, Presence, Profile, Question, QuestionAnswer } from '@/lib/types';

type ViewKey = 'group' | 'chat' | 'profile' | 'admin';
type AuthMode = 'signin' | 'signup';

const ACTIVE_GROUP_KEY = 'faltchatt.activeGroupId';
const SHARE_LOCATION_KEY = 'faltchatt.locationSharingEnabled';
const DEFAULT_REGION: Region = {
  latitude: 62,
  longitude: 15,
  latitudeDelta: 12,
  longitudeDelta: 12,
};

export default function FaltchattApp() {
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [questions, setQuestions] = useState<Map<string, Question>>(new Map());
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const [activeGroupId, setActiveGroupIdState] = useState<string | null>(null);
  const [view, setView] = useState<ViewKey>('group');
  const [unreadChat, setUnreadChat] = useState(false);
  const [unreadGroup, setUnreadGroup] = useState(false);
  const [groupNotice, setGroupNotice] = useState('');
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [locationSharingEnabled, setLocationSharingEnabledState] = useState(true);
  const [ownLocation, setOwnLocation] = useState<LocationRow | null>(null);
  const [mapTarget, setMapTarget] = useState<{ latitude: number; longitude: number; text?: string } | null>(null);
  const mapRef = useRef<MapView>(null);
  const previousMemberships = useRef<Map<string, string>>(new Map());
  const activeGroupIdRef = useRef<string | null>(null);
  const locationSharingRef = useRef(true);
  const userRef = useRef<User | null>(null);
  const lastSent = useRef<{ at: number; lat: number | null; lng: number | null }>({ at: 0, lat: null, lng: null });
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  const activeGroup = useMemo(
    () => memberships.find((item) => item.group_id === activeGroupId)?.groups ?? null,
    [activeGroupId, memberships],
  );
  const ownMembership = useMemo(
    () => memberships.find((item) => item.group_id === activeGroupId) ?? null,
    [activeGroupId, memberships],
  );
  const approved = Boolean(activeGroup && ownMembership?.status === 'approved' && !groupExpired(activeGroup.expires_at));
  const role = approved ? ownMembership?.role ?? null : null;
  const canAdmin = role === 'owner' || role === 'admin';
  const canOwn = role === 'owner';

  const setActiveGroupId = useCallback(async (groupId: string | null) => {
    activeGroupIdRef.current = groupId;
    setActiveGroupIdState(groupId);
    if (groupId) await AsyncStorage.setItem(ACTIVE_GROUP_KEY, groupId);
    else await AsyncStorage.removeItem(ACTIVE_GROUP_KEY);
  }, []);

  const setLocationSharingEnabled = useCallback(async (enabled: boolean) => {
    locationSharingRef.current = enabled;
    setLocationSharingEnabledState(enabled);
    await AsyncStorage.setItem(SHARE_LOCATION_KEY, String(enabled));
  }, []);

  const showError = useCallback((error: unknown, fallback: string) => {
    console.error(error);
    setNotice(friendlyError(error, fallback));
  }, []);

  const ensureProfile = useCallback(async (currentUser: User) => {
    const client = requireSupabase();
    try {
      await client.rpc('ensure_own_profile');
    } catch {
      // Older databases may rely on direct profile insert below.
    }
    const { data, error } = await client
      .from('profiles')
      .select('id, alias, symbol, symbol_color, updated_at')
      .eq('id', currentUser.id)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      setProfile(data);
      return data;
    }
    const { data: created, error: createError } = await client
      .from('profiles')
      .insert({
        id: currentUser.id,
        alias: 'Fältanvändare',
        symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)].id,
        symbol_color: SYMBOL_COLORS[Math.floor(Math.random() * SYMBOL_COLORS.length)],
      })
      .select('id, alias, symbol, symbol_color, updated_at')
      .single();
    if (createError) throw createError;
    setProfile(created);
    return created;
  }, []);

  const loadChatData = useCallback(async (groupId: string | null, isApproved: boolean) => {
    if (!groupId || !isApproved) {
      setMessages([]);
      setQuestions(new Map());
      setAnswers([]);
      return;
    }
    const client = requireSupabase();
    const [{ data: messageData, error: messageError }, { data: questionData, error: questionError }, { data: answerData, error: answerError }] =
      await Promise.all([
        client.from('messages').select('*').eq('group_id', groupId).order('created_at', { ascending: true }).limit(150),
        client.from('questions').select('*, question_options(*)').eq('group_id', groupId).order('created_at', { ascending: true }),
        client.from('question_answers').select('*, question_options(label), profiles(alias)').eq('group_id', groupId),
      ]);
    if (messageError) throw messageError;
    if (questionError) throw questionError;
    if (answerError) throw answerError;
    setMessages((messageData ?? []) as Message[]);
    setQuestions(new Map(((questionData ?? []) as Question[]).map((question) => [question.message_id, question])));
    setAnswers((answerData ?? []) as QuestionAnswer[]);
  }, []);

  const refreshAll = useCallback(
    async (requestedGroupId = activeGroupIdRef.current) => {
      const currentUser = userRef.current;
      if (!currentUser) {
        setProfile(null);
        setMemberships([]);
        setMembers([]);
        setPresence([]);
        setLocations([]);
        setMessages([]);
        setQuestions(new Map());
        setAnswers([]);
        setOwnLocation(null);
        setView('group');
        return;
      }

      const client = requireSupabase();
      await ensureProfile(currentUser);
      try {
        await client.rpc('touch_account_activity');
      } catch {
        // Account activity exists in the deployed web backend; ignore only if an older database lacks it.
      }

      const { data: membershipData, error } = await client
        .from('group_members')
        .select('*, groups(*)')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const currentMemberships = ((membershipData ?? []) as Membership[]).filter(
        (membership) => membership.groups && !groupExpired(membership.groups.expires_at),
      );
      const newlyApproved = currentMemberships.find((membership) => {
        const previous = previousMemberships.current.get(membership.group_id);
        return membership.status === 'approved' && previous && previous !== 'approved';
      });
      previousMemberships.current = new Map(currentMemberships.map((membership) => [membership.group_id, membership.status]));

      if (newlyApproved) {
        const name = newlyApproved.groups?.name ?? `Grupp ${newlyApproved.group_id.slice(0, 8)}`;
        setGroupNotice(`Du är nu godkänd i ${name}.`);
        if (view !== 'group') setUnreadGroup(true);
      }

      let nextGroupId = requestedGroupId;
      if (!nextGroupId || !currentMemberships.some((item) => item.group_id === nextGroupId)) {
        nextGroupId = currentMemberships.find((item) => item.status === 'approved')?.group_id ?? currentMemberships[0]?.group_id ?? null;
      }
      activeGroupIdRef.current = nextGroupId;
      setActiveGroupIdState(nextGroupId);
      if (nextGroupId) await AsyncStorage.setItem(ACTIVE_GROUP_KEY, nextGroupId);
      else await AsyncStorage.removeItem(ACTIVE_GROUP_KEY);

      const activeMembership = currentMemberships.find((item) => item.group_id === nextGroupId);
      const isApproved = Boolean(activeMembership?.status === 'approved' && activeMembership.groups && !groupExpired(activeMembership.groups.expires_at));
      setMemberships(currentMemberships);

      if (!nextGroupId || !isApproved) {
        setMembers([]);
        setPresence([]);
        setLocations([]);
        await loadChatData(null, false);
        return;
      }

      const [{ data: memberData, error: memberError }, { data: presenceData, error: presenceError }, { data: locationData, error: locationError }] =
        await Promise.all([
          client.from('group_members').select('*, profiles(id, alias, symbol, symbol_color)').eq('group_id', nextGroupId).order('created_at', { ascending: true }),
          client.from('group_presence').select('*').eq('group_id', nextGroupId),
          client.from('locations').select('*').eq('group_id', nextGroupId),
        ]);
      if (memberError) throw memberError;
      if (presenceError) throw presenceError;
      if (locationError) throw locationError;
      setMembers((memberData ?? []) as Member[]);
      setPresence((presenceData ?? []) as Presence[]);
      setLocations((locationData ?? []) as LocationRow[]);
      await loadChatData(nextGroupId, true);
    },
    [ensureProfile, loadChatData, view],
  );

  useEffect(() => {
    activeGroupIdRef.current = activeGroupId;
  }, [activeGroupId]);

  useEffect(() => {
    locationSharingRef.current = locationSharingEnabled;
  }, [locationSharingEnabled]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    let mounted = true;
    async function handleRecoveryUrl(url: string | null) {
      if (!url || !supabase) return;
      const fragment = url.includes('#') ? url.split('#')[1] : '';
      const query = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
      const params = new URLSearchParams(fragment || query);
      if (params.get('type') !== 'recovery') return;
      setPasswordRecovery(true);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) showError(error, 'Kunde inte öppna återställningslänken.');
        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
        userRef.current = data.session?.user ?? null;
      }
    }
    async function boot() {
      if (!supabase) {
        setBooting(false);
        return;
      }
      const [storedGroupId, storedSharing] = await Promise.all([
        AsyncStorage.getItem(ACTIVE_GROUP_KEY),
        AsyncStorage.getItem(SHARE_LOCATION_KEY),
      ]);
      if (storedSharing !== null) {
        locationSharingRef.current = storedSharing === 'true';
        setLocationSharingEnabledState(storedSharing === 'true');
      }
      activeGroupIdRef.current = storedGroupId;
      setActiveGroupIdState(storedGroupId);
      const { data, error } = await supabase.auth.getSession();
      if (error) showError(error, 'Kunde inte läsa Supabase-sessionen.');
      if (!mounted) return;
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      userRef.current = data.session?.user ?? null;
      await handleRecoveryUrl(await Linking.getInitialURL());
      setBooting(false);
    }
    boot();
    const linkSubscription = Linking.addEventListener('url', ({ url }) => {
      handleRecoveryUrl(url).catch((error) => showError(error, 'Kunde inte öppna länken.'));
    });
    const subscription = supabase?.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      userRef.current = nextSession?.user ?? null;
      setView('group');
      refreshAll(activeGroupIdRef.current).catch((error) => showError(error, 'Kunde inte ladda kontot.'));
    });
    return () => {
      mounted = false;
      linkSubscription.remove();
      subscription?.data.subscription.unsubscribe();
    };
  }, [refreshAll, showError]);

  useEffect(() => {
    if (!booting) refreshAll(activeGroupIdRef.current).catch((error) => showError(error, 'Kunde inte ladda Fältchatt.'));
  }, [booting, refreshAll, showError, session]);

  useEffect(() => {
    if (!supabase || !user) return;
    const client = requireSupabase();
    const groupChannel = client
      .channel('mobile-group-memberships')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () => {
        refreshAll(activeGroupIdRef.current).catch((error) => showError(error, 'Kunde inte uppdatera gruppdata.'));
      })
      .subscribe();
    return () => {
      client.removeChannel(groupChannel);
    };
  }, [refreshAll, showError, user]);

  useEffect(() => {
    if (!supabase || !activeGroupId || !approved || !user) return;
    const client = requireSupabase();
    const refresh = () => refreshAll(activeGroupIdRef.current).catch((error) => showError(error, 'Kunde inte uppdatera Realtime-data.'));
    const locationsChannel = client
      .channel(`mobile-locations:${activeGroupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations', filter: `group_id=eq.${activeGroupId}` }, (payload) => {
        const row = (payload.new || payload.old) as LocationRow;
        if (!row) return;
        setLocations((current) => {
          if (payload.eventType === 'DELETE') return current.filter((item) => !(item.group_id === row.group_id && item.user_id === row.user_id));
          const without = current.filter((item) => !(item.group_id === row.group_id && item.user_id === row.user_id));
          return [...without, row];
        });
      })
      .subscribe();
    const chatChannel = client
      .channel(`mobile-chat:${activeGroupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `group_id=eq.${activeGroupId}` }, (payload) => {
        const row = (payload.new || payload.old) as Message;
        if (payload.eventType !== 'DELETE' && row?.user_id !== user.id && view !== 'chat') setUnreadChat(true);
        refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions', filter: `group_id=eq.${activeGroupId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'question_answers', filter: `group_id=eq.${activeGroupId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_presence', filter: `group_id=eq.${activeGroupId}` }, refresh)
      .subscribe();
    const timer = setInterval(refresh, 20000);
    return () => {
      clearInterval(timer);
      client.removeChannel(locationsChannel);
      client.removeChannel(chatChannel);
    };
  }, [activeGroupId, approved, refreshAll, showError, user, view]);

  useEffect(() => {
    if (!activeGroupId || !approved || !user) return;
    const touch = () => {
      requireSupabase()
        .from('group_presence')
        .upsert(
          {
            group_id: activeGroupId,
            user_id: user.id,
            last_seen: new Date().toISOString(),
            is_sharing_location: locationSharingRef.current,
          },
          { onConflict: 'group_id,user_id' },
        )
        .then(() => undefined);
    };
    touch();
    const timer = setInterval(touch, 30000);
    return () => clearInterval(timer);
  }, [activeGroupId, approved, user]);

  useEffect(() => {
    async function startLocation() {
      if (!activeGroupId || !approved || !user || !locationSharingEnabled) {
        locationSubscription.current?.remove();
        locationSubscription.current = null;
        return;
      }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        await setLocationSharingEnabled(false);
        setNotice('Platsbehörighet saknas. Aktivera position i telefonens appinställningar och slå på delning igen.');
        return;
      }
      locationSubscription.current?.remove();
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000,
          distanceInterval: 5,
        },
        async (position) => {
          const { latitude, longitude, accuracy, heading, speed } = position.coords;
          const elapsed = Date.now() - lastSent.current.at;
          const moved =
            lastSent.current.lat === null || lastSent.current.lng === null
              ? Infinity
              : distanceMeters(lastSent.current.lat, lastSent.current.lng, latitude, longitude);
          const shouldSend =
            lastSent.current.lat === null ||
            (elapsed >= MIN_SEND_INTERVAL_MS && moved > MIN_SEND_DISTANCE_METERS) ||
            elapsed >= MAX_SEND_INTERVAL_MS;
          const updated_at = new Date().toISOString();
          const row = {
            group_id: activeGroupId,
            user_id: user.id,
            latitude,
            longitude,
            accuracy: accuracy ?? 0,
            heading: Number.isFinite(heading) ? heading : null,
            speed: Number.isFinite(speed) ? speed : null,
            updated_at,
          };
          setOwnLocation(row);
          if (!shouldSend) return;
          lastSent.current = { at: Date.now(), lat: latitude, lng: longitude };
          const { error } = await requireSupabase().from('locations').upsert(row, { onConflict: 'group_id,user_id' });
          if (error) showError(error, 'Kunde inte dela positionen.');
        },
      );
    }
    startLocation().catch((error) => showError(error, 'Kunde inte starta foreground-position.'));
    return () => {
      locationSubscription.current?.remove();
      locationSubscription.current = null;
    };
  }, [activeGroupId, approved, locationSharingEnabled, setLocationSharingEnabled, showError, user]);

  const membersByUser = useMemo(() => new Map(members.map((member) => [member.user_id, member])), [members]);
  const visibleLocations = useMemo(() => {
    const rows = [...locations];
    if (ownLocation && !rows.some((row) => row.group_id === ownLocation.group_id && row.user_id === ownLocation.user_id)) rows.push(ownLocation);
    return rows.filter((row) => {
      const age = Date.now() - new Date(row.updated_at).getTime();
      return age <= HIDDEN_LOCATION_MS && (row.user_id === user?.id || membersByUser.get(row.user_id)?.status === 'approved');
    });
  }, [locations, membersByUser, ownLocation, user?.id]);
  const locationMessages = useMemo(() => messages.filter((message) => message.type === 'location' && message.latitude && message.longitude), [messages]);

  useEffect(() => {
    const target = mapTarget ?? visibleLocations.find((row) => row.user_id === user?.id) ?? visibleLocations[0];
    if (!target) return;
    mapRef.current?.animateToRegion(
      {
        latitude: target.latitude,
        longitude: target.longitude,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      },
      400,
    );
  }, [mapTarget, user?.id, visibleLocations]);

  if (!isSupabaseConfigured) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <Text style={styles.brand}>Fältchatt</Text>
        <Text style={styles.muted}>Supabase saknar konfiguration. Lägg EXPO_PUBLIC_SUPABASE_URL och EXPO_PUBLIC_SUPABASE_ANON_KEY i .env.local.</Text>
      </SafeAreaView>
    );
  }

  if (booting) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <ActivityIndicator />
        <Text style={styles.muted}>Laddar Fältchatt...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {user ? (
          <>
            <MapPanel
              approved={approved}
              activeGroup={activeGroup}
              locations={visibleLocations}
              locationMessages={locationMessages}
              mapRef={mapRef}
              membersByUser={membersByUser}
              onOpenMessage={(message) => setMapTarget({ latitude: message.latitude!, longitude: message.longitude!, text: message.text })}
              region={DEFAULT_REGION}
              userId={user.id}
            />
            <View style={styles.noticeArea}>
              {notice ? <Notice text={notice} onClose={() => setNotice('')} /> : null}
              {groupNotice ? <Notice text={groupNotice} tone="success" onClose={() => setGroupNotice('')} /> : null}
            </View>
            <TabBar
              canAdmin={canAdmin}
              unreadChat={unreadChat}
              unreadGroup={unreadGroup}
              value={view}
              onChange={(next) => {
                setView(next);
                if (next === 'chat') setUnreadChat(false);
                if (next === 'group') setUnreadGroup(false);
              }}
            />
            <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} keyboardShouldPersistTaps="handled">
              {view === 'group' ? (
                <GroupView
                  activeGroup={activeGroup}
                  activeGroupId={activeGroupId}
                  approved={approved}
                  busy={busy}
                  canAdmin={canAdmin}
                  canOwn={canOwn}
                  locationSharingEnabled={locationSharingEnabled}
                  members={members}
                  memberships={memberships}
                  presence={presence}
                  profile={profile}
                  role={role}
                  setBusy={setBusy}
                  setNotice={setNotice}
                  onRefresh={() => refreshAll(activeGroupIdRef.current)}
                  onSelectGroup={async (groupId) => {
                    await setActiveGroupId(groupId);
                    await refreshAll(groupId);
                  }}
                  onSetSharing={setLocationSharingEnabled}
                  user={user}
                />
              ) : null}
              {view === 'chat' ? (
                <ChatView
                  activeGroup={activeGroup}
                  approved={approved}
                  busy={busy}
                  membersByUser={membersByUser}
                  messages={messages}
                  questions={questions}
                  answers={answers}
                  setBusy={setBusy}
                  setNotice={setNotice}
                  onRefresh={() => refreshAll(activeGroupIdRef.current)}
                  onShowOnMap={(latitude, longitude, text) => setMapTarget({ latitude, longitude, text })}
                  ownLocation={ownLocation}
                  user={user}
                />
              ) : null}
              {view === 'profile' ? (
                <ProfileView
                  locationSharingEnabled={locationSharingEnabled}
                  passwordRecovery={passwordRecovery}
                  profile={profile}
                  setBusy={setBusy}
                  setNotice={setNotice}
                  onRefresh={() => refreshAll(activeGroupIdRef.current)}
                  onSetSharing={setLocationSharingEnabled}
                  onPasswordRecoveryDone={() => setPasswordRecovery(false)}
                  user={user}
                />
              ) : null}
              {view === 'admin' ? (
                <AdminView
                  activeGroup={activeGroup}
                  canAdmin={canAdmin}
                  canOwn={canOwn}
                  members={members}
                  setBusy={setBusy}
                  setNotice={setNotice}
                  onRefresh={() => refreshAll(activeGroupIdRef.current)}
                  onSelectGroup={setActiveGroupId}
                />
              ) : null}
            </ScrollView>
          </>
        ) : (
          <AuthView setNotice={setNotice} />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MapPanel({
  activeGroup,
  approved,
  locations,
  locationMessages,
  mapRef,
  membersByUser,
  onOpenMessage,
  region,
  userId,
}: {
  activeGroup: Group | null;
  approved: boolean;
  locations: LocationRow[];
  locationMessages: Message[];
  mapRef: React.RefObject<MapView | null>;
  membersByUser: Map<string, Member>;
  onOpenMessage: (message: Message) => void;
  region: Region;
  userId: string;
}) {
  return (
    <View style={styles.mapWrap}>
      <MapView ref={mapRef} style={styles.map} initialRegion={region} showsUserLocation={false}>
        {approved
          ? locations.map((location) => {
              const own = location.user_id === userId;
              const member = membersByUser.get(location.user_id);
              const age = Date.now() - new Date(location.updated_at).getTime();
              const stale = age > ACTIVE_LOCATION_MS;
              const alias = own ? 'Du' : member?.profiles?.alias ?? `Användare ${location.user_id.slice(0, 8)}`;
              return (
                <Marker
                  key={`${location.group_id}:${location.user_id}`}
                  coordinate={{ latitude: location.latitude, longitude: location.longitude }}
                  opacity={stale ? 0.42 : 1}
                  pinColor={own ? '#0f8bff' : member?.profiles?.symbol_color ?? '#ef4444'}
                  title={alias}
                  description={`Senast uppdaterad ${formatRelative(location.updated_at)}`}>
                  <Callout>
                    <View style={styles.callout}>
                      <Text style={styles.calloutTitle}>
                        {own ? '📍' : symbolGlyph(member?.profiles?.symbol)} {alias}
                      </Text>
                      <Text>Senast uppdaterad {formatRelative(location.updated_at)}</Text>
                      <Text>Noggrannhet ±{Math.round(location.accuracy || 0)} m</Text>
                    </View>
                  </Callout>
                </Marker>
              );
            })
          : null}
        {approved
          ? locationMessages.map((message) => (
              <Marker
                key={message.id}
                coordinate={{ latitude: message.latitude!, longitude: message.longitude! }}
                pinColor="#111827"
                title={message.text || 'Platsmeddelande'}
                description="Tryck för att öppna i chatten"
                onPress={() => onOpenMessage(message)}
              />
            ))
          : null}
      </MapView>
      <View style={styles.mapOverlay}>
        <Text style={styles.mapTitle}>{activeGroup ? activeGroup.name : 'Ingen grupp vald'}</Text>
        <Text style={styles.mapSubtitle}>{approved ? 'Livekarta för godkända medlemmar' : 'Kartan öppnas efter godkänd grupp'}</Text>
      </View>
    </View>
  );
}

function AuthView({ setNotice }: { setNotice: (text: string) => void }) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    try {
      setBusy(true);
      const credentials = { email: email.trim(), password };
      const result =
        mode === 'signup'
          ? await requireSupabase().auth.signUp(credentials)
          : await requireSupabase().auth.signInWithPassword(credentials);
      if (result.error) throw result.error;
      setNotice(mode === 'signup' ? 'Kontot är skapat. Bekräfta e-post om Supabase kräver det.' : 'Du är inloggad.');
    } catch (error) {
      setNotice(friendlyError(error, mode === 'signup' ? 'Kunde inte skapa konto.' : 'Inloggningen misslyckades.'));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!email.trim()) {
      setNotice('Ange e-post först.');
      return;
    }
    try {
      const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: Linking.createURL('/'),
      });
      if (error) throw error;
      setNotice('Länk för lösenordsåterställning skickad.');
    } catch (error) {
      setNotice(friendlyError(error, 'Kunde inte skicka återställningslänk.'));
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.auth}>
      <Text style={styles.brand}>Fältchatt</Text>
      <Text style={styles.lead}>Logga in eller skapa konto för att dela position, karta och chatt med din grupp.</Text>
      <View style={styles.segment}>
        <SegmentButton active={mode === 'signin'} label="Logga in" onPress={() => setMode('signin')} />
        <SegmentButton active={mode === 'signup'} label="Skapa konto" onPress={() => setMode('signup')} />
      </View>
      <TextInput autoCapitalize="none" keyboardType="email-address" placeholder="E-post" style={styles.input} value={email} onChangeText={setEmail} />
      <TextInput placeholder="Lösenord" secureTextEntry style={styles.input} value={password} onChangeText={setPassword} />
      <Pressable style={[styles.primaryButton, busy && styles.disabled]} disabled={busy} onPress={submit}>
        <Text style={styles.primaryButtonText}>{busy ? 'Vänta...' : mode === 'signup' ? 'Skapa konto' : 'Logga in'}</Text>
      </Pressable>
      <Pressable style={styles.textButton} onPress={resetPassword}>
        <Text style={styles.textButtonText}>Återställ lösenord</Text>
      </Pressable>
    </ScrollView>
  );
}

function GroupView(props: {
  activeGroup: Group | null;
  activeGroupId: string | null;
  approved: boolean;
  busy: boolean;
  canAdmin: boolean;
  canOwn: boolean;
  locationSharingEnabled: boolean;
  members: Member[];
  memberships: Membership[];
  presence: Presence[];
  profile: Profile | null;
  role: string | null | undefined;
  setBusy: (busy: boolean) => void;
  setNotice: (text: string) => void;
  onRefresh: () => Promise<void>;
  onSelectGroup: (groupId: string | null) => Promise<void>;
  onSetSharing: (enabled: boolean) => Promise<void>;
  user: User;
}) {
  const [groupName, setGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  async function createGroup() {
    if (!groupName.trim()) return;
    try {
      props.setBusy(true);
      const { data, error } = await requireSupabase().rpc('create_group_with_owner', { group_name: groupName.trim() });
      if (error) throw error;
      setGroupName('');
      await props.onSelectGroup(data as string);
      props.setNotice('Gruppen skapades. Dela gruppkoden med deltagarna.');
    } catch (error) {
      props.setNotice(friendlyError(error, 'Kunde inte skapa grupp.'));
    } finally {
      props.setBusy(false);
    }
  }

  async function joinGroup() {
    if (!joinCode.trim()) return;
    try {
      props.setBusy(true);
      const { error } = await requireSupabase().rpc('request_group_membership', { requested_join_code: joinCode.trim() });
      if (error) throw error;
      setJoinCode('');
      await props.onRefresh();
      props.setNotice('Medlemsförfrågan skickad. Du är pending tills owner/admin godkänner.');
    } catch (error) {
      props.setNotice(friendlyError(error, 'Kunde inte gå med i gruppen.'));
    } finally {
      props.setBusy(false);
    }
  }

  async function copyInvite() {
    if (!props.activeGroup) return;
    const text = [
      `Du har blivit inbjuden till ${props.activeGroup.name} i Fältchatt.`,
      `Gruppkod: ${props.activeGroup.join_code}`,
      'Ange gruppkoden i Fältchatt för att ansluta till grupp.',
      'Om du inte har ett konto behöver du först skapa ett.',
    ].join('\n');
    await Clipboard.setStringAsync(text);
    props.setNotice('Inbjudningstext kopierad.');
  }

  return (
    <View style={styles.stack}>
      <Section title="Grupp">
        <Text style={styles.muted}>Inloggad som {props.profile?.alias ?? props.user.email}</Text>
        {props.memberships.length ? (
          <View style={styles.chipWrap}>
            {props.memberships.map((membership) => (
              <Pressable
                key={membership.id}
                style={[styles.groupChip, membership.group_id === props.activeGroupId && styles.groupChipActive]}
                onPress={() => props.onSelectGroup(membership.group_id)}>
                <Text style={styles.groupChipTitle}>{membership.groups?.name ?? 'Grupp'}</Text>
                <Text style={styles.groupChipMeta}>{membership.status}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>Välkommen. Skapa en grupp eller ansök med gruppkod.</Text>
        )}
        {props.activeGroup ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>{props.activeGroup.name}</Text>
            <Text>Gruppkod: {props.activeGroup.join_code}</Text>
            <Text>Roll/status: {props.role ?? props.memberships.find((item) => item.group_id === props.activeGroupId)?.status}</Text>
            <Text>Raderas automatiskt: {formatDateTime(props.activeGroup.expires_at)}</Text>
            {!props.approved ? <Text style={styles.warning}>Du väntar på godkännande innan karta och chatt öppnas.</Text> : null}
            <Pressable style={styles.secondaryButton} onPress={copyInvite}>
              <Text style={styles.secondaryButtonText}>Kopiera inbjudan</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Visa och dela min position</Text>
          <Pressable
            style={[styles.toggle, props.locationSharingEnabled && styles.toggleOn]}
            onPress={() => props.onSetSharing(!props.locationSharingEnabled)}>
            <Text style={styles.toggleText}>{props.locationSharingEnabled ? 'På' : 'Av'}</Text>
          </Pressable>
        </View>
        <Text style={styles.muted}>Appen använder bara foreground-position. När delning är på frågar Expo Go om platsbehörighet.</Text>
      </Section>

      <Section title="Gå med i grupp">
        <TextInput autoCapitalize="none" placeholder="Gruppkod, t.ex. vild-snäll-murkla" style={styles.input} value={joinCode} onChangeText={setJoinCode} />
        <Pressable style={[styles.secondaryButton, props.busy && styles.disabled]} disabled={props.busy} onPress={joinGroup}>
          <Text style={styles.secondaryButtonText}>Ansök</Text>
        </Pressable>
      </Section>

      <Section title="Skapa grupp">
        <TextInput placeholder="Gruppnamn" style={styles.input} value={groupName} onChangeText={setGroupName} />
        <Pressable style={[styles.primaryButton, props.busy && styles.disabled]} disabled={props.busy} onPress={createGroup}>
          <Text style={styles.primaryButtonText}>Skapa grupp</Text>
        </Pressable>
        <Text style={styles.muted}>Grupper raderas automatiskt efter 7 dagar. Max 30 personer per grupp och max 30 pågående grupper totalt.</Text>
      </Section>

      <MemberList {...props} />
    </View>
  );
}

function MemberList({
  approved,
  canAdmin,
  canOwn,
  members,
  presence,
  setBusy,
  setNotice,
  onRefresh,
  user,
}: {
  approved: boolean;
  canAdmin: boolean;
  canOwn: boolean;
  members: Member[];
  presence: Presence[];
  setBusy: (busy: boolean) => void;
  setNotice: (text: string) => void;
  onRefresh: () => Promise<void>;
  user: User;
}) {
  if (!approved) return null;
  async function updateMember(member: Member, patch: Partial<Member>) {
    try {
      setBusy(true);
      const { error } = await requireSupabase().from('group_members').update(patch).eq('id', member.id);
      if (error) throw error;
      await onRefresh();
    } catch (error) {
      setNotice(friendlyError(error, 'Kunde inte uppdatera medlem.'));
    } finally {
      setBusy(false);
    }
  }
  async function removeMember(member: Member) {
    try {
      setBusy(true);
      const request =
        member.user_id === user.id
          ? requireSupabase().rpc('leave_group', { target_group_id: member.group_id })
          : requireSupabase().from('group_members').delete().eq('id', member.id);
      const { error } = await request;
      if (error) throw error;
      await onRefresh();
      setNotice(member.user_id === user.id ? 'Du gick ur gruppen.' : 'Medlemmen togs bort.');
    } catch (error) {
      setNotice(friendlyError(error, 'Kunde inte ta bort medlemskapet.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section title="Medlemmar">
      {members
        .slice()
        .sort(compareMembers)
        .map((member) => {
          const activePresence = presence.find((row) => row.user_id === member.user_id && Date.now() - new Date(row.last_seen).getTime() <= ACTIVE_PRESENCE_MS);
          const name = member.profiles?.alias ?? `Användare ${member.user_id.slice(0, 8)}`;
          return (
            <View key={member.id} style={styles.memberRow}>
              <Text style={[styles.symbol, { color: member.profiles?.symbol_color ?? '#111827' }]}>{symbolGlyph(member.profiles?.symbol)}</Text>
              <View style={styles.memberMain}>
                <Text style={styles.memberName}>{name}{member.user_id === user.id ? ' (du)' : ''}</Text>
                <Text style={styles.muted}>
                  {member.role} · {member.status}
                  {activePresence ? ` · aktiv · delar position ${activePresence.is_sharing_location ? 'ja' : 'nej'}` : ''}
                </Text>
              </View>
              {canAdmin && member.status === 'pending' ? (
                <View style={styles.memberActions}>
                  <SmallButton label="OK" onPress={() => updateMember(member, { status: 'approved', approved_at: new Date().toISOString() } as Partial<Member>)} />
                  <SmallButton label="Avvisa" onPress={() => updateMember(member, { status: 'rejected' })} />
                </View>
              ) : null}
              {canOwn && member.status === 'approved' && member.role !== 'owner' ? (
                <View style={styles.memberActions}>
                  <SmallButton label={member.role === 'admin' ? 'member' : 'admin'} onPress={() => updateMember(member, { role: member.role === 'admin' ? 'member' : 'admin' })} />
                  <SmallButton label="Ta bort" danger onPress={() => confirmAction('Ta bort medlem?', name, () => removeMember(member))} />
                </View>
              ) : null}
              {member.user_id === user.id ? <SmallButton label="Gå ur" danger onPress={() => confirmAction('Gå ur gruppen?', '', () => removeMember(member))} /> : null}
            </View>
          );
        })}
    </Section>
  );
}

function ChatView({
  activeGroup,
  approved,
  answers,
  busy,
  membersByUser,
  messages,
  onRefresh,
  onShowOnMap,
  ownLocation,
  questions,
  setBusy,
  setNotice,
  user,
}: {
  activeGroup: Group | null;
  approved: boolean;
  answers: QuestionAnswer[];
  busy: boolean;
  membersByUser: Map<string, Member>;
  messages: Message[];
  onRefresh: () => Promise<void>;
  onShowOnMap: (latitude: number, longitude: number, text?: string) => void;
  ownLocation: LocationRow | null;
  questions: Map<string, Question>;
  setBusy: (busy: boolean) => void;
  setNotice: (text: string) => void;
  user: User;
}) {
  const [text, setText] = useState('');
  const [pollMode, setPollMode] = useState(false);
  const [options, setOptions] = useState('');

  if (!activeGroup) return <EmptyState text="Välj grupp för att se chatt." />;
  if (!approved) return <EmptyState text="Chatten öppnas när medlemskapet är godkänt." />;
  const group = activeGroup;

  async function send() {
    try {
      if (!text.trim()) return;
      setBusy(true);
      if (pollMode) {
        const labels = options.split(',').map((item) => item.trim()).filter(Boolean);
        if (labels.length < 2) {
          setNotice('En fråga behöver minst två svarsalternativ.');
          return;
        }
        const { error } = await requireSupabase().rpc('create_question_message', {
          target_group_id: group.id,
          question_text: text.trim(),
          option_labels: labels,
        });
        if (error) throw error;
      } else {
        const { error } = await requireSupabase().from('messages').insert({
          group_id: group.id,
          user_id: user.id,
          type: 'text',
          text: text.trim(),
        });
        if (error) throw error;
      }
      setText('');
      setOptions('');
      await onRefresh();
    } catch (error) {
      setNotice(friendlyError(error, 'Kunde inte skicka.'));
    } finally {
      setBusy(false);
    }
  }

  async function sendLocationMessage() {
    if (!ownLocation) {
      setNotice('Ingen aktuell egen position finns ännu.');
      return;
    }
    try {
      setBusy(true);
      const { error } = await requireSupabase().from('messages').insert({
        group_id: group.id,
        user_id: user.id,
        type: 'location',
        text: text.trim() || 'Ses här om 20 min',
        latitude: ownLocation.latitude,
        longitude: ownLocation.longitude,
      });
      if (error) throw error;
      setText('');
      await onRefresh();
    } catch (error) {
      setNotice(friendlyError(error, 'Kunde inte skicka platsmeddelande.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.stack}>
      <Section title={`Chatt · ${group.name}`}>
        {messages.map((message) => {
          if (message.type === 'question') {
            return (
              <QuestionMessage
                key={message.id}
                answers={answers}
                membersByUser={membersByUser}
                message={message}
                onRefresh={onRefresh}
                question={questions.get(message.id)}
                setNotice={setNotice}
                user={user}
              />
            );
          }
          const member = membersByUser.get(message.user_id);
          const own = message.user_id === user.id;
          return (
            <View key={message.id} style={[styles.message, own && styles.messageOwn]}>
              <Text style={styles.messageMeta}>
                {symbolGlyph(member?.profiles?.symbol)} {member?.profiles?.alias ?? 'Okänd'} · {formatRelative(message.created_at)}
              </Text>
              <Text style={styles.messageText}>{message.type === 'location' ? `Plats: ${message.text || 'Plats'}` : message.text}</Text>
              {message.type === 'location' && message.latitude && message.longitude ? (
                <Pressable style={styles.textButton} onPress={() => onShowOnMap(message.latitude!, message.longitude!, message.text)}>
                  <Text style={styles.textButtonText}>Visa på kartan</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </Section>
      <Section title={pollMode ? 'Ny fråga' : 'Nytt meddelande'}>
        <View style={styles.segment}>
          <SegmentButton active={!pollMode} label="Text" onPress={() => setPollMode(false)} />
          <SegmentButton active={pollMode} label="Fråga" onPress={() => setPollMode(true)} />
        </View>
        <TextInput multiline placeholder={pollMode ? 'Frågetext, t.ex. Fika?' : 'Skriv meddelande'} style={[styles.input, styles.textArea]} value={text} onChangeText={setText} />
        {pollMode ? <TextInput placeholder="Alternativ separerade med kommatecken" style={styles.input} value={options} onChangeText={setOptions} /> : null}
        <Pressable style={[styles.primaryButton, busy && styles.disabled]} disabled={busy} onPress={send}>
          <Text style={styles.primaryButtonText}>Skicka</Text>
        </Pressable>
        {!pollMode ? (
          <Pressable style={[styles.secondaryButton, busy && styles.disabled]} disabled={busy} onPress={sendLocationMessage}>
            <Text style={styles.secondaryButtonText}>Skicka min position</Text>
          </Pressable>
        ) : null}
      </Section>
    </View>
  );
}

function QuestionMessage({
  answers,
  membersByUser,
  message,
  onRefresh,
  question,
  setNotice,
  user,
}: {
  answers: QuestionAnswer[];
  membersByUser: Map<string, Member>;
  message: Message;
  onRefresh: () => Promise<void>;
  question?: Question;
  setNotice: (text: string) => void;
  user: User;
}) {
  if (!question) return null;
  const currentQuestion = question;
  const member = membersByUser.get(message.user_id);
  const questionAnswers = answers.filter((answer) => answer.question_id === currentQuestion.id);
  const answered = new Set(questionAnswers.map((answer) => answer.user_id));
  async function answer(optionId: string) {
    try {
      const { error } = await requireSupabase().from('question_answers').upsert(
        {
          question_id: currentQuestion.id,
          group_id: currentQuestion.group_id,
          option_id: optionId,
          user_id: user.id,
        },
        { onConflict: 'question_id,user_id' },
      );
      if (error) throw error;
      await onRefresh();
    } catch (error) {
      setNotice(friendlyError(error, 'Kunde inte spara svaret.'));
    }
  }
  return (
    <View style={styles.question}>
      <Text style={styles.messageMeta}>
        {symbolGlyph(member?.profiles?.symbol)} {member?.profiles?.alias ?? 'Okänd'} · {formatRelative(message.created_at)}
      </Text>
      <Text style={styles.questionTitle}>{currentQuestion.question_text}</Text>
      {(currentQuestion.question_options ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((option) => {
          const count = questionAnswers.filter((row) => row.option_id === option.id).length;
          const selected = questionAnswers.some((row) => row.user_id === user.id && row.option_id === option.id);
          return (
            <Pressable key={option.id} style={[styles.option, selected && styles.optionSelected]} onPress={() => answer(option.id)}>
              <Text style={styles.optionText}>{option.label}</Text>
              <Text style={styles.optionCount}>{count}</Text>
            </Pressable>
          );
        })}
      <Text style={styles.muted}>
        Svarat: {questionAnswers.map((answerRow) => answerRow.profiles?.alias ?? membersByUser.get(answerRow.user_id)?.profiles?.alias ?? answerRow.user_id.slice(0, 8)).join(', ') || 'Ingen ännu'}
      </Text>
      <Text style={styles.muted}>
        Ej svarat: {Array.from(membersByUser.values()).filter((memberRow) => memberRow.status === 'approved' && !answered.has(memberRow.user_id)).map((memberRow) => memberRow.profiles?.alias ?? memberRow.user_id.slice(0, 8)).join(', ') || 'Alla har svarat'}
      </Text>
    </View>
  );
}

function ProfileView({
  locationSharingEnabled,
  passwordRecovery,
  profile,
  onRefresh,
  onPasswordRecoveryDone,
  onSetSharing,
  setBusy,
  setNotice,
  user,
}: {
  locationSharingEnabled: boolean;
  passwordRecovery: boolean;
  profile: Profile | null;
  onRefresh: () => Promise<void>;
  onPasswordRecoveryDone: () => void;
  onSetSharing: (enabled: boolean) => Promise<void>;
  setBusy: (busy: boolean) => void;
  setNotice: (text: string) => void;
  user: User;
}) {
  const [alias, setAlias] = useState(profile?.alias ?? '');
  const [symbol, setSymbol] = useState(profile?.symbol ?? SYMBOLS[0].id);
  const [color, setColor] = useState(profile?.symbol_color ?? SYMBOL_COLORS[0]);
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');

  useEffect(() => {
    setAlias(profile?.alias ?? '');
    setSymbol(profile?.symbol ?? SYMBOLS[0].id);
    setColor(profile?.symbol_color ?? SYMBOL_COLORS[0]);
  }, [profile]);

  async function save() {
    try {
      setBusy(true);
      const { error } = await requireSupabase().from('profiles').upsert({
        id: user.id,
        alias: alias.trim() || 'Fältanvändare',
        symbol,
        symbol_color: color,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      await onRefresh();
      setNotice('Profilen sparades.');
    } catch (error) {
      setNotice(friendlyError(error, 'Kunde inte spara profilen.'));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await requireSupabase().auth.signOut();
  }

  async function savePassword() {
    if (newPassword.length < 6) {
      setNotice('Lösenordet måste vara minst 6 tecken.');
      return;
    }
    if (newPassword !== repeatPassword) {
      setNotice('Lösenorden är inte lika.');
      return;
    }
    try {
      setBusy(true);
      const { error } = await requireSupabase().auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setRepeatPassword('');
      onPasswordRecoveryDone();
      setNotice('Lösenordet har ändrats.');
    } catch (error) {
      setNotice(friendlyError(error, 'Kunde inte ändra lösenordet.'));
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    Alert.prompt(
      'Ta bort mitt konto',
      `Skriv din e-postadress för att bekräfta:\n${user.email ?? ''}`,
      async (typedEmail) => {
        if ((typedEmail ?? '').trim().toLowerCase() !== (user.email ?? '').trim().toLowerCase()) {
          setNotice('E-postadressen matchar inte kontot.');
          return;
        }
        try {
          setBusy(true);
          const { error } = await requireSupabase().functions.invoke('delete-my-account', {
            body: { confirmEmail: typedEmail.trim() },
          });
          if (error) throw error;
          await requireSupabase().auth.signOut().catch(() => {});
        } catch (error) {
          setNotice(friendlyError(error, 'Kunde inte ta bort kontot. Kontrollera att Edge Function delete-my-account är deployad.'));
        } finally {
          setBusy(false);
        }
      },
    );
  }

  return (
    <View style={styles.stack}>
      <Section title="Profil">
        {passwordRecovery ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Välj nytt lösenord</Text>
            <TextInput placeholder="Nytt lösenord" secureTextEntry style={styles.input} value={newPassword} onChangeText={setNewPassword} />
            <TextInput placeholder="Upprepa nytt lösenord" secureTextEntry style={styles.input} value={repeatPassword} onChangeText={setRepeatPassword} />
            <Pressable style={styles.primaryButton} onPress={savePassword}>
              <Text style={styles.primaryButtonText}>Spara nytt lösenord</Text>
            </Pressable>
          </View>
        ) : null}
        <TextInput placeholder="Alias" style={styles.input} value={alias} onChangeText={setAlias} />
        <Text style={styles.label}>Symbol</Text>
        <View style={styles.chipWrap}>
          {SYMBOLS.map((item) => (
            <Pressable key={item.id} style={[styles.symbolChoice, symbol === item.id && styles.symbolChoiceActive]} onPress={() => setSymbol(item.id)}>
              <Text style={[styles.symbol, { color }]}>{item.glyph}</Text>
              <Text style={styles.muted}>{symbolLabel(item.id)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Symbolfärg</Text>
        <View style={styles.colorWrap}>
          {SYMBOL_COLORS.map((item) => (
            <Pressable key={item} style={[styles.swatch, { backgroundColor: item }, color === item && styles.swatchActive]} onPress={() => setColor(item)} />
          ))}
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Visa och dela min position</Text>
          <Pressable style={[styles.toggle, locationSharingEnabled && styles.toggleOn]} onPress={() => onSetSharing(!locationSharingEnabled)}>
            <Text style={styles.toggleText}>{locationSharingEnabled ? 'På' : 'Av'}</Text>
          </Pressable>
        </View>
        <Pressable style={styles.primaryButton} onPress={save}>
          <Text style={styles.primaryButtonText}>Spara profil</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={signOut}>
          <Text style={styles.secondaryButtonText}>Logga ut</Text>
        </Pressable>
        <Pressable style={styles.dangerButton} onPress={() => confirmAction('Ta bort kontot permanent?', 'Det går inte att ångra.', deleteAccount)}>
          <Text style={styles.dangerButtonText}>Ta bort mitt konto</Text>
        </Pressable>
      </Section>
      <PrivacySection />
    </View>
  );
}

function AdminView({
  activeGroup,
  canAdmin,
  canOwn,
  members,
  onRefresh,
  onSelectGroup,
  setBusy,
  setNotice,
}: {
  activeGroup: Group | null;
  canAdmin: boolean;
  canOwn: boolean;
  members: Member[];
  onRefresh: () => Promise<void>;
  onSelectGroup: (groupId: string | null) => Promise<void>;
  setBusy: (busy: boolean) => void;
  setNotice: (text: string) => void;
}) {
  if (!activeGroup) return <EmptyState text="Välj grupp för administration." />;
  if (!canAdmin) return <PrivacySection />;
  const group = activeGroup;

  async function ownerRpc(name: string, params: Record<string, string>, success: string, clearGroup = false) {
    try {
      setBusy(true);
      const { error } = await requireSupabase().rpc(name, params);
      if (error) throw error;
      if (clearGroup) await onSelectGroup(null);
      await onRefresh();
      setNotice(success);
    } catch (error) {
      setNotice(friendlyError(error, 'Åtgärden misslyckades.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.stack}>
      <Section title="Administration">
        <Text style={styles.infoTitle}>{group.name}</Text>
        <Text style={styles.muted}>Owner/admin kan godkänna pending-medlemmar. Bara owner kan rensa eller ta bort gruppen.</Text>
        <Pressable style={styles.secondaryButton} onPress={() => Clipboard.setStringAsync(`Gruppkod: ${group.join_code}`)}>
          <Text style={styles.secondaryButtonText}>Kopiera gruppkod</Text>
        </Pressable>
      </Section>
      <Section title="Roller">
        {members.filter((member) => member.status === 'approved').map((member) => (
          <Text key={member.id} style={styles.muted}>
            {member.profiles?.alias ?? member.user_id.slice(0, 8)} · {member.role}
          </Text>
        ))}
      </Section>
      {canOwn ? (
        <Section title="Owner-verktyg">
          <Pressable style={styles.dangerButton} onPress={() => confirmAction('Rensa platsnålar?', 'Platsmeddelanden tas bort permanent.', () => ownerRpc('clear_group_location_messages', { target_group_id: group.id }, 'Platsnålar rensades.'))}>
            <Text style={styles.dangerButtonText}>Rensa platsnålar</Text>
          </Pressable>
          <Pressable style={styles.dangerButton} onPress={() => confirmAction('Rensa chatt?', 'Text, polls, svar och platsnålar tas bort permanent.', () => ownerRpc('clear_group_chat', { target_group_id: group.id }, 'Chatten rensades.'))}>
            <Text style={styles.dangerButtonText}>Rensa chatt</Text>
          </Pressable>
          <Pressable style={styles.dangerButton} onPress={() => confirmAction('Ta bort grupp?', 'Medlemmar, positioner, chatt och polls tas bort.', () => ownerRpc('delete_group', { target_group_id: group.id }, 'Gruppen togs bort.', true))}>
            <Text style={styles.dangerButtonText}>Ta bort grupp</Text>
          </Pressable>
        </Section>
      ) : null}
      <PrivacySection />
    </View>
  );
}

function PrivacySection() {
  return (
    <Section title="Integritet">
      <Text style={styles.paragraph}>Fältchatt är en enkel gruppapp för fältarbete där medlemmar kan dela chatt och position inom vald grupp.</Text>
      <Text style={styles.paragraph}>Appen lagrar alias, vald symbol, symbolfärg, gruppmedlemskap, chatt, polls och platsdata som du själv delar.</Text>
      <Text style={styles.paragraph}>E-post används bara av Supabase Auth för inloggning, bekräftelse, lösenordsåterställning och eventuell kontovarning. Vanliga app-tabeller lagrar inte e-postadresser.</Text>
      <Text style={styles.paragraph}>Positionsdelning styrs i Profil/Grupp och använder bara foreground-position i denna mobilversion.</Text>
      <Text style={styles.paragraph}>Grupper är tillfälliga och raderas automatiskt efter 7 dagar. Max 30 personer kan vara approved eller pending i samma grupp.</Text>
    </Section>
  );
}

function TabBar({
  canAdmin,
  onChange,
  unreadChat,
  unreadGroup,
  value,
}: {
  canAdmin: boolean;
  onChange: (value: ViewKey) => void;
  unreadChat: boolean;
  unreadGroup: boolean;
  value: ViewKey;
}) {
  const tabs: { key: ViewKey; label: string; dot?: boolean; visible?: boolean }[] = [
    { key: 'group', label: 'Grupp', dot: unreadGroup },
    { key: 'chat', label: 'Chatt', dot: unreadChat },
    { key: 'profile', label: 'Profil' },
    { key: 'admin', label: 'Admin', visible: canAdmin },
  ];
  return (
    <View style={styles.tabs}>
      {tabs.filter((tab) => tab.visible !== false).map((tab) => (
        <Pressable key={tab.key} style={[styles.tab, value === tab.key && styles.tabActive]} onPress={() => onChange(tab.key)}>
          <Text style={[styles.tabText, value === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          {tab.dot ? <View style={styles.dot} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SegmentButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.segmentButton, active && styles.segmentButtonActive]} onPress={onPress}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SmallButton({ danger, label, onPress }: { danger?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.smallButton, danger && styles.smallDanger]} onPress={onPress}>
      <Text style={[styles.smallButtonText, danger && styles.smallDangerText]}>{label}</Text>
    </Pressable>
  );
}

function Notice({ onClose, text, tone }: { onClose: () => void; text: string; tone?: 'success' }) {
  return (
    <Pressable style={[styles.notice, tone === 'success' && styles.noticeSuccess]} onPress={onClose}>
      <Text style={styles.noticeText}>{text}</Text>
    </Pressable>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.muted}>{text}</Text>
    </View>
  );
}

function compareMembers(a: Member, b: Member) {
  const roleRank = { owner: 0, admin: 1, member: 2 };
  const statusRank = { approved: 0, pending: 1, rejected: 2 };
  const roleDiff = (roleRank[a.role] ?? 3) - (roleRank[b.role] ?? 3);
  if (roleDiff) return roleDiff;
  const statusDiff = (statusRank[a.status] ?? 3) - (statusRank[b.status] ?? 3);
  if (statusDiff) return statusDiff;
  return (a.profiles?.alias ?? '').localeCompare(b.profiles?.alias ?? '', 'sv');
}

function confirmAction(title: string, message: string, action: () => void | Promise<void>) {
  Alert.alert(title, message, [
    { text: 'Avbryt', style: 'cancel' },
    { text: 'Fortsätt', style: 'destructive', onPress: () => void action() },
  ]);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f6f7f9',
  },
  centerScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: '#f6f7f9',
  },
  auth: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 14,
    padding: 24,
  },
  brand: {
    fontSize: 34,
    fontWeight: '800',
    color: '#14314f',
  },
  lead: {
    fontSize: 16,
    lineHeight: 23,
    color: '#3f4b5f',
  },
  mapWrap: {
    height: 235,
    backgroundColor: '#dde6ef',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  mapTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#112033',
  },
  mapSubtitle: {
    color: '#516070',
    marginTop: 2,
  },
  callout: {
    minWidth: 190,
    gap: 3,
  },
  calloutTitle: {
    fontWeight: '800',
    marginBottom: 2,
  },
  noticeArea: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 6,
  },
  notice: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#fff4d6',
    borderWidth: 1,
    borderColor: '#f2c94c',
  },
  noticeSuccess: {
    backgroundColor: '#e7f8ef',
    borderColor: '#45b36b',
  },
  noticeText: {
    color: '#253044',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#e5e9ef',
  },
  tabActive: {
    backgroundColor: '#14314f',
  },
  tabText: {
    fontWeight: '800',
    color: '#344154',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  dot: {
    position: 'absolute',
    top: 6,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 12,
    paddingBottom: 28,
  },
  stack: {
    gap: 12,
  },
  section: {
    gap: 10,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e7ee',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#15263b',
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#cfd8e3',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    color: '#111827',
  },
  textArea: {
    minHeight: 82,
    textAlignVertical: 'top',
  },
  primaryButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#1565c0',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1565c0',
    backgroundColor: '#eef6ff',
  },
  secondaryButtonText: {
    color: '#124f96',
    fontWeight: '800',
  },
  dangerButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#b42318',
  },
  dangerButtonText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  textButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  textButtonText: {
    color: '#1565c0',
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.55,
  },
  muted: {
    color: '#667085',
    lineHeight: 20,
  },
  warning: {
    color: '#b42318',
    fontWeight: '700',
  },
  label: {
    color: '#253044',
    fontWeight: '700',
  },
  paragraph: {
    color: '#344054',
    lineHeight: 21,
  },
  infoBox: {
    gap: 6,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f2f6fa',
  },
  infoTitle: {
    fontWeight: '800',
    color: '#182536',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  groupChip: {
    minWidth: 128,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#eef1f5',
    borderWidth: 1,
    borderColor: '#d7dee8',
  },
  groupChipActive: {
    borderColor: '#1565c0',
    backgroundColor: '#e4f1ff',
  },
  groupChipTitle: {
    fontWeight: '800',
    color: '#243244',
  },
  groupChipMeta: {
    marginTop: 2,
    color: '#667085',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggle: {
    minWidth: 62,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#d0d5dd',
  },
  toggleOn: {
    backgroundColor: '#34a853',
  },
  toggleText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#edf1f5',
  },
  symbol: {
    fontSize: 22,
  },
  memberMain: {
    flex: 1,
  },
  memberName: {
    fontWeight: '800',
    color: '#1f2937',
  },
  memberActions: {
    gap: 6,
  },
  smallButton: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#e9f2ff',
  },
  smallDanger: {
    backgroundColor: '#ffe8e5',
  },
  smallButtonText: {
    color: '#124f96',
    fontWeight: '800',
    fontSize: 12,
  },
  smallDangerText: {
    color: '#b42318',
  },
  segment: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: '#e5e9ef',
  },
  segmentButtonActive: {
    backgroundColor: '#14314f',
  },
  segmentText: {
    color: '#344154',
    fontWeight: '800',
  },
  segmentTextActive: {
    color: '#ffffff',
  },
  message: {
    gap: 5,
    padding: 11,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    marginBottom: 8,
  },
  messageOwn: {
    backgroundColor: '#e7f0ff',
  },
  messageMeta: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '700',
  },
  messageText: {
    color: '#1f2937',
    lineHeight: 21,
  },
  question: {
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff7e6',
    marginBottom: 8,
  },
  questionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#182536',
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ead7a7',
  },
  optionSelected: {
    borderColor: '#1565c0',
    backgroundColor: '#e9f2ff',
  },
  optionText: {
    color: '#182536',
    fontWeight: '700',
  },
  optionCount: {
    fontWeight: '900',
    color: '#1565c0',
  },
  symbolChoice: {
    width: 86,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#eef1f5',
    borderWidth: 1,
    borderColor: '#d7dee8',
  },
  symbolChoiceActive: {
    borderColor: '#1565c0',
    backgroundColor: '#e4f1ff',
  },
  colorWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  swatchActive: {
    borderColor: '#111827',
  },
  empty: {
    padding: 18,
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
});
