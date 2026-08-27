import { Alert } from 'react-native';

export function confirmAction(title: string, message: string, action: () => void | Promise<void>) {
  Alert.alert(title, message, [
    { text: 'Avbryt', style: 'cancel' },
    { text: 'Fortsätt', style: 'destructive', onPress: () => void action() },
  ]);
}
