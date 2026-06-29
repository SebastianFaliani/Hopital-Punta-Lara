UPDATE leave_rules lr
INNER JOIN attendance_codes ac
  ON ac.id = lr.attendance_code_id
SET
  lr.max_days_per_request = 5,
  lr.rule_notes = 'Maximo 5 dias corridos segun familiar directo.'
WHERE ac.code = '14';
