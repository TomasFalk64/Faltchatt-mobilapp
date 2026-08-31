const GOOGLE_MAPS_ANDROID_API_KEY = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

if (
  process.env.EAS_BUILD === 'true' &&
  process.env.EAS_BUILD_PLATFORM === 'android' &&
  !GOOGLE_MAPS_ANDROID_API_KEY
) {
  throw new Error('Missing GOOGLE_MAPS_ANDROID_API_KEY for Android Google Maps configuration.');
}

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        ...config.android?.config?.googleMaps,
        apiKey: GOOGLE_MAPS_ANDROID_API_KEY,
      },
    },
  },
});
