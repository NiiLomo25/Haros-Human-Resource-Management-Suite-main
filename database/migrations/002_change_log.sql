-- Haros HRMIS — Migration 002: Change-log detail index for audit queries

CREATE INDEX IF NOT EXISTS idx_hrmis_change_log_entity ON hrmis_change_log(entity, created_at);
