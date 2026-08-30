import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapView from 'react-native-maps';

import {
  HIDDEN_LOCATION_MS,
  MAX_SEND_INTERVAL_MS,
  MIN_SEND_DISTANCE_METERS,
  MIN_SEND_INTERVAL_MS,
} from '@/constants/faltchatt';
import { FaltchattActions, FaltchattState, ViewKey } from '@/lib/appTypes';
import { distanceMeters, friendlyError, groupExpired, isJwtIssuedAtFutureError } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { LocationRow, Member, Membership, Message, Presence, Profile, Question, QuestionAnswer } from '@/lib/types';
import { ensureProfile, getInitialSession, onAuthStateChange, setRecoverySession, touchAccountActivity } from '@/services/authService';
import { loadChatData } from '@/services/chatService';
import { loadMembers, loadMemberships } from '@/services/groupService';
import { deleteOwnLocations, loadLocations, loadPresence, touchPresence, upsertLocation } from '@/services/locationService';

const ACTIVE_GROUP_KEY = 'faltchatt.activeGroupId';
const SHARE_LOCATION_KEY = 'faltchatt.locationSharingEnabled';

export function useFaltchattApp(): { state: FaltchattState; actions: FaltchattActions } {
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNoticeState] = useState('');
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
  const [view, setViewState] = useState<ViewKey>('group');
  const [unreadChat, setUnreadChat] = useState(false);
  const [unreadGroup, setUnreadGroup] = useState(false);
  const [groupNotice, setGroupNotice] = useState('');
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [locationSharingEnabled, setLocationSharingEnabledState] = useState(true);
  const [ownLocation, setOwnLocation] = useState<LocationRow | null>(null);
  const [mapTarget, setMapTarget] = useState<{ latitude: number; longitude: number; messageId?: string; text?: string } | null>(null);
  const mapRef = useRef<MapView>(null);
  const previousMemberships = useRef<Map<string, string>>(new Map());
  const activeGroupIdRef = useRef<string | null>(null);
  const locationSharingRef = useRef(true);
  const userRef = useRef<User | null>(null);
  const viewRef = useRef<ViewKey>('group');
  const lastSent = useRef<{ at: number; lat: number | null; lng: number | null }>({ at: 0, lat: null, lng: null });
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  const setNotice = useCallback((text: string) => setNoticeState(text), []);
  const showError = useCallback((error: unknown, fallback: string) => {
    if (!isJwtIssuedAtFutureError(error)) console.error(error);
    setNoticeState(friendlyError(error, fallback));
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = setTimeout(() => setNoticeState(''), 5000);
    return () => clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!groupNotice) return undefined;
    const timeout = setTimeout(() => setGroupNotice(''), 5000);
    return () => clearTimeout(timeout);
  }, [groupNotice]);

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

  const setLocationSharingEnabled = useCallback(
    async (enabled: boolean) => {
      locationSharingRef.current = enabled;
      setLocationSharingEnabledState(enabled);
      await AsyncStorage.setItem(SHARE_LOCATION_KEY, String(enabled));

      if (enabled) return;

      locationSubscription.current?.remove();
      locationSubscription.current = null;
      lastSent.current = { at: 0, lat: null, lng: null };
      setOwnLocation(null);

      const currentUser = userRef.current;
      if (!currentUser) return;

      setLocations((current) => current.filter((row) => row.user_id !== currentUser.id));
      try {
        await deleteOwnLocations(currentUser.id);
        const currentGroupId = activeGroupIdRef.current;
        if (currentGroupId) {
          await touchPresence({
            group_id: currentGroupId,
            user_id: currentUser.id,
            last_seen: new Date().toISOString(),
            is_sharing_location: false,
          });
        }
      } catch (error) {
        showError(error, 'Kunde inte stänga av positionsdelningen helt.');
      }
    },
    [showError],
  );

  const setView = useCallback((nextView: ViewKey) => {
    viewRef.current = nextView;
    setViewState(nextView);
    if (nextView === 'chat') setUnreadChat(false);
    if (nextView === 'group') setUnreadGroup(false);
  }, []);

  const clearUserData = useCallback(() => {
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
  }, [setView]);

  const applyChatData = useCallback((data: Awaited<ReturnType<typeof loadChatData>>) => {
    setMessages(data.messages);
    setQuestions(data.questions);
    setAnswers(data.answers);
  }, []);

  const refreshAll = useCallback(
    async (requestedGroupId?: string | null) => {
      const currentUser = userRef.current;
      if (!currentUser) {
        clearUserData();
        return;
      }

      const currentProfile = await ensureProfile(currentUser);
      setProfile(currentProfile);
      await touchAccountActivity();

      const currentMemberships = await loadMemberships(currentUser.id);
      const approvedMemberships = currentMemberships.filter((membership) => membership.status === 'approved');
      const newlyApproved = currentMemberships.find((membership) => {
        const previous = previousMemberships.current.get(membership.group_id);
        return membership.status === 'approved' && previous && previous !== 'approved';
      });
      previousMemberships.current = new Map(currentMemberships.map((membership) => [membership.group_id, membership.status]));

      if (newlyApproved) {
        const name = newlyApproved.groups?.name ?? `Grupp ${newlyApproved.group_id.slice(0, 8)}`;
        setGroupNotice(`Du är nu med i ${name}.`);
        if (viewRef.current !== 'group') setUnreadGroup(true);
      }

      const explicitGroupChoice = requestedGroupId !== undefined;
      let nextGroupId = explicitGroupChoice ? requestedGroupId : activeGroupIdRef.current;
      if (newlyApproved && !nextGroupId) {
        nextGroupId = newlyApproved.group_id;
      }
      if (!explicitGroupChoice && (!nextGroupId || !approvedMemberships.some((item) => item.group_id === nextGroupId))) {
        nextGroupId = approvedMemberships[0]?.group_id ?? null;
      }
      if (nextGroupId && !approvedMemberships.some((item) => item.group_id === nextGroupId)) {
        nextGroupId = null;
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
        applyChatData(await loadChatData(null, false));
        return;
      }

      const [memberData, presenceData, locationData, chatData] = await Promise.all([
        loadMembers(nextGroupId),
        loadPresence(nextGroupId),
        loadLocations(nextGroupId),
        loadChatData(nextGroupId, true),
      ]);
      setMembers(memberData);
      setPresence(presenceData);
      setLocations(locationData);
      applyChatData(chatData);
    },
    [applyChatData, clearUserData],
  );

  const selectGroup = useCallback(
    async (groupId: string | null) => {
      await setActiveGroupId(groupId);
      await refreshAll(groupId);
    },
    [refreshAll, setActiveGroupId],
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
    viewRef.current = view;
  }, [view]);

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
        const { data, error } = await setRecoverySession(accessToken, refreshToken);
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
      const { data, error } = await getInitialSession();
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
    const subscription = onAuthStateChange((event, nextSession) => {
      const previousUserId = userRef.current?.id ?? null;
      const nextUserId = nextSession?.user?.id ?? null;
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      userRef.current = nextSession?.user ?? null;
      if (event === 'SIGNED_IN' && nextUserId && nextUserId !== previousUserId) {
        setView('group');
      }
      refreshAll(activeGroupIdRef.current).catch((error) => showError(error, 'Kunde inte ladda kontot.'));
    });
    return () => {
      mounted = false;
      linkSubscription.remove();
      subscription.data.subscription.unsubscribe();
    };
  }, [refreshAll, setView, showError]);

  useEffect(() => {
    if (!booting) refreshAll(activeGroupIdRef.current).catch((error) => showError(error, 'Kunde inte ladda Fältchatt.'));
  }, [booting, refreshAll, showError, session]);

  useEffect(() => {
    if (!supabase || !user) return;
    const client = supabase;
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
    const client = supabase;
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
        if (payload.eventType !== 'DELETE' && row?.user_id !== user.id && viewRef.current !== 'chat') setUnreadChat(true);
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
  }, [activeGroupId, approved, refreshAll, showError, user]);

  useEffect(() => {
    if (!activeGroupId || !approved || !user) return;
    const touch = () => {
      touchPresence({
        group_id: activeGroupId,
        user_id: user.id,
        last_seen: new Date().toISOString(),
        is_sharing_location: locationSharingRef.current,
      }).catch(() => {});
    };
    touch();
    const timer = setInterval(touch, 30000);
    return () => clearInterval(timer);
  }, [activeGroupId, approved, user]);

  useEffect(() => {
    async function startLocation() {
      if (!user || !locationSharingEnabled) {
        locationSubscription.current?.remove();
        locationSubscription.current = null;
        return;
      }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        await setLocationSharingEnabled(false);
        setNoticeState('Platsbehörighet saknas. Aktivera position i telefonens appinställningar och slå på delning igen.');
        return;
      }
      locationSubscription.current?.remove();
      locationSubscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 5 },
        async (position) => {
          if (!locationSharingRef.current) return;
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
          const canShareToGroup = Boolean(activeGroupId && approved);
          const row = {
            group_id: activeGroupId ?? '__own_position__',
            user_id: user.id,
            latitude,
            longitude,
            accuracy: accuracy ?? 0,
            heading: Number.isFinite(heading) ? heading : null,
            speed: Number.isFinite(speed) ? speed : null,
            updated_at: new Date().toISOString(),
          };
          setOwnLocation(row);
          if (!canShareToGroup) return;
          if (!shouldSend) return;
          lastSent.current = { at: Date.now(), lat: latitude, lng: longitude };
          upsertLocation(row).catch((error) => showError(error, 'Kunde inte dela positionen.'));
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
    const rows = user?.id && ownLocation ? locations.filter((row) => row.user_id !== user.id) : [...locations];
    if (ownLocation) rows.push(ownLocation);
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

  const state: FaltchattState = {
    activeGroup,
    activeGroupId,
    answers,
    approved,
    booting,
    busy,
    canAdmin,
    canOwn,
    groupNotice,
    locationMessages,
    locationSharingEnabled,
    locations,
    mapRef,
    mapTarget,
    members,
    membersByUser,
    memberships,
    messages,
    notice,
    ownLocation,
    passwordRecovery,
    presence,
    profile,
    questions,
    role,
    unreadChat,
    unreadGroup,
    user,
    view,
    visibleLocations,
  };

  const actions: FaltchattActions = {
    clearGroupNotice: () => setGroupNotice(''),
    clearNotice: () => setNoticeState(''),
    refreshAll,
    selectGroup,
    setBusy,
    setLocationSharingEnabled,
    setMapTarget,
    setNotice,
    setPasswordRecoveryDone: () => setPasswordRecovery(false),
    setView,
  };

  return { state, actions };
}
