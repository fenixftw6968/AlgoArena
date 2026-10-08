# 25-Player DSA Competition — Technical Design

Status: **DRAFT FOR REVIEW — nothing in this document is implemented.**
Scope: a multiplayer "DSA Competition" mode (lobby → countdown → 10 questions → final leaderboard).
Basis: the repository as inspected on 2026-10-08, after the Daily Challenge integrity fix.

---

## 0. Decisions I need from you (summary)

| # | Decision | My recommendation |
|---|---|---|
| D1 | Architecture | **Option C (hybrid)**: new `Competition` domain; reuse infrastructure, *not* the `Match` entity/service |
| D2 | Question delivery | **Sequential, forward-only** (server serves question *k+1* only after *k* is answered; skip allowed) |
| D3 | Scoring | **Model B**: 100 base + time bonus up to 50 (server-measured), wrong/skip = 0 |
| D4 | Early close | Competition ends at `endTime` **or as soon as nobody can still act** (all FINISHED/ABANDONED/LEFT) |
| D5 | Rating | **Leaderboard-only** in v1. No change to `competitiveRating`. Separate rating later |
| D6 | Schema management | Add **Flyway** (baseline the live Neon schema) *before* the competition tables — Milestone 0 |
| D7 | Integration tests | Add **Testcontainers PostgreSQL** (needs Docker on dev/CI) — concurrency cannot be proven on mocks/H2 |
| D8 | **Answer leakage via browser bundle** | The 150 DSA questions *with answers* are shipped in the frontend JS. Decide how to handle it before enabling rewards (see §23, R1) |
| D9 | Package layout | New feature package `com.algoarena.competition` (with internal layers) instead of spreading ~25 classes across the existing layer packages |
| D10 | Rewards | Structure only now; amounts decided later; rewards gated behind anti-farming rules (§14) |

---

## 1. Current architecture relevant to competitions

What exists today (verified in code):

| Area | What exists | Competition relevance |
|---|---|---|
| `Match` entity / `MatchService` (936 lines) | **Hard-wired for exactly 2 players**: `player1/player2` columns, `player1Score/player2Score`, `player1Ready/...`, bot logic, Elo in `finalizeMatch`. Score/time/mistakes are **client-reported**. Matchmaking uses a JVM `synchronized` lock + `FOR UPDATE SKIP LOCKED`. | Cannot represent 25 players. Its scoring model is the exact anti-pattern we must not repeat. |
| WebSocket | `WebSocketConfig`: `/ws` SockJS endpoint, `SimpleBroker("/topic")`, `/app` prefix, **no `@MessageMapping`, no auth interceptor**, `setAllowedOriginPatterns("*")`. `SecurityConfig` permits `/ws/**`. Frontend hooks connect **without** any token and subscribe to `/topic/match/{id}` and `/topic/invitations/{userId}`. | The transport is reusable; its **security is not** (anyone can subscribe to any topic; and — to be verified in Milestone 4 — a client `SEND` to a `/topic/**` destination is likely relayed by the simple broker, i.e. clients may be able to forge events). |
| Questions | DSA bank: `backend/src/main/resources/questions/dsa-master-quiz.json` — **150 questions** (50 EASY / 50 MEDIUM / 50 HARD), fields `id` (`dsa-N`), `category`, `title`, `question`, `options[4]`, `correctAnswer` (text), `explanation`, `hint`. 24 categories (Arrays 21, Graphs 18, Strings 16, Linked Lists 12, Trees 12, DP 10, Stacks 8, Sorting 7 …). **No tags**; **no "Two Pointers" / "Sliding Window" category**. No `Question` table. `MatchService.generateChallengeData` reads this JSON from the classpath and ships **correct answers to clients**. The same 150 questions with answers also exist in `frontend/src/data/dsaMasterQuestions.js` (bundled into the SPA). | Reuse the backend JSON as the source. Do **not** reuse `generateChallengeData` (it leaks answers). |
| Progression | `UserService.updateProgression(user, xp, coins, isMystery, isChallenge)`: adds XP/coins, recomputes level/rank, streak, `gamesCompleted++`, runs `AchievementService`. Not row-locked (lost updates possible). I added `UserRepository.findByIdForUpdate` (pessimistic lock) in the Daily Challenge fix. | Reuse for rewards — via the locked path and an idempotency guard. |
| Achievements | `AchievementService.checkRequirement` switch over requirement types (`games_completed`, `streak`, `level`, `coins` …). Unlock grants XP. | Add a new requirement type (e.g. `competition_wins`) computed by query — no new `users` columns. |
| Rating / leaderboard | `User.competitiveRating` (flat ±25, farmable). `LeaderboardService` loads all users. | Do not touch (D5). Competition gets its own results table/ranking. |
| Auth | Stateless JWT, `JwtAuthFilter`, principal = `User` entity. | Reuse. WebSocket needs the same JWT validated at STOMP `CONNECT`. |
| Scheduling | `@EnableScheduling` is on; `DailyChallengeService` has one cron. | Reuse for the competition ticker. |
| Errors | `GlobalExceptionHandler` + `ErrorResponse`; catch-all maps unknown framework errors (e.g. "no handler") to **500** and returns `ex.getMessage()`. | Reuse the format; add typed exceptions + fix the catch-all in Milestone 0. |
| DB | Neon PostgreSQL, HikariCP **max 5 connections**, `ddl-auto=none`, **no Flyway/Liquibase**, schema managed by hand. | Drives D6 and several risks. |
| Frontend | React 19 + Vite, "zine" design system (`zine-btn`, `zine-card`, `zine-option`, …), `useMatchSocket`-style hooks, `ExitModal`, `XPPopup`, `ProtectedRoute`. `MCQGameEngine` (807 lines) mixes local grading with match logic. | Reuse the design language and small components; do **not** extend `MCQGameEngine`. |

---

## 2. Existing components we can reuse

| Reuse | Where | How |
|---|---|---|
| STOMP endpoint `/ws`, `SimpMessagingTemplate` | `WebSocketConfig`, `MatchService` | Same endpoint & broker; **add** a `ChannelInterceptor` for auth (benefits 1v1 too) |
| JWT validation | `JwtUtil` | Called from the STOMP interceptor |
| `User`, `UserService.updateProgression`, `AchievementService` | services | Rewards (§14) |
| `findByIdForUpdate` (new) | `UserRepository` | Locked reward grant |
| Question JSON loading pattern | `generateChallengeData` | Re-implemented behind a `QuestionSource` interface (no answer leakage) |
| Pessimistic-lock repository pattern | `MatchRepository.findByIdWithLock` | Same technique for `Competition` |
| `ErrorResponse`, `GlobalExceptionHandler` | exception package | Extended |
| `@EnableScheduling` | app class | Competition ticker |
| Frontend: zine CSS, `api` util, `ProtectedRoute`, `ExitModal`, `XPPopup`, `framer-motion` | frontend | UI |
| Hook pattern | `useMatchSocket.js` | Generalised into `useCompetitionSocket` (+ JWT header) |

Deliberately **not** reused: `Match`, `MatchService`, `MatchDto`, `GameAttempt` (would double-count XP and has a per-puzzle solo shape), `Puzzle`/`Game` tables, `UserQuestionHistory` (a shared question set per competition does not fit per-user history), `MCQGameEngine`, `EloRatingService`.

---

## 3. Proposed architecture

```text
React SPA
  ├─ REST  (api.js + Bearer JWT)      ── commands & snapshots (source of truth)
  └─ STOMP (/ws, JWT in CONNECT hdr)  ── notifications (events are hints; REST is truth)

Spring Boot (existing monolith)
  com.algoarena.competition
    controller/   CompetitionController
    service/      CompetitionLobbyService   (create/join/leave/start-policy; owns the competition lock)
                  CompetitionPlayService    (question delivery, answer submission, grading)
                  CompetitionFinalizeService(end of contest: ranking, rewards, close)
                  CompetitionTicker         (@Scheduled: countdown→start, end→finish, presence timeouts)
                  CompetitionEventPublisher (after-commit STOMP publishing)
                  QuestionSource / ClasspathJsonQuestionSource, QuestionSelector
                  ScoringPolicy (interface) + TimeBonusScoringPolicy
                  CompetitionStateMachine   (pure transition table)
    entity/ repository/ dto/ config/ (CompetitionProperties)
  reuses: UserService, AchievementService, JwtUtil, SecurityConfig, ErrorResponse

PostgreSQL (Neon): competitions, competition_participants, competition_questions, competition_answers
```

Key principles:

1. **Server-authoritative everything** — scores, times, ranks, state transitions, deadlines.
2. **State lives in the database**, not in JVM memory/timers → restart-safe and ready for multiple instances.
3. **Events are notifications**; clients re-sync via REST snapshots (carrying `version` + `serverTime`).
4. **One lock rule**: any change to a competition's *lobby/state* takes `SELECT … FOR UPDATE` on that competition row. Answer submissions lock only the *participant* row.
5. **Answer-bearing fields have a single read path** (grading) and a single export path (post-FINISHED review), enforced by DTO whitelists and an automated leak test.

---

## 4. Option A vs B vs C

| | **A. Extend `Match`** | **B. Dedicated domain, nothing shared** | **C. Hybrid (recommended)** |
|---|---|---|---|
| Model fit | Poor: `player1/player2` columns, per-player columns for score/time/ready/rating | Perfect | Perfect |
| Work | Rewrite the most fragile class (N-player generalisation, new tables, keep 1v1 working) | Highest duplication (own socket config, own auth, own error format) | Moderate |
| Regression risk to 1v1 | **High** — 1v1 has only 2 shallow unit tests | None | None (shared edits limited to additive WS interceptor) |
| Security | Inherits client-trusted scoring | Clean | Clean |
| Evolvability | `Match` becomes a god-object (already 936 lines) | Clean | Clean |
| Verdict | Reject | Over-isolated | **Recommend** |

**Recommendation: C.** New `Competition` aggregate with its own tables and services; share only transport, auth, progression, error handling and UI language. The only shared-code change is the additive STOMP security interceptor (which also closes existing 1v1 WebSocket holes).

---

## 5. Recommended architecture — behavioural summary

- **Lobby**: anyone authenticated can *create* a lobby or *quick-join* the oldest open one. A user can be in **one** active competition at a time.
- **Start**: lobby starts its countdown when it is **full (25)** or when **≥ min players** and the **fill window** has elapsed (or optional host "start now").
- **Countdown**: server fixes `startTime` (= countdownStart + countdownSeconds) and `endTime` (= startTime + duration); clients only render.
- **Play**: all players receive the **same 10 questions in the same order**, delivered one at a time; each answer is graded and scored on the server.
- **End**: at `endTime`, or earlier when nobody can still act. Finalisation (ranking + rewards + status) is **one transaction**.
- **Results**: final leaderboard persisted (`final_rank`), immutable.

Config (all in `CompetitionProperties`, overridable by env; a copy is snapshotted into each competition row so live contests never change mid-flight):

| Property | Default | Notes |
|---|---|---|
| `competition.enabled` | `false` in prod initially | feature flag |
| `min-players` | **2** | configurable; rewards use a higher threshold (§14) |
| `max-players` | **25** | hard cap 25 enforced by CHECK constraint |
| `question-count` | 10 | |
| `duration-seconds` | 1200 (20 min) | |
| `fill-window-seconds` | 120 | time a lobby waits for more players once min is reached |
| `countdown-seconds` | 10 | |
| `lobby-ttl-seconds` | 600 | lobby with < min players is CANCELLED after this |
| `answer-grace-ms` | 2000 | accept answers this long after `endTime` (latency) |
| `disconnect-lobby-grace-seconds` | 30 | refresh-tolerant |
| `abandon-timeout-seconds` | 180 | in-contest disconnect → ABANDONED |
| `per-question-bonus-window-seconds` | 60 | for the time bonus |

---

## 6. Database schema (PostgreSQL)

Four tables. I deliberately did **not** create a reward ledger, a leaderboard table or a `question` table (see notes).

```sql
-- V2__competition.sql  (illustrative; final DDL is produced in Milestone 1)

CREATE TABLE competitions (
  id                   BIGSERIAL PRIMARY KEY,
  game_slug            VARCHAR(60)  NOT NULL DEFAULT 'dsa-master-quiz',
  status               VARCHAR(20)  NOT NULL,
  min_players          SMALLINT     NOT NULL,
  max_players          SMALLINT     NOT NULL,
  question_count       SMALLINT     NOT NULL,
  duration_seconds     INTEGER      NOT NULL,
  fill_window_seconds  INTEGER      NOT NULL,
  countdown_seconds    INTEGER      NOT NULL,
  player_count         SMALLINT     NOT NULL DEFAULT 0,   -- participants with status <> 'LEFT'
  question_seed        BIGINT,                            -- reproducible selection (audit)
  created_by           BIGINT       NOT NULL REFERENCES users(id),
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  lobby_deadline_at    TIMESTAMPTZ  NOT NULL,             -- TTL / fill-window anchor
  countdown_started_at TIMESTAMPTZ,
  start_time           TIMESTAMPTZ,
  end_time             TIMESTAMPTZ,
  finished_at          TIMESTAMPTZ,
  cancelled_reason     VARCHAR(40),
  participant_count    SMALLINT,                          -- frozen at start (reward scaling, history)
  version              BIGINT       NOT NULL DEFAULT 0,   -- @Version; doubles as event sequence
  CONSTRAINT ck_comp_status  CHECK (status IN ('WAITING','STARTING','IN_PROGRESS','FINISHED','CANCELLED')),
  CONSTRAINT ck_comp_players CHECK (min_players >= 2 AND max_players BETWEEN min_players AND 25),
  CONSTRAINT ck_comp_count   CHECK (player_count BETWEEN 0 AND max_players),
  CONSTRAINT ck_comp_times   CHECK (end_time IS NULL OR end_time > start_time)
);
CREATE INDEX ix_comp_open    ON competitions (created_at)  WHERE status = 'WAITING';
CREATE INDEX ix_comp_due     ON competitions (status, start_time, end_time, lobby_deadline_at)
                              WHERE status IN ('WAITING','STARTING','IN_PROGRESS');

CREATE TABLE competition_participants (
  id                    BIGSERIAL PRIMARY KEY,
  competition_id        BIGINT      NOT NULL REFERENCES competitions(id),
  user_id               BIGINT      NOT NULL REFERENCES users(id),
  status                VARCHAR(20) NOT NULL,             -- JOINED, PLAYING, FINISHED, LEFT, ABANDONED
  active                BOOLEAN     NOT NULL DEFAULT TRUE,-- occupies the user's "one competition at a time" slot
  joined_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at               TIMESTAMPTZ,
  disconnected_at       TIMESTAMPTZ,
  current_question      SMALLINT    NOT NULL DEFAULT 1,   -- 1-based next question to answer
  current_served_at     TIMESTAMPTZ,                      -- server time the current question became available
  answered_count        SMALLINT    NOT NULL DEFAULT 0,
  correct_count         SMALLINT    NOT NULL DEFAULT 0,
  score                 INTEGER     NOT NULL DEFAULT 0,
  total_time_ms         INTEGER     NOT NULL DEFAULT 0,   -- sum of server-measured answer times
  last_answered_at      TIMESTAMPTZ,
  finished_at           TIMESTAMPTZ,
  final_rank            SMALLINT,
  xp_awarded            INTEGER     NOT NULL DEFAULT 0,
  coins_awarded         INTEGER     NOT NULL DEFAULT 0,
  rewards_granted_at    TIMESTAMPTZ,
  CONSTRAINT uq_part_comp_user UNIQUE (competition_id, user_id),
  CONSTRAINT uq_part_comp_id   UNIQUE (competition_id, id),
  CONSTRAINT ck_part_status CHECK (status IN ('JOINED','PLAYING','FINISHED','LEFT','ABANDONED'))
);
CREATE UNIQUE INDEX uq_part_one_active_per_user ON competition_participants (user_id) WHERE active;
CREATE INDEX ix_part_comp_rank ON competition_participants (competition_id, final_rank);
CREATE INDEX ix_part_user_hist ON competition_participants (user_id, joined_at DESC);

CREATE TABLE competition_questions (
  id               BIGSERIAL PRIMARY KEY,
  competition_id   BIGINT       NOT NULL REFERENCES competitions(id),
  question_order   SMALLINT     NOT NULL,
  source_id        VARCHAR(100) NOT NULL,                 -- e.g. 'dsa-17'
  category         VARCHAR(60)  NOT NULL,
  difficulty       VARCHAR(10)  NOT NULL,
  question_text    TEXT         NOT NULL,
  options          JSONB        NOT NULL,                 -- fixed order, shared by all players
  correct_index    SMALLINT     NOT NULL,                 -- SERVER-ONLY
  explanation      TEXT         NOT NULL,                 -- SERVER-ONLY until FINISHED
  CONSTRAINT uq_cq_order  UNIQUE (competition_id, question_order),
  CONSTRAINT uq_cq_source UNIQUE (competition_id, source_id)
);

CREATE TABLE competition_answers (
  id               BIGSERIAL PRIMARY KEY,
  competition_id   BIGINT      NOT NULL,
  participant_id   BIGINT      NOT NULL,
  question_order   SMALLINT    NOT NULL,
  selected_index   SMALLINT,                              -- NULL = skipped
  is_correct       BOOLEAN     NOT NULL,
  score_awarded    INTEGER     NOT NULL,
  served_at        TIMESTAMPTZ NOT NULL,
  answered_at      TIMESTAMPTZ NOT NULL,
  time_taken_ms    INTEGER     NOT NULL,
  CONSTRAINT uq_ans_once  UNIQUE (participant_id, question_order),     -- ONE official submission
  CONSTRAINT fk_ans_part  FOREIGN KEY (competition_id, participant_id)
      REFERENCES competition_participants (competition_id, id),
  CONSTRAINT fk_ans_q     FOREIGN KEY (competition_id, question_order)
      REFERENCES competition_questions (competition_id, question_order)
);
CREATE INDEX ix_ans_comp_q ON competition_answers (competition_id, question_order);
```

Design notes:

- **Snapshot instead of FK to a question**: there is no question table (the bank is a JSON file in the jar). Snapshotting keeps history/audit correct if the bank is edited and makes grading a pure DB read. When the Phase-3 canonical question table exists, add a nullable `question_id` FK.
- **Leaderboard is not a table**: `final_rank/score/...` are written to participants during finalisation; leaderboard = `ORDER BY final_rank`. History = participants by `user_id`.
- **No reward ledger**: `rewards_granted_at` set inside the single finalisation transaction (guarded by the state transition) gives exactly-once. If reward types multiply later, introduce a ledger.
- **`active` + partial unique index** = DB-enforced "one active competition per user". `active` is cleared on LEAVE, ABANDON, FINISH and CANCEL.
- **Composite FKs** guarantee an answer can only reference a participant and a question *of the same competition*.
- **No ON DELETE CASCADE**: history is never deleted implicitly.
- **Not reused**: `GameAttempt`, `Puzzle`, `Match`, `UserQuestionHistory`.

---

## 7. Entity relationships

```text
User 1 ──< CompetitionParticipant >── 1 Competition 1 ──< CompetitionQuestion
                    │ 1                                          │ 1
                    └──────────< CompetitionAnswer >─────────────┘
```

- JPA: `Competition` and `CompetitionParticipant` mapped with `@ManyToOne(fetch = LAZY)`; **no `@OneToMany` collections on `Competition`** (avoids accidental loading of 25 participants × answers; use repository queries and fetch-join DTO projections).
- Enums as `EnumType.STRING`, backed by CHECK constraints. `Competition` has `@Version`.
- Entities are never serialised to the API; every endpoint returns DTOs (the existing leakage pattern is not repeated).

---

## 8. API endpoints (all `/api/competitions`, all authenticated, DTO-only responses)

| Method & path | Purpose | Notes |
|---|---|---|
| `POST /api/competitions` | Create a lobby (creator auto-joins) | Body optional; only whitelisted fields; defaults from config. Rate-limited; per-user open-lobby cap. |
| `POST /api/competitions/quick-join` | Join the oldest joinable lobby or create one | Uses `FOR UPDATE SKIP LOCKED` to pick a lobby |
| `GET /api/competitions?status=WAITING&page=` | Browse open lobbies | `{id, players n/max, createdAt, status}` — no usernames |
| `POST /api/competitions/{id}/join` | Join | Idempotent for an existing member |
| `POST /api/competitions/{id}/leave` | Leave (lobby only) | Frees the slot |
| `POST /api/competitions/{id}/abandon` | Quit during contest | Terminal for this user |
| `GET /api/competitions/{id}` | Snapshot | `status, version, serverTime, startTime, endTime, countdown, players[{username,level,status}], me{status,score,answered,...}` — members only for the roster |
| `GET /api/competitions/{id}/questions/current` | Current question for the caller | Participants, `IN_PROGRESS` only. No answer fields. |
| `POST /api/competitions/{id}/answers` | Submit `{questionOrder, selectedIndex \| null}` | Idempotent; returns result + next question |
| `GET /api/competitions/{id}/leaderboard` | Final leaderboard | Only when `FINISHED` (409 otherwise) |
| `GET /api/competitions/{id}/results/me` | My result + per-question review | Only when `FINISHED`; own answers only |
| `GET /api/competitions/me?page=&size=` | My competition history | Paginated |

`POST …/answers` response (illustrative):

```json
{ "accepted": true, "alreadyAnswered": false,
  "isCorrect": true, "scoreAwarded": 138, "totalScore": 412,
  "answeredCount": 4, "finished": false,
  "next": { "order": 5, "text": "...", "options": ["..","..","..",".."], "servedAt": "…" },
  "serverTime": "…" }
```

Neither `correct_index`, `explanation`, nor other players' answers appear in any live response.

Error contract: existing `ErrorResponse`; new typed exceptions → 400/403/404/409. Milestone 0 fixes the catch-all so framework errors stop turning into 500s.

---

## 9. WebSocket events

One public topic per competition and one private user queue.

- `SUBSCRIBE /topic/competition/{id}` — allowed only for participants of `{id}` (checked in the interceptor).
- `SUBSCRIBE /user/queue/competition` — private events (Spring user destinations keyed by authenticated principal).
- Client `SEND` is allowed **only** to a short whitelist under `/app/competition/**` (e.g. heartbeat); anything to `/topic/**` is rejected.

Envelope: `{ "type": "...", "competitionId": 123, "version": 57, "serverTime": "…", "data": { … } }`. Clients ignore events with `version` ≤ the last applied.

| Event | Replaces your list | Payload |
|---|---|---|
| `LOBBY_UPDATED` | PLAYER_JOINED, PLAYER_LEFT, LOBBY_READY, COUNTDOWN_STARTED, COUNTDOWN_CANCELLED | full lobby snapshot (players, `n/max`, status, `startTime`/countdown) + `change: {kind: JOINED\|LEFT, username}` |
| `COMPETITION_STARTED` | COMPETITION_STARTED, first QUESTION_AVAILABLE | `startTime`, `endTime`, `questionCount` (questions are fetched via REST) |
| `PROGRESS_UPDATED` (optional, throttled) | PLAYER_FINISHED | counts only: `finishedCount`, `activeCount` |
| `COMPETITION_FINISHED` | COMPETITION_FINISHED, LEADERBOARD_UPDATED | `finishedAt`; clients fetch leaderboard via REST |
| `COMPETITION_CANCELLED` | (new) | reason |

All events are published **after commit** (`TransactionSynchronization.afterCommit`) so clients never observe state that later rolls back. No live per-player scores in v1 (less leakage, less traffic); the final leaderboard appears at the end. Own answer feedback is returned in the REST response, not broadcast.

Authentication model: the JWT is sent in the STOMP `CONNECT` frame headers (SockJS cannot set HTTP headers); a `ChannelInterceptor` validates it, sets the `Principal`, and authorises each `SUBSCRIBE`/`SEND`. Not repeated: unauthenticated topics, guessable per-user topics.

---

## 10. Competition state machine

Necessary states only. Your `FULL/READY` is a *condition* that triggers a transition, not a state; `CLOSED` adds nothing over `FINISHED` (results are immutable once finished) and is omitted.

```text
                ┌── lobby TTL expired, players < min ──────────────┐
                │                                                  ▼
 (create) → WAITING ──(full  OR  min met + fill window elapsed  OR host start)──► STARTING
                ▲                                                   │ countdown elapsed (startTime reached)
                └──── players drop below min during countdown ──────┤
                                                                    ▼
                                                              IN_PROGRESS
                                                                    │ endTime reached OR nobody can still act
                                                                    ▼
                                                                 FINISHED          CANCELLED (terminal)
```

| From → To | Trigger | Guard (evaluated under the competition row lock) | Side effects |
|---|---|---|---|
| (new) → WAITING | create | quota checks | creator joined, event |
| WAITING → STARTING | join (full) / ticker (fill window) / host start | `player_count ≥ min`, ... | set `countdown_started_at`, `start_time`, `end_time`; **select & snapshot questions** (single txn); event |
| STARTING → WAITING | leave/timeout | `player_count < min` | clear countdown/start/end; **delete question snapshot**; event |
| STARTING → IN_PROGRESS | ticker | `now ≥ start_time` | participants `JOINED → PLAYING`; `current_served_at = start_time`; freeze `participant_count`; event |
| WAITING/STARTING → CANCELLED | ticker | `now ≥ lobby_deadline_at` and `player_count < min` (or 0 players) | `active=false` for members; event |
| IN_PROGRESS → FINISHED | ticker / last active player done | `now ≥ end_time` **or** no participant in `PLAYING` | finalise: lock participants, rank, rewards, `finished_at`; clear `active`; event |

Rules: join is allowed in `WAITING` and `STARTING` (while not full); never in `IN_PROGRESS`+. Every transition is a conditional move (`WHERE status = :expected`) inside the locked transaction, so it is **idempotent** (a second "finish" does nothing). A single `CompetitionStateMachine` class owns the legal-transition table and is unit-tested exhaustively.

## 11. Lobby / participant state machine

The "lobby" is the `WAITING`/`STARTING` portion above. Membership has its own small machine:

```text
(join) → JOINED ──(start)──► PLAYING ──(answers all)──► FINISHED
            │                   │
         (leave)             (abandon / abandon-timeout)
            ▼                   ▼
          LEFT              ABANDONED
```

- `LEFT` only occurs before start; the row is kept, so re-joining reuses it (`LEFT → JOINED`), preserving the unique constraint.
- Presence (connected or not) is **not** a status; it is `disconnected_at` (null = connected), so a network blip never changes competitive state.
- `FINISHED`/`ABANDONED` participants remain on the leaderboard with their score.
- Lobby counts: `player_count` = participants with status ≠ `LEFT`.

---

## 12. 25-player concurrency strategy

Requirement: never more than 25 participants, even if 30+ requests arrive simultaneously, on one or several instances.

**Options considered**

| Approach | Verdict |
|---|---|
| `if (size < 25)` then insert | **Race** — rejected |
| JVM `synchronized` (used by `MatchService`) | Single-JVM only — rejected |
| Optimistic version retry | Works but 25 simultaneous joiners → retry storms — not preferred |
| **Pessimistic row lock on the competition row** (`SELECT … FOR UPDATE`) | Simple, correct, multi-instance safe; 25 short transactions serialise trivially |
| Atomic counter `UPDATE … SET player_count = player_count+1 WHERE player_count < max_players AND status='WAITING'` | Also correct and lock-light; good complement |
| DB CHECK constraint | Final safety net |

**Chosen (layered, defence in depth)**

1. `CompetitionRepository.findByIdForUpdate(id)` (`PESSIMISTIC_WRITE`) at the start of **every** lobby/state mutation: join, leave, start, cancel, finish. State checks (`status ∈ {WAITING, STARTING}`) and capacity are evaluated *inside* the lock.
2. `player_count` is maintained under the lock; `CHECK (player_count BETWEEN 0 AND max_players)` makes an overflow a hard DB error even if a code path is wrong.
3. `UNIQUE (competition_id, user_id)` prevents duplicate membership; partial unique index on `(user_id) WHERE active` prevents being in two competitions.
4. `@Version` on `Competition` catches any unlocked modification (a bug) as an optimistic-lock exception.
5. Quick-join selects a lobby with `FOR UPDATE SKIP LOCKED … LIMIT 1` so concurrent quick-joiners are spread across lobbies instead of queuing on one.
6. Lock order is always **competition → participants (ascending id) → users (ascending id)** to avoid deadlocks.
7. Answer submission locks only the caller's participant row (`FOR UPDATE`) — 25 players answering never contend with each other.

Transactions are short (≈3–4 statements); with Hikari at 5 connections, 30 simultaneous joins complete in well under a second on Neon. I recommend raising the pool to ~10 for competitions (R6).

**Proof**: Milestone 3 adds Testcontainers tests: 30 threads joining one lobby ⇒ exactly 25 succeed, 5 rejected with a clean 409; same user joining 10× concurrently ⇒ 1 row; join racing with the start transition ⇒ either in-roster-at-start or rejected, never half-in.

---

## 13. Question selection strategy

- **Source**: the existing backend JSON via a `QuestionSource` interface (`ClasspathJsonQuestionSource`). No new bank. Future DB-backed source swaps in without touching callers.
- **When**: at the `WAITING → STARTING` transition, in the same transaction that fixes `start_time`; snapshot rows are written to `competition_questions`. If the lobby reverts to `WAITING`, the snapshot is deleted and re-drawn later (so people who left cannot have seen anything — nothing is delivered before `IN_PROGRESS` anyway).
- **Algorithm** (`QuestionSelector`, pure + seedable): draw by difficulty mix **3 EASY / 4 MEDIUM / 3 HARD** (configurable), at most 2 per category, prefer variety across categories, `SecureRandom` seed stored in `question_seed`. Ordered by difficulty ascending (warm-up → hard), identical for everyone.
- **Options**: shuffled once at selection and stored in a fixed order; grading is by **option index** (no text-matching quirks).
- **Categories**: your list includes *Two Pointers* and *Sliding Window*; the bank has no such categories and no tags. v1 uses the existing 24 categories; adding those topics requires new questions (a content task, not engineering) — flagged as a gap, not blocking.
- **Bank size**: 150 questions ⇒ heavy repetition across frequent contests (see R2). Not solved by this feature.

### Question ordering and delivery — recommendation (D2)

| | Same set, same order, **all delivered at start** | **Sequential, forward-only (recommended)** | Per-player shuffled order |
|---|---|---|---|
| Fairness | equal, but players can read ahead and skip around | equal | equal difficulty curve not guaranteed |
| Server-side timing | only submission timestamps are known | `served_at → answered_at` is exact | same as sequential |
| Anti-sharing | weak | better (nothing to read ahead; refresh cannot reset the clock) | best against "Q4 is B" chat sharing |
| UX | free navigation | simple, focused; explicit **Skip** | harder to explain |

Recommend **same questions, same order, one at a time**, with Skip. Per-player shuffling can be added later behind a flag if collusion appears.

---

## 14. Answer submission flow (+ rewards integration)

```text
POST /api/competitions/{id}/answers {questionOrder, selectedIndex|null}
  0. receivedAt = clock.instant()        ← captured at controller entry (DB-pool queueing must not cost the player time)
  1. principal → userId (never from the body)
  2. TX begin; SELECT participant (competition_id, user_id) FOR UPDATE       → 404/403 if not a member
  3. Load competition status/times (no lock):
        status must be IN_PROGRESS            → else 409
        receivedAt ≤ end_time + grace         → else 409 "competition ended"
        participant.status = PLAYING          → else 409 (FINISHED/ABANDONED/LEFT)
  4. if questionOrder < participant.current_question
        → return the stored answer (idempotent, alreadyAnswered=true, no state change)
     if questionOrder > participant.current_question → 400 (cannot skip ahead)
  5. Load question snapshot; validate selectedIndex ∈ [0, options) or null
  6. time_taken = receivedAt − current_served_at (clamped ≥ 0)
     is_correct = selectedIndex == correct_index
     score      = ScoringPolicy.score(question, is_correct, time_taken)
  7. INSERT answer (UNIQUE(participant_id, question_order) is the backstop)
     UPDATE participant: score, counts, total_time, current_question+1,
                         current_served_at = receivedAt, last_answered_at
     if answered_count == question_count → status FINISHED, finished_at = receivedAt
  8. TX commit → (if last active player finished: ask FinalizeService to close early)
  9. Respond with result + next question (no correct answer, no explanation)
```

- **Duplicate/concurrent submits** for the same question: the participant row lock serialises them; the second sees `current_question` advanced and returns the stored result. If a bug bypassed the lock, `uq_ans_once` rejects the insert.
- **Answer vs finalisation race**: finalisation first takes the competition lock, then locks all participants `FOR UPDATE` (waiting for in-flight answer transactions), only after `end_time + grace`, so nothing can commit an accepted answer after ranking is computed.
- **Wrong/skip** = 0 points, no negative marking (v1).

### Rewards integration (no farming)

- Rewards are computed **only inside finalisation** (single transaction, guarded by the `IN_PROGRESS → FINISHED` transition ⇒ exactly once). `rewards_granted_at` is a second guard.
- Grants go through `UserService.updateProgression` using the locked user path (users locked in ascending id).
- Anti-farming rules (all configurable): reward only if `participant_count ≥ reward-min-players` (e.g. 5); participant `answered_count ≥ 3` (no AFK participation XP); **per-user daily cap** on rewarded competitions; rewards scale with field size; only `FINISHED`/`PLAYING`-at-end participants (not `ABANDONED`/`LEFT`); sock-puppet lobbies (2 accounts) earn nothing because of the player threshold. Residual risk: coordinated groups of ≥ threshold alts (needs account-age/activity gates; analytics later).
- Structure (amounts TBD by you): podium bonus (1st/2nd/3rd) + participation XP proportional to correct answers. 1st-place achievement uses a new requirement type `competition_wins` evaluated by a count query — no new `users` columns.
- `gamesCompleted` increments once per rewarded competition (via `updateProgression`).

---

## 15. Scoring options

| | **A. Flat** | **B. Base + linear time bonus (recommended)** | **C. Dynamic (solve-count / decay) value** |
|---|---|---|---|
| Formula | 100 per correct | `100 + round(50 × max(0, 1 − max(0, t − 1s) / 60s))` per correct; wrong/skip 0 | question value falls as more players solve it (CTF-style) or decays with global time |
| Fairness | High, but speed only matters via tie-break | Good; rewards speed *and* accuracy; correctness always dominates (max bonus 50 < base 100) | Rewards solving hard questions; scores shift retroactively |
| Simplicity | Trivial | Simple, pure function | Complex; hard to explain; provisional scores unstable |
| Exploitability | Almost none (can't be gamed; automation still wins ties on time) | Latency/jitter affects bonus slightly (mitigated: `receivedAt` at controller entry, 1 s grace, bonus is only 1/3 of a question); automation gets max bonus (inherent) | Collusion (withhold solves), alt accounts shape values |
| Competitive value | Low (many ties) | **High** — natural ranking spread, fewer ties | Highest, but needs ≥ 20 players to be meaningful |
| Implementation | Easiest | Easy (`ScoringPolicy` interface, 20 lines) | Hard (re-scoring on every submission) |

**Recommendation: B**, behind a `ScoringPolicy` interface so A or C can replace it later. Max score = 10 × 150 = 1500. All constants configurable. The full formula is deliberately not implemented yet.

---

## 16. Tie-breaking

Deterministic total order, applied at finalisation and stored as `final_rank`:

1. **Higher score**
2. **More correct answers**
3. **Lower `total_time_ms`** (sum of server-measured answer times)
4. **Earlier `last_answered_at`**
5. **Earlier `joined_at`**
6. **Lower `user_id`** (pure determinism; purely a last resort)

Fairness check: (1)–(3) reflect performance; (4)–(6) are arbitrary-but-stable and virtually never reached with Model B (millisecond times). A player who did not answer everything is ranked below equal-score players who did only via (2)/(3) naturally. Abandoned players keep their score and sort by the same rule but are flagged and ineligible for rewards. Shared ranks are not used (simplifies rewards and history); if you prefer visible shared ranks for an exact (1)–(4) tie we can add a `tied` flag without changing the algorithm.

---

## 17. Timer design

- Server fields: `countdown_started_at`, `start_time`, `end_time` (= `start_time + duration`), plus per-participant `current_served_at`.
- Every REST snapshot and every event carries `serverTime`. The client computes `offset = serverTime − clientNow` (adjusted by half the measured round trip) and renders `end_time − (clientNow + offset)`. Browser timers only *display*; they never decide anything.
- Server enforces: answers accepted until `end_time + grace`; countdown → start and end → finish performed by the ticker.
- **Ticker**: `@Scheduled(fixedDelay = 1000)` finds due work with indexed queries and processes each competition under its row lock using `FOR UPDATE SKIP LOCKED` (safe if two instances run it). All timing is read from an injectable `Clock` (tests use a fake clock). Lazy finalisation: any read of an overdue competition triggers the same idempotent transition, so a missed tick or restart self-heals.
- **Neon cost note**: a constantly polling ticker keeps the Neon compute awake. The ticker therefore first consults an in-memory "active competitions exist" hint (rehydrated at boot with one query) and idles otherwise.
- **Hosting note**: the countdown only advances while the backend is running — Render free-tier sleep would stall lobbies (R5).
- Per-question timing is exact thanks to sequential delivery (`served_at`).

---

## 18. Disconnect / reconnect behaviour

| Situation | Behaviour |
|---|---|
| Disconnect **in lobby** | `disconnected_at` set; short grace (default 30 s, survives page refresh); reconnect clears it; after grace → auto-`LEAVE` (slot freed, `LOBBY_UPDATED`). Explicit Leave is immediate. |
| Disconnect **during countdown** | Same; if count drops below min the countdown cancels and the lobby returns to `WAITING`. |
| Disconnect **during contest** | Progress kept; the global clock keeps running; the current question's `served_at` is unchanged (refreshing cannot reset the question timer). Participant shown as "disconnected" only to the server. |
| Reconnect | Client re-fetches `GET /{id}` + `questions/current` (events missed while offline are irrelevant because REST is the source of truth) and resumes. |
| Network failure | Indistinguishable from disconnect; STOMP client auto-reconnects (existing 5 s `reconnectDelay`). |
| Timeout in contest | After `abandon-timeout` (default 180 s) the participant becomes `ABANDONED` (**terminal**, matching your wording): keeps score on the leaderboard, no rewards, no longer blocks early close. |
| Duplicate connections | Identity is the *user*, not the socket: multiple tabs both receive events; answers are idempotent per question, so double submission is harmless. Presence = "≥ 1 live session" (tracked from STOMP session events + heartbeat; `disconnected_at` is the persisted fact, so it survives a restart). |
| Explicit abandon | `POST /abandon` after a confirm dialog; terminal. |
| Host leaves lobby | No host powers in v1 (auto-start) so nothing to transfer. |

---

## 19. Security model

Every state-changing call checks: **authenticated user ∧ competition membership ∧ competition state ∧ request validity**.

| Threat (your §21) | Control |
|---|---|
| Join after start | Status checked under the competition lock; only `WAITING`/`STARTING` joinable |
| Join twice | `UNIQUE(competition_id,user_id)` + idempotent join; one-active-competition partial unique index |
| Join when full | `player_count < max` under lock + CHECK constraint |
| Answer for another participant | Participant derived from the JWT principal, never from the request |
| Answer after timeout | `receivedAt ≤ end_time + grace` and status `IN_PROGRESS`, enforced server-side |
| Change scores / completion time | No client input for scores or times; computed from server timestamps; no update endpoints |
| View answers early | Live DTOs structurally lack `correct_index`/`explanation`; review endpoint only after `FINISHED`, own answers only; automated JSON "leak test" over every endpoint |
| View another player's answers | Review is own-only; roster shows names/levels only (never email) |
| Repeated finish | State transition guard `WHERE status='IN_PROGRESS'` under lock; no public "finish" endpoint |
| Manipulate leaderboard | Computed once at finalisation, immutable; read-only endpoints |
| WS: unauthenticated / eavesdrop / forge | JWT at STOMP CONNECT; per-destination subscribe authorisation; client `SEND` to `/topic/**` rejected; private events on `/user/queue` |
| Lobby spam / resource abuse | Per-user create limits, open-lobby caps, lobby TTL cancel, rate limits on join/answer |
| IDOR on ids | Membership checks on every `/{id}` route; consistent 404 for non-members |
| Automation / bots / lookups | **Cannot be fully prevented**; reduced by sequential delivery and server timing; see R1 for the bundle leak |

Cross-cutting: use typed exceptions; never return `ex.getMessage()`; minimal logging of answers; CORS/WS origins use an allowlist (Phase-0 item) — the competition feature must not ship before WS auth is in place (Milestone 4 is a hard prerequisite for enabling it).

---

## 20. Frontend page / component structure

Routes (inside `ProtectedRoute`):

```text
/competitions            CompetitionHome   — create / quick-join / open lobbies / my history link
/competitions/:id        CompetitionRoom   — renders by phase:
                           WAITING|STARTING → CompetitionLobby
                           IN_PROGRESS      → CompetitionPlay
                           FINISHED         → CompetitionResults
/competitions/history    CompetitionHistory (later milestone)
```

Components (`src/components/competition/`): `PlayerRoster`, `LobbyHeader (n/25, status)`, `CountdownDisplay`, `CompetitionTimer`, `QuestionCard` (slim; reuses `zine-option` styles), `ProgressBar (Question k/10)`, `LeaderboardTable`, `ResultSummary`, `ReviewList`, plus existing `ExitModal` for leave/abandon confirms and `XPPopup` for rewards.

Hooks/services: `useCompetitionSocket(id, onEvent)` (same pattern as `useMatchSocket` **plus** `connectHeaders: { Authorization: Bearer … }`), `useCompetition(id)` (REST snapshot + event reducer using `version`), `useServerClock()` (offset), `competitionApi.js`.

UX mapping: lobby shows `Players: 17 / 25`, roster, status, server-driven countdown and a Leave button; play screen shows `Question 4 / 10`, server-derived time remaining, options, Submit and Skip; results show podium, "Your Rank", correct count, time and a review. Uses the existing "zine"/cosmic design language; no new design system. Frontend never holds answers.

---

## 21. Testing strategy

| Layer | Tests |
|---|---|
| Pure unit | State-machine transition table (every legal/illegal transition); `ScoringPolicy` boundaries (0 s, grace, window, wrong, skip); tie-break comparator; `QuestionSelector` (determinism per seed, difficulty mix, ≤ 2 per category, 10 distinct); reward calculator & caps |
| Service (Mockito + fake `Clock`) | Guards: join after start/full/duplicate; answer states; start-policy; finalisation idempotency; abandon timeout |
| **Integration (Testcontainers PostgreSQL)** | 30 concurrent joins ⇒ exactly 25; concurrent same-user joins; duplicate concurrent answer ⇒ 1 row; answer-vs-finalise race; join-vs-start race; leave+join races; quick-join spread; one-active-competition constraint; finalisation exactly-once with concurrent triggers; CHECK constraints really fire |
| Controller / security (`@WebMvcTest`) | 401/403/404/409 matrix; **JSON leak test**: no `correct*`, `explanation`, `solution` in any live response; no email in roster |
| WebSocket | Unauthenticated CONNECT rejected; subscribe to other competition rejected; client SEND to topic rejected; events delivered after commit only |
| Scheduler | Fake clock: countdown → start → end; missed ticks; restart recovery |
| End-to-end | 25 simulated clients × 10 answers (load smoke), full lifecycle |
| Frontend | Add Vitest + RTL: server-clock offset math, event reducer ordering by `version`, `QuestionCard` has no answer data |

Note: all existing tests are Mockito-only; Testcontainers + Docker is a new requirement (D7). H2 is not acceptable for locking semantics.

---

## 22. Migration strategy

Current reality: no Flyway; Neon schema hand-made; `ddl-auto=none`.

1. **Milestone 0**: add Flyway. Baseline = the *current live schema* (`pg_dump -s` from Neon, provided by you; I write `V1__baseline.sql`), `baseline-on-migrate=true`, `baseline-version=1` so the live DB adopts it without re-running V1 while fresh databases (local, CI, Testcontainers) build it from scratch. Optionally set `ddl-auto=validate` afterwards to catch drift.
2. `V2__competition.sql` adds only **new tables** — zero changes to existing tables ⇒ safe to deploy, trivially reversible (drop tables).
3. Rehearse on a **Neon branch** copy before production.
4. Rollout behind `competition.enabled=false`; backend deployed dark; enable per environment after WS-auth + tests are in. Frontend routes hidden behind the same flag (via the existing `/api/games`-style capability fetch or an env flag).
5. If you decline Flyway: fallback is a hand-run SQL script (current practice) — workable but loses reproducible tests and drift detection; I advise against it.

---

## 23. Risks

| # | Risk | Severity | Mitigation / decision |
|---|---|---|---|
| **R1** | **The competition question bank (the same 150 DSA questions) is bundled with its answers into the public frontend JS** (`frontend/src/data/dsaMasterQuestions.js`, imported by `DsaMasterQuiz.jsx`, 1.16 MB single chunk). Any player can look up answers by question text. Server-side secrecy alone does not protect a competition. | **High (integrity)** | Options: (a) accept for the pre-reward MVP (Milestones 1–8, no rewards); (b) move solo DSA quiz to server-delivered questions and delete the answers from the bundle (Phase 3 work, needed before rewards); (c) give competitions a server-only pool. **Recommend (a) now + (b) before enabling rewards (M9).** |
| R2 | Only 150 questions ⇒ frequent repeats across contests; low variety | Medium | Grow bank (content task); selector avoids recent sets later |
| R3 | WebSocket layer currently unauthenticated/forgeable | High | Milestone 4 hard prerequisite; also fixes 1v1 |
| R4 | Time-bonus fairness under latency | Medium | `receivedAt` at controller entry; 1 s grace; bonus capped at 1/3 of a question |
| R5 | Render free-tier sleep / restarts stall countdowns and the ticker | Medium | State is DB-backed and self-healing; competitions need an always-on backend |
| R6 | Neon latency + Hikari pool of 5: bursts of 25 simultaneous answers queue | Medium | Short transactions; raise pool to ~10 (Neon pooler OK); load test in M14 |
| R7 | Ticker keeps Neon compute awake (cost) | Low | Idle-hint optimisation |
| R8 | Multi-instance: STOMP simple broker is in-memory; presence is per instance | Medium (future) | Single instance for now; when scaling, use a STOMP broker relay or Redis pub/sub. **Redis/Kafka are not required** for this feature at one instance |
| R9 | Reward farming with alt accounts / lobby spam | Medium | Player threshold, daily cap, answered-count gate, lobby limits; analytics later |
| R10 | Collusion (sharing answers in chat) | Inherent | Sequential delivery; same-order is a conscious tradeoff (D2); per-player shuffle later if needed |
| R11 | `GlobalExceptionHandler` catch-all returns 500 for framework errors | Medium | Fix in Milestone 0 |
| R12 | `updateProgression` lost updates | Medium | Locked user path in rewards |
| R13 | Scope creep | Medium | Milestone gating, feature flag, no changes to 1v1 behaviour |

---

## 24. Implementation milestones

Each milestone ends with tests + build green, a change report, and **no commits by me**.

| M | Scope | Depends on | Notes |
|---|---|---|---|
| **M0** | Prerequisites: Flyway + V1 baseline (needs your `pg_dump -s`), Testcontainers setup, injectable `Clock`, `CompetitionProperties` + flag, `GlobalExceptionHandler` fixes (typed 403/404/409, no raw messages) | — | Unblocks everything; decisions D6/D7 |
| **M1** | Domain + DB: `V2__competition.sql`, entities, repositories, `CompetitionStateMachine` + unit tests | M0 | No endpoints |
| **M2** | Create / list / join / leave / quick-join REST with competition-row lock, one-active-competition rule, DTOs | M1 | |
| **M3** | 25-player concurrency proof: Testcontainers stress tests, constraint tests | M2 | Locking is *implemented* in M2, *proven* here |
| **M4** | WebSocket security (STOMP JWT interceptor, subscribe authz, block client SEND to topics) + lobby events after commit | M2 | Hard prerequisite to enabling the feature |
| **M5** | Start policy, countdown, ticker, cancel-on-insufficient-players, server timestamps | M2, M4 | Fake-clock tests |
| **M6** | Question selection snapshot + sequential delivery (`questions/current`) + leak tests | M5 | |
| **M7** | Answer submission, grading, `ScoringPolicy` (Model B), idempotency & race tests | M6 | Merges your "submission" + "scoring" |
| **M8** | Completion: end-time/early-close finalisation, ranking, tie-break, leaderboard & results endpoints | M7 | Merges "completion" + "final leaderboard" |
| **M9** | Presence: disconnect grace, reconnect, abandon | M5 | Before frontend so UX is real |
| **M10** | Rewards + achievement requirement type + anti-farming (amounts approved by you; **gated on R1 decision**) | M8 | |
| **M11** | Frontend: competitions home + lobby (+ socket hook with JWT, server clock) | M4, M5 | |
| **M12** | Frontend: play screen | M7, M11 | |
| **M13** | Results, review, history (API + UI) | M8, M12 | |
| **M14** | Hardening: load test (25×10), security review, docs, flag enablement checklist | all | |

Suggested review checkpoints: after **M3** (data model + concurrency are the riskiest parts), after **M7** (the core contest loop), and before **M10** (rewards).

---

## Appendix A — Answers to the numbered requirements

1. Lobby create/join, max 25, real-time roster → §5, §8, §9, §12.
2. Lobby states → §10–11 (`FULL/READY` and `CLOSED` removed with reasons; `STARTING`/`CANCELLED` kept).
3. Server-authoritative countdown → §17.
4. 10 questions, existing bank → §13.
5. Server-side selection, no answer leakage, per-competition storage → §6, §13, §19.
6. Same order for all → §13 (recommended).
7. Server-validated answers → §14.
8. One official submission per question → §6 `uq_ans_once`, §14.
9. Scoring models → §15.
10. Configurable duration, server timestamps → §5, §17.
11. Early completion → §14/§10: players become FINISHED and see a provisional result; competition ends at `endTime` **or** when nobody can still act (strictly better than always waiting; matches your preference whenever anyone is still playing).
12. Server-side final leaderboard → §6, §10, §16.
13. Tie-break → §16.
14. Rewards → §14.
15. Rating → leaderboard-only; later a **separate** `competitionRating` (multi-player rating such as pairwise-Elo/Plackett-Luce), computed by replaying persisted results (we store rank, score, participant count to enable that). Mixing into the 1v1 `competitiveRating` is wrong: different skill dimension and that rating is already flat ±25.
16. History → persisted fields in §6 (`final_rank`, `score`, times, `participant_count`, joined/finished timestamps); `GET /api/competitions/me`.
17. DB design → §6 (4 tables; leaderboard/reward ledger/question table intentionally omitted; reasons given).
18. Concurrency → §12.
19. WS events → §9.
20. Disconnects → §18.
21. Security → §19.
22. Frontend → §20.
23. Architecture option → §4 (C).
