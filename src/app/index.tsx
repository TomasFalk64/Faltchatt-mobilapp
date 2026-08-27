import { StatusBar } from 'expo-status-bar';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorMessage } from '@/components/common/ErrorMessage';
import { LoadingState } from '@/components/common/LoadingState';
import { StatusBanner } from '@/components/common/StatusBanner';
import { useFaltchattApp } from '@/hooks/useFaltchattApp';
import { ViewKey } from '@/lib/appTypes';
import { isSupabaseConfigured } from '@/lib/supabase';
import { AdminScreen } from '@/screens/AdminScreen';
import { AuthScreen } from '@/screens/AuthScreen';
import { ChatScreen } from '@/screens/ChatScreen';
import { GroupScreen } from '@/screens/GroupScreen';
import { MapScreen } from '@/screens/MapScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { styles } from '@/styles/faltchattStyles';

export default function FaltchattApp() {
  const { state, actions } = useFaltchattApp();

  if (!isSupabaseConfigured) {
    return <ErrorMessage text="Supabase saknar konfiguration. Lägg EXPO_PUBLIC_SUPABASE_URL och EXPO_PUBLIC_SUPABASE_ANON_KEY i .env.local." />;
  }

  if (state.booting) {
    return <LoadingState />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {state.user ? (
          <>
            <MapScreen
              activeGroup={state.activeGroup}
              approved={state.approved}
              locations={state.visibleLocations}
              locationMessages={state.locationMessages}
              mapRef={state.mapRef}
              membersByUser={state.membersByUser}
              onOpenMessage={(message) => actions.setMapTarget({ latitude: message.latitude!, longitude: message.longitude!, text: message.text })}
              userId={state.user.id}
            />
            <View style={styles.noticeArea}>
              {state.notice ? <StatusBanner text={state.notice} onClose={actions.clearNotice} /> : null}
              {state.groupNotice ? <StatusBanner text={state.groupNotice} tone="success" onClose={actions.clearGroupNotice} /> : null}
            </View>
            <TabBar
              canAdmin={state.canAdmin}
              unreadChat={state.unreadChat}
              unreadGroup={state.unreadGroup}
              value={state.view}
              onChange={actions.setView}
            />
            <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} keyboardShouldPersistTaps="handled">
              {state.view === 'group' ? (
                <GroupScreen
                  activeGroup={state.activeGroup}
                  activeGroupId={state.activeGroupId}
                  approved={state.approved}
                  busy={state.busy}
                  canAdmin={state.canAdmin}
                  canOwn={state.canOwn}
                  locationSharingEnabled={state.locationSharingEnabled}
                  members={state.members}
                  memberships={state.memberships}
                  onRefresh={() => actions.refreshAll(state.activeGroupId)}
                  onSelectGroup={actions.selectGroup}
                  onSetSharing={actions.setLocationSharingEnabled}
                  presence={state.presence}
                  profile={state.profile}
                  role={state.role}
                  setBusy={actions.setBusy}
                  setNotice={actions.setNotice}
                  userEmail={state.user.email}
                  userId={state.user.id}
                />
              ) : null}
              {state.view === 'chat' ? (
                <ChatScreen
                  activeGroup={state.activeGroup}
                  approved={state.approved}
                  answers={state.answers}
                  busy={state.busy}
                  membersByUser={state.membersByUser}
                  messages={state.messages}
                  onRefresh={() => actions.refreshAll(state.activeGroupId)}
                  onShowOnMap={(latitude, longitude, text) => actions.setMapTarget({ latitude, longitude, text })}
                  ownLocation={state.ownLocation}
                  questions={state.questions}
                  setBusy={actions.setBusy}
                  setNotice={actions.setNotice}
                  userId={state.user.id}
                />
              ) : null}
              {state.view === 'profile' ? (
                <SettingsScreen
                  locationSharingEnabled={state.locationSharingEnabled}
                  onPasswordRecoveryDone={actions.setPasswordRecoveryDone}
                  onRefresh={() => actions.refreshAll(state.activeGroupId)}
                  onSetSharing={actions.setLocationSharingEnabled}
                  passwordRecovery={state.passwordRecovery}
                  profile={state.profile}
                  setBusy={actions.setBusy}
                  setNotice={actions.setNotice}
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
          </>
        ) : (
          <AuthScreen setNotice={actions.setNotice} />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
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
