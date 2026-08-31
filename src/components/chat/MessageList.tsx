import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, GestureResponderEvent, Keyboard, Pressable, Text, View } from 'react-native';

import { PollMessage } from '@/components/chat/PollMessage';
import { FaltSymbol } from '@/components/common/FaltSymbol';
import { chatSymbolSize } from '@/lib/symbolSizing';
import { Member, Message, Question, QuestionAnswer } from '@/lib/types';
import { styles } from '@/styles/faltchattStyles';

export function MessageList({
  answers,
  bottomPadding,
  membersByUser,
  messages,
  onRefresh,
  onShowOnMap,
  questions,
  setNotice,
  userId,
}: {
  answers: QuestionAnswer[];
  bottomPadding: number;
  membersByUser: Map<string, Member>;
  messages: Message[];
  onRefresh: () => Promise<void>;
  onShowOnMap: (messageId: string, latitude: number, longitude: number, text?: string) => void;
  questions: Map<string, Question>;
  setNotice: (text: string) => void;
  userId: string;
}) {
  const listRef = useRef<FlatList<Message>>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [metaMessageId, setMetaMessageId] = useState<string | null>(null);
  const safeBottomPadding = Math.max(bottomPadding, 74);
  const displayedMessages = useMemo(() => messages.slice().reverse(), [messages]);
  const metaMessage = metaMessageId ? messages.find((message) => message.id === metaMessageId) ?? null : null;
  const metaMember = metaMessage ? membersByUser.get(metaMessage.user_id) : undefined;
  const metaText = metaMessage ? `${metaMember?.profiles?.alias ?? 'Okänd'} ${formatClock(metaMessage.created_at)}` : null;
  const metaWidth = metaText ? metaPopupWidth(metaText) : 0;

  useEffect(() => {
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
    const timeout = setTimeout(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }), 120);

    return () => clearTimeout(timeout);
  }, [messages.length]);

  function toggleMeta(messageId: string) {
    setMetaMessageId((value) => (value === messageId ? null : messageId));
  }

  function handleTouchStart(event: GestureResponderEvent) {
    const { pageX, pageY } = event.nativeEvent;
    touchStart.current = { x: pageX, y: pageY };
  }

  function handleTouchEnd(event: GestureResponderEvent) {
    if (!touchStart.current) return;
    const { pageX, pageY } = event.nativeEvent;
    const movedX = Math.abs(pageX - touchStart.current.x);
    const movedY = Math.abs(pageY - touchStart.current.y);
    touchStart.current = null;

    if (movedX < 8 && movedY < 8) {
      Keyboard.dismiss();
    }
  }

  function renderMessage({ item: message }: { item: Message }) {
    const member = membersByUser.get(message.user_id);
    const own = message.user_id === userId;

    if (message.type === 'question') {
      return (
        <PollMessage
          answers={answers}
          membersByUser={membersByUser}
          message={message}
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
    <View style={styles.chatListWrap}>
      <FlatList
        ref={listRef}
        data={displayedMessages}
        inverted
        keyExtractor={(message) => message.id}
        keyboardDismissMode="none"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={<View style={{ height: safeBottomPadding + 12 }} />}
        renderItem={renderMessage}
        style={styles.chatList}
        contentContainerStyle={styles.chatListContent}
        onTouchEnd={handleTouchEnd}
        onTouchStart={handleTouchStart}
        onLayout={() => {
          requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }));
          setTimeout(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }), 120);
        }}
      />
      {metaText ? (
        <Pressable style={[styles.chatMetaOverlay, { width: metaWidth }]} onPress={() => setMetaMessageId(null)}>
          <Text style={styles.chatMetaPopupText} numberOfLines={1}>{metaText}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function formatClock(value: string) {
  return new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function metaPopupWidth(text: string) {
  return Math.min(260, Math.max(84, text.length * 7 + 18));
}
