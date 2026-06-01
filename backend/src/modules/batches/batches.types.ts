export type MedicationBatch = {
  id: number;
  medication_id: number;
  batch_number: string;
  expiration_date: string;
  current_stock: number;
  purchase_price: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MedicationBatchStock = {
  facility_id: number;
  facility_name: string;
  facility_type: string;
  current_stock: number;
};

export type MedicationBatchInput = {
  batch_number: string;
  expiration_date: string;
  current_stock: number;
  purchase_price?: number | null;
  facility_id?: number | null;
};
