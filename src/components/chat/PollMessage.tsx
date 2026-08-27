import { Pressable, Text, View } from 'react-native';

import { FaltSymbol } from '@/components/common/FaltSymbol';
import { formatRelative, friendlyError } from '@/lib/format';
import { Member, Message, Question, QuestionAnswer } from '@/lib/types';
import { answerQuestion } from '@/services/pollService';
import { styles } from '@/styles/faltchattStyles';

export function PollMessage({
  answers,
  membersByUser,
  message,
  onRefresh,
  question,
  setNotice,
  userId,
}: {
  answers: QuestionAnswer[];
  membersByUser: Map<string, Member>;
  message: Message;
  onRefresh: () => Promise<void>;
  question?: Question;
  setNotice: (text: string) => void;
  userId: string;
}) {
  if (!question) return null;
  const member = membersByUser.get(message.user_id);
  const questionAnswers = answers.filter((answer) => answer.question_id === question.id);
  const answered = new Set(questionAnswers.map((answer) => answer.user_id));

  async function saveAnswer(optionId: string) {
    try {
      await answerQuestion(question!.id, question!.group_id, optionId, userId);
      await onRefresh();
    } catch (error) {
      setNotice(friendlyError(error, 'Kunde inte spara svaret.'));
    }
  }

  return (
    <View style={styles.question}>
      <View style={styles.messageMetaRow}>
        <FaltSymbol color={member?.profiles?.symbol_color} size={14} symbol={member?.profiles?.symbol} />
        <Text style={styles.messageMeta}>{member?.profiles?.alias ?? 'Okänd'} · {formatRelative(message.created_at)}</Text>
      </View>
      <Text style={styles.questionTitle}>{question.question_text}</Text>
      {(question.question_options ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((option) => {
          const count = questionAnswers.filter((row) => row.option_id === option.id).length;
          const selected = questionAnswers.some((row) => row.user_id === userId && row.option_id === option.id);
          return (
            <Pressable key={option.id} style={[styles.option, selected && styles.optionSelected]} onPress={() => saveAnswer(option.id)}>
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
