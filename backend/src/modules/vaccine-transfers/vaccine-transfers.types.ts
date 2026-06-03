export type VaccineTransferItemInput = {
  vaccine_batch_id: number;
  quantity: number;
};

export type VaccineTransferInput = {
  source_facility_id: number;
  destination_facility_id: number;
  transfer_date: string;
  notes?: string | null;
  created_by?: number | null;
  items: VaccineTransferItemInput[];
};
