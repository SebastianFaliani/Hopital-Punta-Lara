export type StockMovementType =
  | 'compra'
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
  notes?: string | null;
  created_by?: number | null;
};
