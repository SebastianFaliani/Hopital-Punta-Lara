ALTER TABLE transfer_requests
  ADD COLUMN facility_id BIGINT NULL AFTER request_type,
  ADD INDEX idx_transfer_requests_facility (facility_id),
  ADD CONSTRAINT fk_transfer_requests_facility
    FOREIGN KEY (facility_id) REFERENCES health_facilities(id)
    ON DELETE SET NULL;

ALTER TABLE recurring_transfer_templates
  ADD COLUMN facility_id BIGINT NULL AFTER id,
  ADD INDEX idx_recurring_transfer_facility (facility_id),
  ADD CONSTRAINT fk_recurring_transfer_facility
    FOREIGN KEY (facility_id) REFERENCES health_facilities(id)
    ON DELETE SET NULL;
