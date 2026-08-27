import { Image, ImageSourcePropType, ImageStyle, StyleProp } from 'react-native';

const CAR_IMAGE = require('../../../assets/symbols/car.png');
const HAT_IMAGE = require('../../../assets/symbols/hoghatt.png');
const HEART_IMAGE = require('../../../assets/symbols/heart.png');
const LEAF_IMAGE = require('../../../assets/symbols/leaf.png');
const MUSHROOM_IMAGE = require('../../../assets/symbols/mushroom.png');
const SPADE_IMAGE = require('../../../assets/symbols/spade.png');
const STAR_IMAGE = require('../../../assets/symbols/star.png');
const TRAIN_IMAGE = require('../../../assets/symbols/anglok.png');
const TREE_IMAGE = require('../../../assets/symbols/tree.png');

const SYMBOL_IMAGES: Record<string, ImageSourcePropType> = {
  car: CAR_IMAGE,
  hat: HAT_IMAGE,
  heart: HEART_IMAGE,
  leaf: LEAF_IMAGE,
  mushroom: MUSHROOM_IMAGE,
  spade: SPADE_IMAGE,
  star: STAR_IMAGE,
  train: TRAIN_IMAGE,
  tree: TREE_IMAGE,
};

export function FaltSymbol({
  color = '#17324d',
  size = 24,
  style,
  symbol,
}: {
  color?: string | null;
  size?: number;
  style?: StyleProp<ImageStyle>;
  symbol?: string | null;
}) {
  const iconColor = color ?? '#17324d';
  const source = SYMBOL_IMAGES[symbol ?? 'hat'] ?? HAT_IMAGE;

  return (
    <Image
      resizeMode="contain"
      source={source}
      style={[{ width: size, height: size, tintColor: iconColor }, style]}
    />
  );
}
