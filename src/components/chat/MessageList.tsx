import { Pressable, Text, View } from 'react-native';

import { PollMessage } from '@/components/chat/PollMessage';
import { Section } from '@/components/common/Section';
import { symbolGlyph } from '@/constants/faltchatt';
import { formatRelative } from '@/lib/format';
import { Member, Message, Question, QuestionAnswer } from '@/lib/types';
import { styles } from '@/styles/faltchattStyles';

export function MessageList({
  answers,
  groupName,
  membersByUser,
  messages,
  onRefresh,
  onShowOnMap,
  questions,
  setNotice,
  userId,
}: {
  answers: QuestionAnswer[];
  groupName: string;
  membersByUser: Map<string, Member>;
  messages: Message[];
  onRefresh: () => Promise<void>;
  onShowOnMap: (latitude: number, longitude: number, text?: string) => void;
  questions: Map<string, Question>;
  setNotice: (text: string) => void;
  userId: string;
}) {
  return (
    <Section title={`Chatt · ${groupName}`}>
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
  );
}
