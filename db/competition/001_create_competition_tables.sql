-- =====================================================================================================
-- AlgoArena - DSA Competition, schema v1  (ADDITIVE ONLY)
--
--   * Creates 4 NEW tables + their indexes. It does not alter, drop or read any existing table;
--     the only reference to existing data is the foreign key to users(id).
--   * Idempotent: safe to run more than once (CREATE ... IF NOT EXISTS).
--   * Run it yourself, first on a Neon BRANCH / scratch database, then on production, BEFORE setting
--     COMPETITION_ENABLED=true. The application never creates or alters these tables on its own.
--   * Rollback: db/competition/001_rollback_drop_competition_tables.sql (drops only these 4 tables).
--
-- Notes on the design (see the architecture plan):
--   - competitions.player_count is guarded by CHECK (player_count <= max_players <= 25): even a bug in the
--     application cannot make a lobby exceed 25 players. Joins additionally lock the competition row.
--   - UNIQUE (competition_id, user_id)       -> a user cannot join the same competition twice.
--   - UNIQUE (user_id) WHERE active          -> a user can be in only one live competition at a time.
--   - UNIQUE (participant_id, question_number) -> exactly one official answer per question, enforced by the DB.
--   - competition_questions.correct_index / explanation are SERVER-ONLY and are never selected into client DTOs.
-- =====================================================================================================

CREATE TABLE IF NOT EXISTS competitions (
    id                          BIGSERIAL PRIMARY KEY,
    status                      VARCHAR(12)  NOT NULL,
    game_slug                   VARCHAR(60)  NOT NULL DEFAULT 'dsa-master-quiz',
    created_by                  BIGINT       NOT NULL REFERENCES users (id),
    host_id                     BIGINT       NOT NULL REFERENCES users (id),
    min_players                 INTEGER      NOT NULL,
    max_players                 INTEGER      NOT NULL,
    question_count              INTEGER      NOT NULL,
    duration_seconds            INTEGER      NOT NULL,
    countdown_seconds           INTEGER      NOT NULL,
    player_count                INTEGER      NOT NULL DEFAULT 0,
    question_seed               BIGINT,
    version                     BIGINT       NOT NULL DEFAULT 0,
    created_at                  TIMESTAMPTZ  NOT NULL,
    lobby_deadline_at           TIMESTAMPTZ  NOT NULL,
    start_time                  TIMESTAMPTZ,
    end_time                    TIMESTAMPTZ,
    finished_at                 TIMESTAMPTZ,
    cancelled_reason            VARCHAR(40),
    participant_count_at_start  INTEGER,
    CONSTRAINT ck_competitions_status       CHECK (status IN ('LOBBY', 'STARTING', 'RUNNING', 'FINISHED', 'CANCELLED')),
    CONSTRAINT ck_competitions_players      CHECK (min_players >= 2 AND max_players >= min_players AND max_players <= 25),
    CONSTRAINT ck_competitions_player_count CHECK (player_count >= 0 AND player_count <= max_players),
    CONSTRAINT ck_competitions_questions    CHECK (question_count BETWEEN 1 AND 50),
    CONSTRAINT ck_competitions_duration     CHECK (duration_seconds > 0 AND countdown_seconds >= 0),
    CONSTRAINT ck_competitions_times        CHECK (end_time IS NULL OR start_time IS NULL OR end_time > start_time)
);

-- open lobbies list
CREATE INDEX IF NOT EXISTS ix_competitions_open
    ON competitions (created_at DESC) WHERE status = 'LOBBY';
-- the lifecycle ticker only ever looks at live competitions
CREATE INDEX IF NOT EXISTS ix_competitions_live
    ON competitions (status, lobby_deadline_at, start_time, end_time)
    WHERE status IN ('LOBBY', 'STARTING', 'RUNNING');


CREATE TABLE IF NOT EXISTS competition_participants (
    id                    BIGSERIAL PRIMARY KEY,
    competition_id        BIGINT       NOT NULL REFERENCES competitions (id),
    user_id               BIGINT       NOT NULL REFERENCES users (id),
    status                VARCHAR(10)  NOT NULL,
    active                BOOLEAN      NOT NULL DEFAULT TRUE,
    joined_at             TIMESTAMPTZ  NOT NULL,
    left_at               TIMESTAMPTZ,
    disconnected_at       TIMESTAMPTZ,
    answered_count        INTEGER      NOT NULL DEFAULT 0,
    correct_count         INTEGER      NOT NULL DEFAULT 0,
    score                 INTEGER      NOT NULL DEFAULT 0,
    last_submission_at    TIMESTAMPTZ,
    finished_at           TIMESTAMPTZ,
    final_rank            INTEGER,
    final_completion_ms   BIGINT,
    CONSTRAINT uq_comp_part_user       UNIQUE (competition_id, user_id),
    CONSTRAINT uq_comp_part_comp_id    UNIQUE (competition_id, id),
    CONSTRAINT ck_comp_part_status     CHECK (status IN ('JOINED', 'FINISHED', 'LEFT')),
    CONSTRAINT ck_comp_part_counts     CHECK (answered_count >= 0 AND correct_count >= 0 AND score >= 0
                                              AND correct_count <= answered_count)
);

-- a user can be in only ONE live competition at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_comp_part_one_active_per_user
    ON competition_participants (user_id) WHERE active;
CREATE INDEX IF NOT EXISTS ix_comp_part_rank
    ON competition_participants (competition_id, final_rank);
CREATE INDEX IF NOT EXISTS ix_comp_part_user_history
    ON competition_participants (user_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS ix_comp_part_disconnected
    ON competition_participants (disconnected_at) WHERE disconnected_at IS NOT NULL AND active;


CREATE TABLE IF NOT EXISTS competition_questions (
    id               BIGSERIAL PRIMARY KEY,
    competition_id   BIGINT        NOT NULL REFERENCES competitions (id),
    question_number  INTEGER       NOT NULL,
    source_id        VARCHAR(100)  NOT NULL,
    category         VARCHAR(60),
    difficulty       VARCHAR(10),
    question_text    TEXT          NOT NULL,
    options          JSONB         NOT NULL,
    correct_index    INTEGER       NOT NULL,   -- SERVER-ONLY
    explanation      TEXT,                     -- SERVER-ONLY until the competition is FINISHED
    CONSTRAINT uq_comp_q_number  UNIQUE (competition_id, question_number),
    CONSTRAINT uq_comp_q_source  UNIQUE (competition_id, source_id),
    CONSTRAINT ck_comp_q_number  CHECK (question_number >= 1),
    CONSTRAINT ck_comp_q_correct CHECK (correct_index >= 0)
);


CREATE TABLE IF NOT EXISTS competition_submissions (
    id               BIGSERIAL PRIMARY KEY,
    competition_id   BIGINT       NOT NULL,
    participant_id   BIGINT       NOT NULL,
    question_number  INTEGER      NOT NULL,
    selected_index   INTEGER      NOT NULL,
    is_correct       BOOLEAN      NOT NULL,
    score_awarded    INTEGER      NOT NULL,
    submitted_at     TIMESTAMPTZ  NOT NULL,   -- always the SERVER receive time
    CONSTRAINT uq_comp_sub_once        UNIQUE (participant_id, question_number),
    CONSTRAINT ck_comp_sub_score       CHECK (score_awarded >= 0),
    CONSTRAINT fk_comp_sub_participant FOREIGN KEY (competition_id, participant_id)
        REFERENCES competition_participants (competition_id, id),
    CONSTRAINT fk_comp_sub_question    FOREIGN KEY (competition_id, question_number)
        REFERENCES competition_questions (competition_id, question_number)
);

CREATE INDEX IF NOT EXISTS ix_comp_sub_competition_question
    ON competition_submissions (competition_id, question_number);
