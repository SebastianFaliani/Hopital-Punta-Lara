export type StockMovementType =
  | 'compra'
  | 'donacion'
  | 'ajuste'
  | 'perdida'
  | 'devolucion';

export type StockMovementDirection =
  | 'entrada'
  | 'salida';

export type StockMovementInput = {
  movement_type: StockMovementType;
  movement_direction?: StockMovementDirection;
  quantity: number;
  facility_id?: number | null;
  donor_name?: string | null;
  notes?: string | null;
  created_by?: number | null;
};
