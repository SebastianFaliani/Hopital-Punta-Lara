export type HealthFacilityType =
  | 'secretaria'
  | 'hospital'
  | 'unidad_sanitaria'
  | 'otro';

export type HealthFacilityInput = {
  name: string;
  facility_type: HealthFacilityType;
  address?: string | null;
  phone?: string | null;
  notes?: string | null;
};
