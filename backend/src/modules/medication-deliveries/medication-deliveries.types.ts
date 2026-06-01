export type MedicationDeliveryItemInput = {
  medication_batch_id: number;
  quantity: number;
};

export type MedicationDeliveryReason =
  | 'tratamiento'
  | 'cronico'
  | 'guardia'
  | 'otro';

export type MedicationDeliveryInput = {
  facility_id: number;
  delivery_date: string;
  patient_id?: number | null;
  patient_name: string;
  patient_document?: string | null;
  patient_phone?: string | null;
  delivery_reason: MedicationDeliveryReason;
  notes?: string | null;
  items: MedicationDeliveryItemInput[];
  created_by?: number | null;
};
