-- The entrypoint creates the role and the dev database from POSTGRES_USER and
-- POSTGRES_DB. Only the test database is left to create.
--
-- The integration and e2e suites truncate between runs and refuse to start
-- unless the database name ends in `_test`, which keeps the dev database and
-- the transcripts in it out of reach.
CREATE DATABASE devhotseat_test OWNER devhotseat;
