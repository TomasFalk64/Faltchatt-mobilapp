import { Keyboard, KeyboardAvoidingView, Platform, Text, TouchableWithoutFeedback, View } from 'react-native';

import { MessageComposer } from '@/components/chat/MessageComposer';
import { MessageList } from '@/components/chat/MessageList';
import { Group, Member, Message, Question, QuestionAnswer } from '@/lib/types';
import { styles } from '@/styles/faltchattStyles';

export function ChatScreen({
  activeGroup,
  approved,
  answers,
  busy,
  keyboardVisible,
  membersByUser,
  messages,
  onRefresh,
  onShowOnMap,
  questions,
  setBusy,
  setNotice,
  userId,
}: {
  activeGroup: Group | null;
  approved: boolean;
  answers: QuestionAnswer[];
  busy: boolean;
  keyboardVisible: boolean;
  membersByUser: Map<string, Member>;
  messages: Message[];
  onRefresh: () => Promise<void>;
  onShowOnMap: (messageId: string, latitude: number, longitude: number, text?: string) => void;
  questions: Map<string, Question>;
  setBusy: (busy: boolean) => void;
  setNotice: (text: string) => void;
  userId: string;
}) {
  if (!activeGroup) return <EmptyState text="Välj grupp för att se chatt." />;
  if (!approved) return <EmptyState text="Chatten öppnas när medlemskapet är godkänt." />;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0} style={styles.chatScreen}>
      <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
        <View style={styles.chatScreen}>
          <MessageList
            answers={answers}
            keyboardVisible={keyboardVisible}
            membersByUser={membersByUser}
            messages={messages}
            onRefresh={onRefresh}
            onShowOnMap={onShowOnMap}
            questions={questions}
            setNotice={setNotice}
            userId={userId}
          />
          <MessageComposer
            busy={busy}
            groupId={activeGroup.id}
            onRefresh={onRefresh}
            setBusy={setBusy}
            setNotice={setNotice}
            userId={userId}
          />
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={[styles.contentInner, styles.content]}>
      <View style={styles.empty}>
        <Text style={styles.muted}>{text}</Text>
      </View>
    </View>
  );
}
