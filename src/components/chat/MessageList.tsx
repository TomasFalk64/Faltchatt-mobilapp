import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { PollMessage } from '@/components/chat/PollMessage';
import { FaltSymbol } from '@/components/common/FaltSymbol';
import { chatSymbolSize } from '@/lib/symbolSizing';
import { Member, Message, Question, QuestionAnswer } from '@/lib/types';
import { styles } from '@/styles/faltchattStyles';

export function MessageList({
  answers,
  keyboardVisible,
  membersByUser,
  messages,
  onRefresh,
  onShowOnMap,
  questions,
  setNotice,
  userId,
}: {
  answers: QuestionAnswer[];
  keyboardVisible: boolean;
  membersByUser: Map<string, Member>;
  messages: Message[];
  onRefresh: () => Promise<void>;
  onShowOnMap: (messageId: string, latitude: number, longitude: number, text?: string) => void;
  questions: Map<string, Question>;
  setNotice: (text: string) => void;
  userId: string;
}) {
  const listRef = useRef<FlatList<Message>>(null);
  const [metaMessageId, setMetaMessageId] = useState<string | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [keyboardVisible, messages.length]);

  function toggleMeta(messageId: string) {
    setMetaMessageId((value) => (value === messageId ? null : messageId));
  }

  function renderMessage({ item: message }: { item: Message }) {
    const member = membersByUser.get(message.user_id);
    const own = message.user_id === userId;
    const metaVisible = metaMessageId === message.id;
    const metaText = `${member?.profiles?.alias ?? 'Okänd'} ${formatClock(message.created_at)}`;
    const metaWidth = metaPopupWidth(metaText);

    if (message.type === 'question') {
      return (
        <PollMessage
          answers={answers}
          membersByUser={membersByUser}
          message={message}
          metaText={metaText}
          metaWidth={metaWidth}
          metaVisible={metaVisible}
          onRefresh={onRefresh}
          onToggleMeta={() => toggleMeta(message.id)}
          question={questions.get(message.id)}
          setNotice={setNotice}
          userId={userId}
        />
      );
    }

    const text = message.type === 'location' ? `Plats: ${message.text || 'Plats'}` : message.text;

    return (
      <View style={[styles.message, own && styles.messageOwn]}>
        <View style={styles.chatMessageRow}>
          <View style={styles.chatMessageSymbolWrap}>
            <Pressable hitSlop={8} style={styles.chatMessageSymbol} onPress={() => toggleMeta(message.id)}>
              <FaltSymbol color={member?.profiles?.symbol_color} size={chatSymbolSize(member?.profiles?.symbol)} symbol={member?.profiles?.symbol} />
            </Pressable>
            {metaVisible ? (
              <Pressable style={[styles.chatMetaPopup, { width: metaWidth }]} onPress={() => setMetaMessageId(null)}>
                <Text style={styles.chatMetaPopupText} numberOfLines={1}>{metaText}</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.messageText}>{text}</Text>
        </View>
        {message.type === 'location' && message.latitude && message.longitude ? (
          <Pressable style={styles.textButton} onPress={() => onShowOnMap(message.id, message.latitude!, message.longitude!, message.text)}>
            <Text style={styles.textButtonText}>Visa på kartan</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={messages}
      keyExtractor={(message) => message.id}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      renderItem={renderMessage}
      style={styles.chatList}
      contentContainerStyle={styles.chatListContent}
      onContentSizeChange={() => requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))}
      onLayout={() => requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }))}
    />
  );
}

function formatClock(value: string) {
  return new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function metaPopupWidth(text: string) {
  return Math.min(260, Math.max(84, text.length * 7 + 18));
}
