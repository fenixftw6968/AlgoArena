import api from '../utils/api';

// REST is the source of truth for the competition. Identity always comes from the JWT; the client only ever sends
// a question number and the option it picked - never a user id, score, correctness or timestamp.
const base = '/api/competitions';

export const competitionService = {
  list: (page = 0, size = 20) => api.get(base, { params: { status: 'LOBBY', page, size } }).then((r) => r.data),
  create: () => api.post(base).then((r) => r.data),
  get: (id) => api.get(`${base}/${id}`).then((r) => r.data),
  join: (id) => api.post(`${base}/${id}/join`).then((r) => r.data),
  leave: (id) => api.post(`${base}/${id}/leave`).then((r) => r.data),
  start: (id) => api.post(`${base}/${id}/start`).then((r) => r.data),
  questions: (id) => api.get(`${base}/${id}/questions`).then((r) => r.data),
  submit: (id, questionNumber, selectedOption) =>
    api.post(`${base}/${id}/submissions`, { questionNumber, selectedOption }).then((r) => r.data),
  finish: (id) => api.post(`${base}/${id}/finish`).then((r) => r.data),
  leaderboard: (id) => api.get(`${base}/${id}/leaderboard`).then((r) => r.data),
  myResult: (id) => api.get(`${base}/${id}/results/me`).then((r) => r.data),
};

/** Human readable message from an API error. */
export function competitionErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const status = err?.response?.status;
  if (status === 429) return 'Too many requests - slow down for a moment.';
  if (status === 401) return 'Please sign in again.';
  const message = err?.response?.data?.message;
  return typeof message === 'string' && message.length < 200 ? message : fallback;
}
