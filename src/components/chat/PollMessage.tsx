import { Pressable, Text, View } from 'react-native';

import { FaltSymbol } from '@/components/common/FaltSymbol';
import { friendlyError } from '@/lib/format';
import { chatSymbolSize } from '@/lib/symbolSizing';
import { Member, Message, Question, QuestionAnswer } from '@/lib/types';
import { answerQuestion } from '@/services/pollService';
import { styles } from '@/styles/faltchattStyles';

export function PollMessage({
  answers,
  membersByUser,
  message,
  metaText,
  metaWidth,
  metaVisible,
  onRefresh,
  onToggleMeta,
  question,
  setNotice,
  userId,
}: {
  answers: QuestionAnswer[];
  membersByUser: Map<string, Member>;
  message: Message;
  metaText: string;
  metaWidth: number;
  metaVisible: boolean;
  onRefresh: () => Promise<void>;
  onToggleMeta: () => void;
  question?: Question;
  setNotice: (text: string) => void;
  userId: string;
}) {
  if (!question) return null;
  const member = membersByUser.get(message.user_id);
  const own = message.user_id === userId;
  const questionAnswers = answers.filter((answer) => answer.question_id === question.id);

  async function saveAnswer(optionId: string) {
    try {
      await answerQuestion(question!.id, question!.group_id, optionId, userId);
      await onRefresh();
    } catch (error) {
      setNotice(friendlyError(error, 'Kunde inte spara svaret.'));
    }
  }

  return (
    <View style={[styles.question, own && styles.questionOwn]}>
      <View style={styles.chatMessageRow}>
        <View style={styles.chatMessageSymbolWrap}>
          <Pressable hitSlop={8} style={styles.chatMessageSymbol} onPress={onToggleMeta}>
            <FaltSymbol color={member?.profiles?.symbol_color} size={chatSymbolSize(member?.profiles?.symbol)} symbol={member?.profiles?.symbol} />
          </Pressable>
          {metaVisible ? (
            <Pressable style={[styles.chatMetaPopup, { width: metaWidth }]} onPress={onToggleMeta}>
              <Text style={styles.chatMetaPopupText} numberOfLines={1}>{metaText}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.questionTitle}>{question.question_text}</Text>
      </View>
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
    </View>
  );
}
