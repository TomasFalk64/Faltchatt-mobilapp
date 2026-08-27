import { requireSupabase } from '@/lib/supabase';

export async function createQuestion(groupId: string, questionText: string, optionLabels: string[]) {
  const { error } = await requireSupabase().rpc('create_question_message', {
    target_group_id: groupId,
    question_text: questionText,
    option_labels: optionLabels,
  });
  if (error) throw error;
}

export async function answerQuestion(questionId: string, groupId: string, optionId: string, userId: string) {
  const { error } = await requireSupabase().from('question_answers').upsert(
    {
      question_id: questionId,
      group_id: groupId,
      option_id: optionId,
      user_id: userId,
    },
    { onConflict: 'question_id,user_id' },
  );
  if (error) throw error;
}
