export type Medication = {
    id: number;
    name: string;
    generic_name: string;
    presentation: string;
    concentration: string;
    unit: string;
    description: string;
    minimum_stock: number;
    is_active: boolean;
};