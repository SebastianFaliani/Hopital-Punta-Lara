ALTER TABLE leave_requests
  ADD COLUMN edited_by BIGINT NULL AFTER requested_by;

ALTER TABLE leave_requests
  ADD COLUMN edited_at DATETIME NULL AFTER edited_by;

ALTER TABLE leave_requests
  ADD CONSTRAINT fk_leave_requests_edited_by
    FOREIGN KEY (edited_by)
    REFERENCES users(id)
    ON DELETE SET NULL;
