// The DSA competition is opt-in: the UI entry points only exist when the build sets VITE_COMPETITION_ENABLED=true
// (the backend must also run with COMPETITION_ENABLED=true and the competition tables applied).
export const COMPETITION_ENABLED = (() => {
  try {
    return import.meta.env.VITE_COMPETITION_ENABLED === 'true';
  } catch {
    return false;
  }
})();
