ALTER TABLE users
  ADD COLUMN facility_id BIGINT NULL AFTER role_id,
  ADD INDEX idx_users_facility (facility_id),
  ADD CONSTRAINT fk_users_facility
    FOREIGN KEY (facility_id)
    REFERENCES health_facilities(id)
    ON DELETE SET NULL;
