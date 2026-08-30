export type Profile = {
  id: string;
  alias: string;
  symbol: string;
  symbol_color: string;
  updated_at?: string | null;
};

export type Group = {
  id: string;
  name: string;
  owner_id: string;
  join_code: string;
  map_file_path?: string | null;
  map_image_path?: string | null;
  map_image_version?: string | null;
  created_at: string;
  expires_at?: string | null;
};

export type Membership = {
  id: string;
  group_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  approved_at?: string | null;
  groups?: Group | null;
};

export type Member = Omit<Membership, 'groups'> & {
  profiles?: Profile | null;
};

export type Presence = {
  group_id: string;
  user_id: string;
  last_seen: string;
  is_sharing_location: boolean;
};

export type LocationRow = {
  group_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  heading?: number | null;
  speed?: number | null;
  updated_at: string;
};

export type Message = {
  id: string;
  group_id: string;
  user_id: string;
  type: 'text' | 'location' | 'question' | 'system';
  text: string;
  latitude?: number | null;
  longitude?: number | null;
  created_at: string;
};

export type QuestionOption = {
  id: string;
  question_id: string;
  label: string;
  sort_order: number;
};

export type Question = {
  id: string;
  message_id: string;
  group_id: string;
  created_by: string;
  question_text: string;
  created_at: string;
  question_options?: QuestionOption[];
};

export type QuestionAnswer = {
  id: string;
  question_id: string;
  group_id: string;
  option_id: string;
  user_id: string;
  created_at: string;
  question_options?: { label: string } | null;
  profiles?: { alias: string } | null;
};
