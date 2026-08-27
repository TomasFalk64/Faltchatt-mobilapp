import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { SegmentButton } from '@/components/common/Buttons';
import { Section } from '@/components/common/Section';
import { friendlyError } from '@/lib/format';
import { LocationRow } from '@/lib/types';
import { sendLocationMessage, sendTextMessage } from '@/services/chatService';
import { createQuestion } from '@/services/pollService';
import { styles } from '@/styles/faltchattStyles';

export function MessageComposer({
  busy,
  groupId,
  onRefresh,
  ownLocation,
  setBusy,
  setNotice,
  userId,
}: {
  busy: boolean;
  groupId: string;
  onRefresh: () => Promise<void>;
  ownLocation: LocationRow | null;
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

  async function sendPosition() {
    if (!ownLocation) {
      setNotice('Ingen aktuell egen position finns ännu.');
      return;
    }
    try {
      setBusy(true);
      await sendLocationMessage(groupId, userId, text.trim() || 'Ses här om 20 min', ownLocation.latitude, ownLocation.longitude);
      setText('');
      await onRefresh();
    } catch (error) {
      setNotice(friendlyError(error, 'Kunde inte skicka platsmeddelande.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title={pollMode ? 'Ny fråga' : 'Nytt meddelande'}>
      <View style={styles.segment}>
        <SegmentButton active={!pollMode} label="Text" onPress={() => setPollMode(false)} />
        <SegmentButton active={pollMode} label="Fråga" onPress={() => setPollMode(true)} />
      </View>
      <TextInput multiline placeholder={pollMode ? 'Frågetext, t.ex. Fika?' : 'Skriv meddelande'} style={[styles.input, styles.textArea]} value={text} onChangeText={setText} />
      {pollMode ? <TextInput placeholder="Alternativ separerade med kommatecken" style={styles.input} value={options} onChangeText={setOptions} /> : null}
      <Pressable style={[styles.primaryButton, busy && styles.disabled]} disabled={busy} onPress={send}>
        <Text style={styles.primaryButtonText}>Skicka</Text>
      </Pressable>
      {!pollMode ? (
        <Pressable style={[styles.secondaryButton, busy && styles.disabled]} disabled={busy} onPress={sendPosition}>
          <Text style={styles.secondaryButtonText}>Skicka min position</Text>
        </Pressable>
      ) : null}
    </Section>
  );
}
