import { User } from '@supabase/supabase-js';
import MapView, { MapType } from 'react-native-maps';

import { Group, LocationRow, Member, Membership, Message, Presence, Profile, Question, QuestionAnswer } from '@/lib/types';
import type { GroupMapOverlay } from '@/services/mapService';
import type { MessageSoundId } from '@/services/messageSoundService';

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
  backgroundLocationSharingEnabled: boolean;
  booting: boolean;
  busy: boolean;
  groupNotice: string;
  locationMessages: Message[];
  locationSharingEnabled: boolean;
  locations: LocationRow[];
  mapType: MapType;
  messageSound: MessageSoundId;
  mapRef: React.RefObject<MapView | null>;
  groupMapOverlay: GroupMapOverlay | null;
  showGroupMapOverlay: boolean;
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
  setBackgroundLocationSharingEnabled: (enabled: boolean) => Promise<void>;
  setBusy: (busy: boolean) => void;
  setLocationSharingEnabled: (enabled: boolean) => Promise<void>;
  setMapType: (mapType: MapType) => Promise<void>;
  setMapTarget: (target: { latitude: number; longitude: number; messageId?: string; text?: string } | null) => void;
  setMessageSound: (sound: MessageSoundId) => Promise<void>;
  setNotice: (text: string) => void;
  setPasswordRecoveryDone: () => void;
  setShowGroupMapOverlay: (show: boolean) => Promise<void>;
  setView: (view: ViewKey) => void;
};
