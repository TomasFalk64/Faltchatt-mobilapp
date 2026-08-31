import { useEffect, useState } from 'react';
import { Keyboard, LayoutChangeEvent, Platform, Text, View } from 'react-native';

import { MessageComposer } from '@/components/chat/MessageComposer';
import { MessageList } from '@/components/chat/MessageList';
import { Group, Member, Message, Question, QuestionAnswer } from '@/lib/types';
import { styles } from '@/styles/faltchattStyles';

export function ChatScreen({
  activeGroup,
  approved,
  answers,
  busy,
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
  membersByUser: Map<string, Member>;
  messages: Message[];
  onRefresh: () => Promise<void>;
  onShowOnMap: (messageId: string, latitude: number, longitude: number, text?: string) => void;
  questions: Map<string, Question>;
  setBusy: (busy: boolean) => void;
  setNotice: (text: string) => void;
  userId: string;
}) {
  const [composerHeight, setComposerHeight] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  function handleComposerLayout(event: LayoutChangeEvent) {
    setComposerHeight(event.nativeEvent.layout.height);
  }

  if (!activeGroup) return <EmptyState text="Välj grupp för att se chatt." />;
  if (!approved) return <EmptyState text="Chatten öppnas när medlemskapet är godkänt." />;

  return (
    <View style={styles.chatScreen}>
      <MessageList
        answers={answers}
        bottomPadding={composerHeight + keyboardHeight}
        membersByUser={membersByUser}
        messages={messages}
        onRefresh={onRefresh}
        onShowOnMap={onShowOnMap}
        questions={questions}
        setNotice={setNotice}
        userId={userId}
      />
      <View style={[styles.chatComposerOverlay, { bottom: keyboardHeight }]} onLayout={handleComposerLayout}>
        <MessageComposer
          busy={busy}
          groupId={activeGroup.id}
          onRefresh={onRefresh}
          setBusy={setBusy}
          setNotice={setNotice}
          userId={userId}
        />
      </View>
    </View>
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
