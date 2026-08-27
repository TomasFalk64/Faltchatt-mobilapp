import { Text, View } from 'react-native';

import { MessageComposer } from '@/components/chat/MessageComposer';
import { MessageList } from '@/components/chat/MessageList';
import { Group, LocationRow, Member, Message, Question, QuestionAnswer } from '@/lib/types';
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
  ownLocation,
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
  onShowOnMap: (latitude: number, longitude: number, text?: string) => void;
  ownLocation: LocationRow | null;
  questions: Map<string, Question>;
  setBusy: (busy: boolean) => void;
  setNotice: (text: string) => void;
  userId: string;
}) {
  if (!activeGroup) return <EmptyState text="Välj grupp för att se chatt." />;
  if (!approved) return <EmptyState text="Chatten öppnas när medlemskapet är godkänt." />;

  return (
    <View style={styles.stack}>
      <MessageList
        answers={answers}
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
        ownLocation={ownLocation}
        setBusy={setBusy}
        setNotice={setNotice}
        userId={userId}
      />
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.muted}>{text}</Text>
    </View>
  );
}
