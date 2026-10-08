-- =====================================================================================================
-- ROLLBACK for 001_create_competition_tables.sql
--
-- DESTRUCTIVE: permanently deletes ALL competition data (competitions, participants, questions,
-- submissions). It touches no other table. Do NOT run it unless you really want to remove the feature's data.
-- First set COMPETITION_ENABLED=false and redeploy so nothing is writing to these tables.
-- =====================================================================================================

DROP TABLE IF EXISTS competition_submissions;
DROP TABLE IF EXISTS competition_questions;
DROP TABLE IF EXISTS competition_participants;
DROP TABLE IF EXISTS competitions;
