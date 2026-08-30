import { AudioPlayer, createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio';

export type MessageSoundId = 'none' | 'golgroda' | 'ping' | 'doing';

export const DEFAULT_MESSAGE_SOUND: MessageSoundId = 'golgroda';

export const MESSAGE_SOUND_OPTIONS: { label: string; value: MessageSoundId }[] = [
  { label: 'Golgroda', value: 'golgroda' },
  { label: 'Ping', value: 'ping' },
  { label: 'Doing', value: 'doing' },
  { label: 'Inget ljud', value: 'none' },
];

const SOUND_ASSETS: Record<Exclude<MessageSoundId, 'none'>, number> = {
  golgroda: require('../../assets/sounds/golgroda.mp3'),
  ping: require('../../assets/sounds/ping.mp3'),
  doing: require('../../assets/sounds/doing.mp3'),
};

let audioModeReady: Promise<void> | null = null;
let player: AudioPlayer | null = null;
let playerSoundId: MessageSoundId | null = null;

export function isMessageSoundId(value: string | null): value is MessageSoundId {
  return value === 'golgroda' || value === 'ping' || value === 'doing' || value === 'none';
}

export async function playMessageSound(soundId: MessageSoundId) {
  if (soundId === 'none') return;
  await ensureAudioMode();
  if (playerSoundId !== soundId) {
    player?.remove();
    player = createAudioPlayer(SOUND_ASSETS[soundId], {
      keepAudioSessionActive: true,
      updateInterval: 1000,
    });
    playerSoundId = soundId;
  }
  await waitForLoaded(player);
  await player?.seekTo(0);
  player?.play();
}

function ensureAudioMode() {
  audioModeReady ??= Promise.all([
    setIsAudioActiveAsync(true),
    setAudioModeAsync({
      interruptionMode: 'mixWithOthers',
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    }),
  ])
    .then(() => undefined)
    .catch((error) => {
      audioModeReady = null;
      throw error;
    });
  return audioModeReady;
}

async function waitForLoaded(activePlayer: AudioPlayer | null) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (!activePlayer || activePlayer.isLoaded || activePlayer.currentStatus.isLoaded) return;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
}
