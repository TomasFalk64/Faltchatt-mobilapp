import { requireSupabase } from '@/lib/supabase';
import { Message, Question, QuestionAnswer } from '@/lib/types';

export async function loadChatData(groupId: string | null, approved: boolean) {
  if (!groupId || !approved) {
    return { messages: [] as Message[], questions: new Map<string, Question>(), answers: [] as QuestionAnswer[] };
  }
  const client = requireSupabase();
  const [{ data: messageData, error: messageError }, { data: questionData, error: questionError }, { data: answerData, error: answerError }] =
    await Promise.all([
      client.from('messages').select('*').eq('group_id', groupId).order('created_at', { ascending: true }).limit(150),
      client.from('questions').select('*, question_options(*)').eq('group_id', groupId).order('created_at', { ascending: true }),
      client.from('question_answers').select('*, question_options(label), profiles(alias)').eq('group_id', groupId),
    ]);
  if (messageError) throw messageError;
  if (questionError) throw questionError;
  if (answerError) throw answerError;
  const questions = new Map(((questionData ?? []) as Question[]).map((question) => [question.message_id, question]));
  return { messages: (messageData ?? []) as Message[], questions, answers: (answerData ?? []) as QuestionAnswer[] };
}

export async function sendTextMessage(groupId: string, userId: string, text: string) {
  const { error } = await requireSupabase().from('messages').insert({ group_id: groupId, user_id: userId, type: 'text', text });
  if (error) throw error;
}

export async function sendLocationMessage(groupId: string, userId: string, text: string, latitude: number, longitude: number) {
  const { error } = await requireSupabase().from('messages').insert({
    group_id: groupId,
    user_id: userId,
    type: 'location',
    text,
    latitude,
    longitude,
  });
  if (error) throw error;
}
