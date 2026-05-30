-- Limpieza de comas en campos de nombres humanos.
-- Usar en local o produccion despues de tener creadas las tablas del modulo.

START TRANSACTION;

UPDATE employees
SET full_name =
  TRIM(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(full_name, ',', ' '),
          '  ',
          ' '
        ),
        '  ',
        ' '
      ),
      '  ',
      ' '
    )
  )
WHERE full_name LIKE '%,%';

UPDATE laboratory_records
SET
  patient_last_name =
    TRIM(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(patient_last_name, ',', ' '),
            '  ',
            ' '
          ),
          '  ',
          ' '
        ),
        '  ',
        ' '
      )
    ),
  patient_first_name =
    TRIM(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(patient_first_name, ',', ' '),
            '  ',
            ' '
          ),
          '  ',
          ' '
        ),
        '  ',
        ' '
      )
    ),
  picked_up_by =
    CASE
      WHEN picked_up_by IS NULL THEN NULL
      ELSE TRIM(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(picked_up_by, ',', ' '),
              '  ',
              ' '
            ),
            '  ',
            ' '
          ),
          '  ',
          ' '
        )
      )
    END
WHERE
  patient_last_name LIKE '%,%'
  OR patient_first_name LIKE '%,%'
  OR picked_up_by LIKE '%,%';

UPDATE transfer_requests
SET patient_name =
  TRIM(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(patient_name, ',', ' '),
          '  ',
          ' '
        ),
        '  ',
        ' '
      ),
      '  ',
      ' '
    )
  )
WHERE patient_name LIKE '%,%';

UPDATE drivers
SET
  first_name =
    TRIM(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(first_name, ',', ' '),
            '  ',
            ' '
          ),
          '  ',
          ' '
        ),
        '  ',
        ' '
      )
    ),
  last_name =
    TRIM(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(last_name, ',', ' '),
            '  ',
            ' '
          ),
          '  ',
          ' '
        ),
        '  ',
        ' '
      )
    )
WHERE
  first_name LIKE '%,%'
  OR last_name LIKE '%,%';

UPDATE users
SET
  first_name =
    TRIM(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(first_name, ',', ' '),
            '  ',
            ' '
          ),
          '  ',
          ' '
        ),
        '  ',
        ' '
      )
    ),
  last_name =
    TRIM(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(last_name, ',', ' '),
            '  ',
            ' '
          ),
          '  ',
          ' '
        ),
        '  ',
        ' '
      )
    )
WHERE
  first_name LIKE '%,%'
  OR last_name LIKE '%,%';

COMMIT;
