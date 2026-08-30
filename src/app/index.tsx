import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorMessage } from '@/components/common/ErrorMessage';
import { LoadingState } from '@/components/common/LoadingState';
import { StatusBanner } from '@/components/common/StatusBanner';
import { TopBar } from '@/components/common/TopBar';
import { useFaltchattApp } from '@/hooks/useFaltchattApp';
import { ViewKey } from '@/lib/appTypes';
import { friendlyError } from '@/lib/format';
import { isSupabaseConfigured } from '@/lib/supabase';
import { AdminScreen } from '@/screens/AdminScreen';
import { AuthScreen } from '@/screens/AuthScreen';
import { ChatScreen } from '@/screens/ChatScreen';
import { GroupScreen } from '@/screens/GroupScreen';
import { MapScreen } from '@/screens/MapScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { sendLocationMessage } from '@/services/chatService';
import { styles } from '@/styles/faltchattStyles';

export default function FaltchattApp() {
  const { state, actions } = useFaltchattApp();
  const contentRef = useRef<ScrollView>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const hideMapForChatKeyboard = state.view === 'chat' && keyboardVisible;

  async function sendMapLocationMessage(text: string, latitude: number, longitude: number) {
    if (!state.activeGroup || !state.approved || !state.user) return;
    try {
      actions.setBusy(true);
      await sendLocationMessage(state.activeGroup.id, state.user.id, text.trim() || 'Ses här om 20 min', latitude, longitude);
      await actions.refreshAll(state.activeGroupId);
      actions.setNotice('Platsen skickades.');
    } catch (error) {
      actions.setNotice(friendlyError(error, 'Kunde inte skicka platsen.'));
    } finally {
      actions.setBusy(false);
    }
  }

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  if (!isSupabaseConfigured) {
    return <ErrorMessage text="Supabase saknar konfiguration. Lägg EXPO_PUBLIC_SUPABASE_URL och EXPO_PUBLIC_SUPABASE_ANON_KEY i .env.local." />;
  }

  if (state.booting) {
    return <LoadingState />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      {state.user ? (
        <>
          <TopBar
            alias={state.profile?.alias ?? state.user.email ?? 'Profil'}
            groupName={state.activeGroup?.name ?? 'Ingen grupp vald'}
            onOpenProfile={() => actions.setView('profile')}
            setNotice={actions.setNotice}
          />
          {hideMapForChatKeyboard ? null : (
            <View style={styles.mapWithNotice}>
              <MapScreen
                approved={state.approved}
                locations={state.visibleLocations}
                locationMessages={state.locationMessages}
                groupMapOverlay={state.groupMapOverlay}
                mapRef={state.mapRef}
                mapType={state.mapType}
                membersByUser={state.membersByUser}
                mapTarget={state.mapTarget}
                onSendLocationMessage={sendMapLocationMessage}
                ownLocation={state.ownLocation}
                profile={state.profile}
                showGroupMapOverlay={state.showGroupMapOverlay}
                userId={state.user.id}
              />
              {state.notice || state.groupNotice ? (
                <View style={styles.noticeOverlay}>
                  {state.notice ? <StatusBanner text={state.notice} onClose={actions.clearNotice} /> : null}
                  {state.groupNotice ? <StatusBanner text={state.groupNotice} tone="success" onClose={actions.clearGroupNotice} /> : null}
                </View>
              ) : null}
            </View>
          )}
          <TabBar
            unreadChat={state.unreadChat}
            unreadGroup={state.unreadGroup}
            value={state.view}
            onChange={actions.setView}
          />
          {state.view === 'chat' ? (
            <ChatScreen
              activeGroup={state.activeGroup}
              approved={state.approved}
              answers={state.answers}
              busy={state.busy}
              keyboardVisible={keyboardVisible}
              membersByUser={state.membersByUser}
              messages={state.messages}
              onRefresh={() => actions.refreshAll(state.activeGroupId)}
              onShowOnMap={(messageId, latitude, longitude, text) => actions.setMapTarget({ latitude, longitude, messageId, text })}
              questions={state.questions}
              setBusy={actions.setBusy}
              setNotice={actions.setNotice}
              userId={state.user.id}
            />
          ) : (
            <ScrollView ref={contentRef} style={styles.content} contentContainerStyle={styles.contentInner} keyboardShouldPersistTaps="handled">
              {state.view === 'group' ? (
                <GroupScreen
                  activeGroup={state.activeGroup}
                  activeGroupId={state.activeGroupId}
                  approved={state.approved}
                  busy={state.busy}
                  canAdmin={state.canAdmin}
                  canOwn={state.canOwn}
                  members={state.members}
                  memberships={state.memberships}
                  onRefresh={() => actions.refreshAll(state.activeGroupId)}
                  onScrollToTop={() => contentRef.current?.scrollTo({ y: 0, animated: true })}
                  onSelectGroup={actions.selectGroup}
                  presence={state.presence}
                  setBusy={actions.setBusy}
                  setNotice={actions.setNotice}
                  userId={state.user.id}
                />
              ) : null}
              {state.view === 'profile' ? (
                <SettingsScreen
                  locationSharingEnabled={state.locationSharingEnabled}
                  mapType={state.mapType}
                  onPasswordRecoveryDone={actions.setPasswordRecoveryDone}
                  onRefresh={() => actions.refreshAll(state.activeGroupId)}
                  onSetMapType={actions.setMapType}
                  onSetSharing={actions.setLocationSharingEnabled}
                  onSetShowGroupMapOverlay={actions.setShowGroupMapOverlay}
                  passwordRecovery={state.passwordRecovery}
                  profile={state.profile}
                  setBusy={actions.setBusy}
                  setNotice={actions.setNotice}
                  showGroupMapOverlay={state.showGroupMapOverlay}
                  userEmail={state.user.email}
                  userId={state.user.id}
                />
              ) : null}
              {state.view === 'admin' ? (
                <AdminScreen
                  activeGroup={state.activeGroup}
                  canAdmin={state.canAdmin}
                  canOwn={state.canOwn}
                  members={state.members}
                  onRefresh={() => actions.refreshAll(state.activeGroupId)}
                  onSelectGroup={actions.selectGroup}
                  setBusy={actions.setBusy}
                  setNotice={actions.setNotice}
                />
              ) : null}
            </ScrollView>
          )}
        </>
      ) : (
        <AuthScreen setNotice={actions.setNotice} />
      )}
    </SafeAreaView>
  );
}

function TabBar({
  onChange,
  unreadChat,
  unreadGroup,
  value,
}: {
  onChange: (value: ViewKey) => void;
  unreadChat: boolean;
  unreadGroup: boolean;
  value: ViewKey;
}) {
  const tabs: { key: ViewKey; label: string; dot?: boolean; visible?: boolean }[] = [
    { key: 'group', label: 'Grupp', dot: unreadGroup },
    { key: 'chat', label: 'Chatt', dot: unreadChat },
    { key: 'profile', label: 'Profil' },
    { key: 'admin', label: 'Adm', visible: true },
  ];

  return (
    <View style={styles.tabs}>
      {tabs.filter((tab) => tab.visible !== false).map((tab, index, visibleTabs) => (
        <Pressable
          key={tab.key}
          style={[
            styles.tab,
            index === 0 && styles.tabFirst,
            index > 0 && index < visibleTabs.length - 1 && styles.tabMiddle,
            index === visibleTabs.length - 1 && styles.tabLast,
            value === tab.key && styles.tabActive,
          ]}
          onPress={() => onChange(tab.key)}>
          <Text style={[styles.tabText, value === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          {tab.dot ? <View style={styles.dot} /> : null}
        </Pressable>
      ))}
    </View>
  );
}
