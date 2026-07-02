ALTER TABLE laboratory_records
  ADD COLUMN protocol_number VARCHAR(80) NULL AFTER id;

ALTER TABLE laboratory_records
  ADD COLUMN patient_birth_date DATE NULL AFTER patient_document;

ALTER TABLE laboratory_records
  ADD COLUMN patient_phone VARCHAR(80) NULL AFTER patient_birth_date;

ALTER TABLE laboratory_records
  ADD COLUMN status ENUM('enviado','parcial','completo','retirado') NOT NULL DEFAULT 'enviado' AFTER is_complete;

CREATE TABLE IF NOT EXISTS laboratory_test_catalog (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  category VARCHAR(100) NOT NULL,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(150) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_laboratory_test_catalog_code (code),
  INDEX idx_laboratory_test_catalog_category (category),
  INDEX idx_laboratory_test_catalog_active (is_active)
);

CREATE TABLE IF NOT EXISTS laboratory_record_tests (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  laboratory_record_id BIGINT NOT NULL,
  test_id BIGINT NOT NULL,
  requested BOOLEAN NOT NULL DEFAULT TRUE,
  received BOOLEAN NOT NULL DEFAULT FALSE,
  received_at DATETIME NULL,
  received_by BIGINT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_laboratory_record_test (laboratory_record_id, test_id),
  INDEX idx_laboratory_record_tests_record (laboratory_record_id),
  INDEX idx_laboratory_record_tests_test (test_id),
  INDEX idx_laboratory_record_tests_received (received),
  CONSTRAINT fk_laboratory_record_tests_record
    FOREIGN KEY (laboratory_record_id)
    REFERENCES laboratory_records(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_laboratory_record_tests_test
    FOREIGN KEY (test_id)
    REFERENCES laboratory_test_catalog(id),
  CONSTRAINT fk_laboratory_record_tests_received_by
    FOREIGN KEY (received_by)
    REFERENCES users(id)
    ON DELETE SET NULL
);

INSERT INTO laboratory_test_catalog (category, code, name, display_order)
VALUES
  ('Hemograma', 'hemograma_r', 'R', 10),
  ('Hemograma', 'hemograma_n', 'N', 20),
  ('Hemograma', 'hemograma_b', 'B', 30),
  ('Hemograma', 'hemograma_e', 'E', 40),
  ('Hemograma', 'hemograma_hb', 'Hb', 50),
  ('Hemograma', 'hemograma_b2', 'B', 60),
  ('Hemograma', 'hemograma_hto', 'Hto', 70),
  ('Hemograma', 'hemograma_l', 'L', 80),
  ('Hemograma', 'hemograma_plaq', 'Plaq', 90),
  ('Hemograma', 'hemograma_m', 'M', 100),
  ('Hemograma', 'hemograma_ers', 'Ers', 110),
  ('Hemograma', 'hemograma_vcm', 'VCM', 120),
  ('Hemograma', 'hemograma_hcm', 'HCM', 130),
  ('Hemograma', 'hemograma_chcm', 'CHCM', 140),
  ('Serologia', 'serologia_vdrl', 'VDRL', 10),
  ('Serologia', 'serologia_tppa', 'TPPA', 20),
  ('Serologia', 'serologia_toxo', 'Toxo', 30),
  ('Serologia', 'serologia_celiaquia', 'Celiaquia', 40),
  ('Serologia', 'serologia_chagas', 'Chagas', 50),
  ('Serologia', 'serologia_huddleson', 'Huddleson', 60),
  ('Serologia', 'serologia_hiv', 'HIV', 70),
  ('Serologia', 'serologia_monot', 'MonoT', 80),
  ('Serologia', 'serologia_hepb_hepc', 'HepB/HepC', 90),
  ('Hormonas', 'hormonas_tsh_t4_t4l', 'TSH/T4/T4L', 10),
  ('Hormonas', 'hormonas_lh_fsh_e2', 'LH/FSH/E2', 20),
  ('Hormonas', 'hormonas_atg_atpo', 'aTG/aTPO', 30),
  ('Hormonas', 'hormonas_pg_shgb', 'PG/SHGB', 40),
  ('Hormonas', 'hormonas_insulina', 'Insulina', 50),
  ('Hormonas', 'hormonas_prl_testo', 'PRL Testo', 60),
  ('Hormonas', 'hormonas_psa', 'PSA', 70),
  ('Hormonas', 'hormonas_subbhcg', 'subBhcg', 80),
  ('Hormonas', 'hormonas_vitd_vitb12', 'Vit D/VitB12', 90),
  ('Hormonas', 'hormonas_ferritina', 'Ferritina', 100),
  ('Quimica', 'quimica_g', 'G', 10),
  ('Quimica', 'quimica_ca', 'CA', 20),
  ('Quimica', 'quimica_u', 'U', 30),
  ('Quimica', 'quimica_fe', 'Fe', 40),
  ('Quimica', 'quimica_col', 'Col', 50),
  ('Quimica', 'quimica_p', 'P', 60),
  ('Quimica', 'quimica_ac_uri', 'Ac Uri', 70),
  ('Quimica', 'quimica_na', 'Na', 80),
  ('Quimica', 'quimica_ctna', 'Ctna', 90),
  ('Quimica', 'quimica_k', 'K', 100),
  ('Quimica', 'quimica_tgo', 'TGO', 110),
  ('Quimica', 'quimica_ci', 'CI', 120),
  ('Quimica', 'quimica_tgp', 'TGP', 130),
  ('Quimica', 'quimica_pcr', 'PCR', 140),
  ('Quimica', 'quimica_fal', 'FAL', 150),
  ('Quimica', 'quimica_fr_latex', 'FR Latex', 160),
  ('Quimica', 'quimica_bd', 'BD', 170),
  ('Quimica', 'quimica_aslo', 'ASLO', 180),
  ('Quimica', 'quimica_bt', 'BT', 190),
  ('Quimica', 'quimica_bh_glico', 'BH glico', 200),
  ('Quimica', 'quimica_pt', 'PT', 210),
  ('Quimica', 'quimica_ac_biliares', 'Ac Biliares', 220),
  ('Quimica', 'quimica_alb', 'Alb', 230),
  ('Quimica', 'quimica_proteinograma', 'Proteinograma', 240),
  ('Quimica', 'quimica_tg', 'TG', 250),
  ('Quimica', 'quimica_ck', 'CK', 260),
  ('Quimica', 'quimica_hdl', 'HDL', 270),
  ('Quimica', 'quimica_ckmb', 'CKMB', 280),
  ('Quimica', 'quimica_ldl', 'LDL', 290),
  ('Quimica', 'quimica_troponina', 'Troponina', 300),
  ('Quimica', 'quimica_col_no_hdl', 'Col No HDL', 310),
  ('Quimica', 'quimica_riesgo', 'Riesgo', 320),
  ('Quimica', 'quimica_ami', 'Ami', 330),
  ('Quimica', 'quimica_ggt', 'GGT', 340),
  ('Quimica', 'quimica_ldh', 'LDH', 350),
  ('Orina', 'orina_col', 'Col', 10),
  ('Orina', 'orina_glu', 'Glu', 20),
  ('Orina', 'orina_asp', 'Asp', 30),
  ('Orina', 'orina_cet', 'Cet', 40),
  ('Orina', 'orina_sed', 'Sed', 50),
  ('Orina', 'orina_prot', 'Prot', 60),
  ('Orina', 'orina_ph', 'pH', 70),
  ('Orina', 'orina_hem', 'Hem', 80),
  ('Orina', 'orina_dens', 'Dens', 90),
  ('Orina', 'orina_bil', 'Bil', 100),
  ('Orina', 'orina_urob', 'Urob', 110),
  ('Orina', 'orina_cel', 'Cel', 120),
  ('Orina', 'orina_cil', 'Cil', 130),
  ('Orina', 'orina_leu', 'Leu', 140),
  ('Orina', 'orina_hem2', 'Hem', 150),
  ('Orina', 'orina_mucus', 'Mucus', 160),
  ('Orina', 'orina_crist', 'Crist', 170),
  ('Orina', 'orina_pus', 'Pus', 180),
  ('Orina', 'orina_bact', 'Bact', 190),
  ('Orina 24 hs', 'orina24_vol', 'Vol', 10),
  ('Orina 24 hs', 'orina24_creau', 'CreaU', 20),
  ('Orina 24 hs', 'orina24_clearance', 'Clearance', 30),
  ('Orina 24 hs', 'orina24_pu', 'PU', 40),
  ('Orina 24 hs', 'orina24_ureu', 'UreU', 50),
  ('Orina 24 hs', 'orina24_na', 'Na', 60),
  ('Orina 24 hs', 'orina24_k_microalb', 'K Microalb', 70)
ON DUPLICATE KEY UPDATE
  category = VALUES(category),
  name = VALUES(name),
  display_order = VALUES(display_order),
  is_active = TRUE;

UPDATE laboratory_records
SET status =
  CASE
    WHEN pickup_date IS NOT NULL THEN 'retirado'
    WHEN is_complete = TRUE THEN 'completo'
    ELSE 'enviado'
  END;

INSERT INTO permissions (
  permission_key,
  module_name,
  description,
  sort_order
)
VALUES (
  'laboratory.pickup',
  'Laboratorio',
  'Entregar resultados de laboratorio',
  52
)
ON DUPLICATE KEY UPDATE
  module_name = VALUES(module_name),
  description = VALUES(description),
  sort_order = VALUES(sort_order);

INSERT INTO role_permissions (
  role_id,
  permission_id,
  allowed
)
SELECT r.id, p.id, TRUE
FROM roles r
INNER JOIN permissions p
  ON p.permission_key = 'laboratory.pickup'
WHERE r.name IN ('admin', 'lab', 'user')
ON DUPLICATE KEY UPDATE
  allowed = VALUES(allowed);
