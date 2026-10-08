# DSA Competition - database setup

The competition feature is **off by default** and adds four new tables. It does not alter or read any existing
table other than a foreign key to `users(id)`.

| File | Purpose |
|------|---------|
| `001_create_competition_tables.sql` | Creates `competitions`, `competition_participants`, `competition_questions`, `competition_submissions` (idempotent: every statement is `IF NOT EXISTS`). |
| `001_rollback_drop_competition_tables.sql` | Drops only those four tables (no `CASCADE`). Destructive - only for undoing the feature. |

## Enabling

1. Review and apply `001_create_competition_tables.sql` to the target PostgreSQL database (for example in the
   Neon SQL editor). Nothing in the application or the test-suite runs this against a real database.
2. Set the backend environment variable `COMPETITION_ENABLED=true` and restart. (Optional tuning: see
   `competition.*` in `backend/src/main/resources/application.properties` and `backend/.env.example`.)
3. Build the frontend with `VITE_COMPETITION_ENABLED=true` to show the "Showdown" entry and the
   `/competitions` routes.

Without step 1 the backend must keep `COMPETITION_ENABLED=false`, otherwise competition requests fail because
the tables do not exist.

## Rules enforced by the database itself

* at most 25 players per competition (`CHECK`) and `player_count <= max_players`;
* a user appears once per competition and in at most one live competition at a time (partial unique index);
* one answer per participant per question;
* submissions can only reference a participant and a question of the same competition.

Version 1 is leaderboard-only: it grants no XP, coins or rating.
