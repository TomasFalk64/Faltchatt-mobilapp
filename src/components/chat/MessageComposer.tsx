import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Keyboard, Pressable, Text, TextInput, View } from 'react-native';

import { friendlyError } from '@/lib/format';
import { sendTextMessage } from '@/services/chatService';
import { createQuestion } from '@/services/pollService';
import { styles } from '@/styles/faltchattStyles';

export function MessageComposer({
  busy,
  groupId,
  onRefresh,
  setBusy,
  setNotice,
  userId,
}: {
  busy: boolean;
  groupId: string;
  onRefresh: () => Promise<void>;
  setBusy: (busy: boolean) => void;
  setNotice: (text: string) => void;
  userId: string;
}) {
  const [text, setText] = useState('');
  const [pollMode, setPollMode] = useState(false);
  const [options, setOptions] = useState('');

  async function send() {
    try {
      if (!text.trim()) return;
      setBusy(true);
      if (pollMode) {
        const labels = options.split(',').map((item) => item.trim()).filter(Boolean);
        if (labels.length < 2) {
          setNotice('En fråga behöver minst två svarsalternativ.');
          return;
        }
        await createQuestion(groupId, text.trim(), labels);
      } else {
        await sendTextMessage(groupId, userId, text.trim());
      }
      setText('');
      setOptions('');
      await onRefresh();
    } catch (error) {
      setNotice(friendlyError(error, 'Kunde inte skicka.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.chatComposer}>
      <Pressable style={styles.composerModeButton} onPress={() => setPollMode((value) => !value)}>
        <Text style={styles.composerModeText}>{pollMode ? 'Fråga' : 'Text'}</Text>
      </Pressable>
      <View style={styles.composerFields}>
        <TextInput
          blurOnSubmit
          multiline
          numberOfLines={pollMode ? 1 : 2}
          placeholder={pollMode ? 'Frågetext, t.ex. fika?' : 'Skriv meddelande'}
          placeholderTextColor="#8b95a1"
          returnKeyType="done"
          style={[styles.input, styles.composerInput, pollMode && styles.composerQuestionInput]}
          value={text}
          onChangeText={setText}
          onSubmitEditing={Keyboard.dismiss}
        />
        {pollMode ? (
          <TextInput
            blurOnSubmit
            placeholder="Alternativ, t.ex. kaffe, te, saft"
            placeholderTextColor="#8b95a1"
            returnKeyType="done"
            style={[styles.input, styles.composerInput, styles.composerQuestionInput]}
            value={options}
            onChangeText={setOptions}
            onSubmitEditing={Keyboard.dismiss}
          />
        ) : null}
      </View>
      <Pressable style={[styles.composerIconButton, busy && styles.disabled]} disabled={busy} onPress={send}>
        <MaterialCommunityIcons color="#ffffff" name="send" size={22} />
      </Pressable>
    </View>
  );
}
