import { Pressable, Text, View } from 'react-native';

import { PollMessage } from '@/components/chat/PollMessage';
import { FaltSymbol } from '@/components/common/FaltSymbol';
import { Section } from '@/components/common/Section';
import { formatRelative } from '@/lib/format';
import { Member, Message, Question, QuestionAnswer } from '@/lib/types';
import { styles } from '@/styles/faltchattStyles';

export function MessageList({
  answers,
  membersByUser,
  messages,
  onRefresh,
  onShowOnMap,
  questions,
  setNotice,
  userId,
}: {
  answers: QuestionAnswer[];
  membersByUser: Map<string, Member>;
  messages: Message[];
  onRefresh: () => Promise<void>;
  onShowOnMap: (latitude: number, longitude: number, text?: string) => void;
  questions: Map<string, Question>;
  setNotice: (text: string) => void;
  userId: string;
}) {
  return (
    <Section>
      {messages.map((message) => {
        if (message.type === 'question') {
          return (
            <PollMessage
              key={message.id}
              answers={answers}
              membersByUser={membersByUser}
              message={message}
              onRefresh={onRefresh}
              question={questions.get(message.id)}
              setNotice={setNotice}
              userId={userId}
            />
          );
        }
        const member = membersByUser.get(message.user_id);
        const own = message.user_id === userId;
        return (
          <View key={message.id} style={[styles.message, own && styles.messageOwn]}>
            <View style={styles.messageMetaRow}>
              <FaltSymbol color={member?.profiles?.symbol_color} size={14} symbol={member?.profiles?.symbol} />
              <Text style={styles.messageMeta}>{member?.profiles?.alias ?? 'Okänd'} · {formatRelative(message.created_at)}</Text>
            </View>
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
  );
}
