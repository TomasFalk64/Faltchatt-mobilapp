import { User } from '@supabase/supabase-js';
import MapView from 'react-native-maps';

import { Group, LocationRow, Member, Membership, Message, Presence, Profile, Question, QuestionAnswer } from '@/lib/types';

export type ViewKey = 'group' | 'chat' | 'profile' | 'admin';
export type AuthMode = 'signin' | 'signup';

export type GroupContext = {
  activeGroup: Group | null;
  activeGroupId: string | null;
  approved: boolean;
  canAdmin: boolean;
  canOwn: boolean;
  role: string | null | undefined;
};

export type FaltchattState = GroupContext & {
  answers: QuestionAnswer[];
  booting: boolean;
  busy: boolean;
  groupNotice: string;
  locationMessages: Message[];
  locationSharingEnabled: boolean;
  locations: LocationRow[];
  mapRef: React.RefObject<MapView | null>;
  mapTarget: { latitude: number; longitude: number; messageId?: string; text?: string } | null;
  members: Member[];
  membersByUser: Map<string, Member>;
  memberships: Membership[];
  messages: Message[];
  notice: string;
  ownLocation: LocationRow | null;
  passwordRecovery: boolean;
  presence: Presence[];
  profile: Profile | null;
  questions: Map<string, Question>;
  unreadChat: boolean;
  unreadGroup: boolean;
  user: User | null;
  view: ViewKey;
  visibleLocations: LocationRow[];
};

export type FaltchattActions = {
  clearGroupNotice: () => void;
  clearNotice: () => void;
  refreshAll: (requestedGroupId?: string | null) => Promise<void>;
  selectGroup: (groupId: string | null) => Promise<void>;
  setBusy: (busy: boolean) => void;
  setLocationSharingEnabled: (enabled: boolean) => Promise<void>;
  setMapTarget: (target: { latitude: number; longitude: number; messageId?: string; text?: string } | null) => void;
  setNotice: (text: string) => void;
  setPasswordRecoveryDone: () => void;
  setView: (view: ViewKey) => void;
};
