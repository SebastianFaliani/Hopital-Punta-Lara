export type ChronicPatientInput = {
  full_name: string;
  document_number?: string | null;
  phone?: string | null;
  address?: string | null;
  default_facility_id?: number | null;
  notes?: string | null;
};

export type ChronicPlanItemInput = {
  medication_id: number;
  monthly_quantity: number;
  instructions?: string | null;
};

export type ChronicPackageInput = {
  chronic_patient_id: number;
  facility_id: number;
  package_year: number;
  package_month: number;
  notes?: string | null;
  prepared_by?: number | null;
};

export type ChronicPackageDeliveryItemInput = {
  package_item_id: number;
  medication_batch_id: number;
  delivered_quantity: number;
};

export type ChronicPackageTransferItemInput = {
  package_item_id: number;
  medication_batch_id: number;
  quantity: number;
};
