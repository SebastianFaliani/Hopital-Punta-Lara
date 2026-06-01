export type MedicationTransferItemInput = {
  medication_batch_id: number;
  quantity: number;
};

export type MedicationTransferInput = {
  source_facility_id: number;
  destination_facility_id: number;
  transfer_date: string;
  notes?: string | null;
  items: MedicationTransferItemInput[];
  created_by?: number | null;
};
