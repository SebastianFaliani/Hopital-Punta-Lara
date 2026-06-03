export type VaccineDeliveryItemInput = {
  vaccine_batch_id: number;
  quantity: number;
};

export type VaccineDeliveryInput = {
  facility_id: number;
  delivery_date: string;
  patient_id?: number | null;
  patient_name: string;
  patient_document?: string | null;
  patient_phone?: string | null;
  delivery_reason: string;
  notes?: string | null;
  created_by?: number | null;
  items: VaccineDeliveryItemInput[];
};
