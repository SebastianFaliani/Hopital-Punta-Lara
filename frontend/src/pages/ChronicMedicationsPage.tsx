import {
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  apiFetch
} from '../api/api';

import {
  useAuth
} from '../auth/useAuth';
import MedicationModuleTabs from '../components/medications/MedicationModuleTabs';

type Facility = {
  id: number;
  name: string;
  facility_type: string;
};

type Medication = {
  id: number;
  name: string;
  generic_name: string | null;
  presentation: string | null;
  concentration: string | null;
};

type FacilityStock = {
  medication_batch_id: number;
  batch_number: string;
  expiration_date: string;
  current_stock: number;
  medication_id: number;
  medication_name: string;
  concentration: string | null;
  presentation: string | null;
};

type ChronicPatient = {
  id: number;
  full_name: string;
  document_number: string | null;
  phone: string | null;
  default_facility_id: number | null;
  default_facility_name: string | null;
  is_active: boolean;
  active_plan_items: number;
  pending_packages: number;
};

type PlanItem = {
  id: number;
  medication_id: number;
  medication_name: string;
  presentation: string | null;
  concentration: string | null;
  monthly_quantity: number;
  instructions: string | null;
  is_active: boolean;
};

type ChronicPackage = {
  id: number;
  facility_id: number;
  facility_name: string;
  package_year: number;
  package_month: number;
  status: string;
  delivered_at: string | null;
  not_picked_up_at: string | null;
  medication_transfer_id: number | null;
  medication_transfer_status: string | null;
  medication_delivery_id: number | null;
};

type PatientDetail = ChronicPatient & {
  address: string | null;
  notes: string | null;
  plan_items: PlanItem[];
  packages: ChronicPackage[];
};

type PackageDetail = {
  id: number;
  chronic_patient_id: number;
  patient_name: string;
  facility_id: number;
  facility_name: string;
  package_year: number;
  package_month: number;
  status: string;
  medication_transfer_id: number | null;
  medication_transfer_status: string | null;
  items: Array<{
    id: number;
    medication_id: number;
    medication_name: string;
    presentation: string | null;
    concentration: string | null;
    planned_quantity: number;
    delivered_quantity: number | null;
    item_status: string;
    medication_batch_id: number | null;
    batch_number: string | null;
  }>;
};

const emptyPatientForm = {
  full_name: '',
  document_number: '',
  phone: '',
  address: '',
  default_facility_id: '',
  notes: ''
};

const packageStatusLabels: Record<string, string> = {
  preparado: 'Preparado',
  enviado: 'Enviado',
  recibido: 'Recibido',
  parcial: 'Parcial',
  retirado: 'Retirado',
  no_retirado: 'No retirado',
  devuelto: 'Devuelto',
  cancelado: 'Cancelado'
};

function currentYear() {
  return new Date().getFullYear();
}

function currentMonth() {
  return new Date().getMonth() + 1;
}

function medicationLabel(
  medication: Medication
) {

  return [
    medication.name,
    medication.concentration,
    medication.presentation
  ]
    .filter(Boolean)
    .join(' - ');
}

function stockLabel(
  stock: FacilityStock
) {

  return [
    stock.medication_name,
    stock.concentration,
    stock.presentation,
    `lote ${stock.batch_number}`,
    `stock ${Number(stock.current_stock)}`
  ]
    .filter(Boolean)
    .join(' - ');
}

function showSystemAlert(
  message: string,
  title = 'Aviso del sistema',
  variant: 'error' | 'success' | 'info' = 'error'
) {

  window.dispatchEvent(
    new CustomEvent(
      'hospital-system-alert',
      {
        detail: {
          title,
          message,
          variant
        }
      }
    )
  );
}

export default function ChronicMedicationsPage() {

  const { user } =
    useAuth();

  const canEdit =
    user?.role === 'admin' ||
    user?.role === 'farmacia';

  const [facilities, setFacilities] =
    useState<Facility[]>([]);

  const [medications, setMedications] =
    useState<Medication[]>([]);

  const [patients, setPatients] =
    useState<ChronicPatient[]>([]);

  const [selectedPatient, setSelectedPatient] =
    useState<PatientDetail | null>(null);

  const [selectedPackage, setSelectedPackage] =
    useState<PackageDetail | null>(null);

  const [facilityStocks, setFacilityStocks] =
    useState<FacilityStock[]>([]);

  const [filters, setFilters] =
    useState({
      search: '',
      status: 'activos'
    });

  const [patientForm, setPatientForm] =
    useState(emptyPatientForm);

  const [planForm, setPlanForm] =
    useState({
      medication_id: '',
      monthly_quantity: 1,
      instructions: ''
    });

  const [packageForm, setPackageForm] =
    useState({
      facility_id: '',
      package_year: currentYear(),
      package_month: currentMonth(),
      notes: ''
    });

  const [deliveryItems, setDeliveryItems] =
    useState<Record<number, {
      medication_batch_id: string;
      delivered_quantity: number;
    }>>({});

  const [relocateFacilityId, setRelocateFacilityId] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  function showPageMessage(
    message: string,
    title = 'Aviso del sistema',
    variant: 'error' | 'success' | 'info' = 'error'
  ) {

    setError(message);
    showSystemAlert(
      message,
      title,
      variant
    );
  }

  const totalPending =
    patients.reduce(
      (total, patient) =>
        total + Number(patient.pending_packages || 0),
      0
    );

  const activePatients =
    patients.filter((patient) =>
      patient.is_active
    ).length;

  const userFacility =
    facilities.find((facility) =>
      facility.id === user?.facility_id
    );

  const canPreparePackages =
    canEdit &&
    (
      user?.role === 'admin' ||
      !user?.facility_id ||
      user?.facility_type === 'secretaria' ||
      userFacility?.facility_type === 'secretaria'
    );

  const stocksByMedication =
    useMemo(() => {
      const map =
        new Map<number, FacilityStock[]>();

      facilityStocks.forEach((stock) => {
        const medicationId =
          Number(stock.medication_id);

        map.set(
          medicationId,
          [
            ...(map.get(medicationId) || []),
            stock
          ]
        );
      });

      return map;
    }, [facilityStocks]);

  async function loadBaseData() {

    const [facilitiesRes, medicationsRes] =
      await Promise.all([
        apiFetch('/health-facilities'),
        apiFetch('/medications')
      ]);

    setFacilities(facilitiesRes.data);
    setMedications(medicationsRes.data);
  }

  async function loadPatients() {

    try {

      const params =
        new URLSearchParams();

      params.set('status', filters.status);

      if (filters.search.trim()) {
        params.set(
          'search',
          filters.search.trim()
        );
      }

      const res =
        await apiFetch(
          `/chronic-medications?${params.toString()}`
        );

      setPatients(res.data);

    } catch (error: any) {

      showPageMessage(error.message);
    }
  }

  async function loadPatientDetail(
    id: number
  ) {

    const res =
      await apiFetch(
        `/chronic-medications/${id}`
      );

    setSelectedPatient(res.data);

    setPackageForm((current) => ({
      ...current,
      facility_id:
        res.data.default_facility_id
          ? String(res.data.default_facility_id)
          : current.facility_id
    }));
  }

  async function loadPackageDetail(
    id: number
  ) {

    const res =
      await apiFetch(
        `/chronic-medications/packages/${id}`
      );

    setSelectedPackage(res.data);
    setRelocateFacilityId('');

    const secretary =
      facilities.find((facility) =>
        facility.facility_type === 'secretaria'
      );

    const stockFacilityId =
      canPreparePackages &&
      (
        res.data.status === 'preparado' ||
        res.data.status === 'parcial'
      ) &&
      secretary
        ? secretary.id
        : res.data.facility_id;

    const stocksRes =
      await apiFetch(
        `/medication-transfers/facility-stocks?facility_id=${stockFacilityId}`
      );

    setFacilityStocks(stocksRes.data);

    const nextItems: Record<number, {
      medication_batch_id: string;
      delivered_quantity: number;
    }> = {};

    res.data.items.forEach((item: PackageDetail['items'][number]) => {
      nextItems[item.id] = {
        medication_batch_id:
          item.medication_batch_id
            ? String(item.medication_batch_id)
            : '',
        delivered_quantity:
          Number(item.delivered_quantity || item.planned_quantity)
      };
    });

    setDeliveryItems(nextItems);
  }

  async function handleCreatePatient(
    e: React.FormEvent
  ) {

    e.preventDefault();

    try {

      setLoading(true);
      setError('');

      await apiFetch(
        '/chronic-medications',
        {
          method: 'POST',
          body: JSON.stringify({
            ...patientForm,
            default_facility_id:
              patientForm.default_facility_id
                ? Number(patientForm.default_facility_id)
                : null
          })
        }
      );

      setPatientForm(emptyPatientForm);
      await loadPatients();

    } catch (error: any) {

      showPageMessage(error.message);

    } finally {

      setLoading(false);
    }
  }

  async function handleAddPlanItem(
    e: React.FormEvent
  ) {

    e.preventDefault();

    if (!selectedPatient) {
      return;
    }

    try {

      setLoading(true);
      setError('');

      await apiFetch(
        `/chronic-medications/${selectedPatient.id}/plan-items`,
        {
          method: 'POST',
          body: JSON.stringify({
            ...planForm,
            medication_id:
              Number(planForm.medication_id),
            monthly_quantity:
              Number(planForm.monthly_quantity)
          })
        }
      );

      setPlanForm({
        medication_id: '',
        monthly_quantity: 1,
        instructions: ''
      });

      await loadPatientDetail(selectedPatient.id);

    } catch (error: any) {

      showPageMessage(error.message);

    } finally {

      setLoading(false);
    }
  }

  async function togglePlanItem(
    itemId: number
  ) {

    if (!selectedPatient) {
      return;
    }

    try {

      setLoading(true);
      setError('');

      await apiFetch(
        `/chronic-medications/plan-items/${itemId}/toggle`,
        {
          method: 'PATCH'
        }
      );

      await loadPatientDetail(selectedPatient.id);
      await loadPatients();

    } catch (error: any) {

      showPageMessage(error.message);

    } finally {

      setLoading(false);
    }
  }

  async function createPackage() {

    if (!selectedPatient) {
      return;
    }

    try {

      setLoading(true);
      setError('');

      await apiFetch(
        '/chronic-medications/packages',
        {
          method: 'POST',
          body: JSON.stringify({
            chronic_patient_id:
              selectedPatient.id,
            ...packageForm,
            facility_id:
              Number(packageForm.facility_id),
            package_year:
              Number(packageForm.package_year),
            package_month:
              Number(packageForm.package_month)
          })
        }
      );

      await loadPatientDetail(selectedPatient.id);
      await loadPatients();

    } catch (error: any) {

      showPageMessage(error.message);

    } finally {

      setLoading(false);
    }
  }

  async function markNotPickedUp(
    packageId: number
  ) {

    if (!selectedPatient) {
      return;
    }

    await apiFetch(
      `/chronic-medications/packages/${packageId}/not-picked-up`,
      {
        method: 'PATCH'
      }
    );

    await loadPatientDetail(selectedPatient.id);
    await loadPatients();
  }

  async function deliverPackage() {

    if (!selectedPackage || !selectedPatient) {
      return;
    }

    try {

      setLoading(true);
      setError('');

      const selectedItems =
        selectedPackage.items.filter((item) =>
          item.item_status === 'enviado' &&
          Number(deliveryItems[item.id]?.medication_batch_id) > 0 &&
          Number(deliveryItems[item.id]?.delivered_quantity) > 0
        );

      if (selectedItems.length === 0) {
        showPageMessage(
          'No seleccionaste ningun medicamento para retirar'
        );
        setLoading(false);
        return;
      }

      await apiFetch(
        `/chronic-medications/packages/${selectedPackage.id}/deliver`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            items:
              selectedItems.map((item) => ({
                package_item_id:
                  item.id,
                medication_batch_id:
                  Number(deliveryItems[item.id]?.medication_batch_id),
                delivered_quantity:
                  Number(deliveryItems[item.id]?.delivered_quantity)
              }))
          })
        }
      );

      setSelectedPackage(null);
      await loadPatientDetail(selectedPatient.id);
      await loadPatients();

    } catch (error: any) {

      showPageMessage(error.message);

    } finally {

      setLoading(false);
    }
  }

  async function sendPackage() {

    if (!selectedPackage || !selectedPatient) {
      return;
    }

    try {

      setLoading(true);
      setError('');

      const selectedItems =
        selectedPackage.items.filter((item) =>
          item.item_status === 'pendiente' &&
          Number(deliveryItems[item.id]?.medication_batch_id) > 0 &&
          Number(deliveryItems[item.id]?.delivered_quantity) > 0
        );

      const exceededStockItems =
        selectedItems.filter((item) => {
          const batchId =
            Number(deliveryItems[item.id]?.medication_batch_id);
          const quantity =
            Number(deliveryItems[item.id]?.delivered_quantity);
          const stock =
            facilityStocks.find((stockItem) =>
              Number(stockItem.medication_batch_id) === batchId
            );

          return stock &&
            quantity > Number(stock.current_stock);
        });

      if (exceededStockItems.length > 0) {
        showPageMessage(
          `La cantidad supera el stock disponible en: ${
            exceededStockItems
              .map((item) => item.medication_name)
              .join(', ')
          }`
        );
        setLoading(false);
        return;
      }

      const missingItems =
        selectedPackage.items.filter((item) =>
          item.item_status === 'pendiente' &&
          !selectedItems.some((selected) =>
            selected.id === item.id
          )
        );

      if (selectedItems.length === 0) {
        showPageMessage(
          `No hay stock seleccionado para enviar. Falta: ${
            missingItems
              .map((item) => item.medication_name)
              .join(', ')
          }`
        );
        setLoading(false);
        return;
      }

      await apiFetch(
        `/chronic-medications/packages/${selectedPackage.id}/send`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            items:
              selectedItems.map((item) => ({
                package_item_id:
                  item.id,
                medication_batch_id:
                  Number(deliveryItems[item.id]?.medication_batch_id),
                quantity:
                  Number(deliveryItems[item.id]?.delivered_quantity)
              }))
          })
        }
      );

      setSelectedPackage(null);
      await loadPatientDetail(selectedPatient.id);
      await loadPatients();

      if (missingItems.length > 0) {
        showPageMessage(
          `Envio parcial. Queda pendiente: ${
            missingItems
              .map((item) => item.medication_name)
              .join(', ')
          }`,
          'Envio parcial',
          'info'
        );
      }

    } catch (error: any) {

      showPageMessage(error.message);

    } finally {

      setLoading(false);
    }
  }

  async function receivePackageTransfer() {

    if (!selectedPackage || !selectedPatient) {
      return;
    }

    try {

      setLoading(true);
      setError('');

      await apiFetch(
        `/chronic-medications/packages/${selectedPackage.id}/receive-transfer`,
        {
          method: 'PATCH'
        }
      );

      await loadPackageDetail(selectedPackage.id);
      await loadPatientDetail(selectedPatient.id);
      await loadPatients();

    } catch (error: any) {

      showPageMessage(error.message);

    } finally {

      setLoading(false);
    }
  }

  async function reopenPackage(
    packageId: number
  ) {

    if (!selectedPatient) {
      return;
    }

    try {

      setLoading(true);
      setError('');

      await apiFetch(
        `/chronic-medications/packages/${packageId}/reopen`,
        {
          method: 'PATCH'
        }
      );

      setSelectedPackage(null);
      await loadPatientDetail(selectedPatient.id);
      await loadPatients();

    } catch (error: any) {

      showPageMessage(error.message);

    } finally {

      setLoading(false);
    }
  }

  async function returnPackage(
    packageId: number
  ) {

    if (!selectedPatient) {
      return;
    }

    try {

      setLoading(true);
      setError('');

      await apiFetch(
        `/chronic-medications/packages/${packageId}/return`,
        {
          method: 'PATCH'
        }
      );

      setSelectedPackage(null);
      await loadPatientDetail(selectedPatient.id);
      await loadPatients();

    } catch (error: any) {

      showPageMessage(error.message);

    } finally {

      setLoading(false);
    }
  }

  async function relocatePackage(
    packageId: number
  ) {

    if (!selectedPatient) {
      return;
    }

    try {

      setLoading(true);
      setError('');

      await apiFetch(
        `/chronic-medications/packages/${packageId}/relocate`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            destination_facility_id:
              Number(relocateFacilityId)
          })
        }
      );

      setSelectedPackage(null);
      await loadPatientDetail(selectedPatient.id);
      await loadPatients();

    } catch (error: any) {

      showPageMessage(error.message);

    } finally {

      setLoading(false);
    }
  }

  useEffect(() => {

    loadBaseData();

  }, []);

  useEffect(() => {

    loadPatients();

  }, [
    filters.search,
    filters.status
  ]);

  return (

    <div>

      <div className="page-header">

        <div>

          <h1 className="page-title">
            Pacientes cronicos
          </h1>

          <p className="page-subtitle">
            Plan mensual, paquetes preparados y retiros pendientes.
          </p>

        </div>

      </div>

      <MedicationModuleTabs />

      {error && (
        <p className="auth-error">
          {error}
        </p>
      )}

      <div className="dashboard-grid">

        <div className="dashboard-card">
          <h3>Pacientes activos</h3>
          <p>{activePatients}</p>
          <span>Con seguimiento cronico</span>
        </div>

        <div className="dashboard-card">
          <h3>Pendientes</h3>
          <p>{totalPending}</p>
          <span>Paquetes sin retirar</span>
        </div>

        <div className="dashboard-card">
          <h3>Planes</h3>
          <p>
            {
              patients.reduce(
                (total, patient) =>
                  total + Number(patient.active_plan_items || 0),
                0
              )
            }
          </p>
          <span>Medicaciones activas</span>
        </div>

      </div>

      {canEdit && (

        <form
          className="dashboard-panel auth-form"
          onSubmit={handleCreatePatient}
        >

          <h2>Nuevo paciente cronico</h2>

          <div className="filter-bar">

            <input
              className="form-input"
              placeholder="Nombre y apellido"
              value={patientForm.full_name}
              onChange={(e) =>
                setPatientForm({
                  ...patientForm,
                  full_name: e.target.value
                })
              }
            />

            <input
              className="form-input"
              placeholder="DNI"
              value={patientForm.document_number}
              onChange={(e) =>
                setPatientForm({
                  ...patientForm,
                  document_number: e.target.value
                })
              }
            />

            <input
              className="form-input"
              placeholder="Telefono"
              value={patientForm.phone}
              onChange={(e) =>
                setPatientForm({
                  ...patientForm,
                  phone: e.target.value
                })
              }
            />

          </div>

          <div className="filter-bar">

            <select
              className="form-input"
              value={patientForm.default_facility_id}
              onChange={(e) =>
                setPatientForm({
                  ...patientForm,
                  default_facility_id: e.target.value
                })
              }
            >
              <option value="">
                Punto de retiro habitual
              </option>

              {facilities.map((facility) => (
                <option
                  key={facility.id}
                  value={facility.id}
                >
                  {facility.name}
                </option>
              ))}
            </select>

            <input
              className="form-input"
              placeholder="Direccion"
              value={patientForm.address}
              onChange={(e) =>
                setPatientForm({
                  ...patientForm,
                  address: e.target.value
                })
              }
            />

          </div>

          <textarea
            className="form-input"
            placeholder="Observaciones"
            rows={2}
            value={patientForm.notes}
            onChange={(e) =>
              setPatientForm({
                ...patientForm,
                notes: e.target.value
              })
            }
          />

          <div className="modal-actions">
            <button
              type="submit"
              className="btn-success"
              disabled={loading}
            >
              Guardar paciente
            </button>
          </div>

        </form>
      )}

      <div className="filter-bar">

        <input
          className="form-input"
          placeholder="Buscar por nombre, DNI o punto"
          value={filters.search}
          onChange={(e) =>
            setFilters({
              ...filters,
              search: e.target.value
            })
          }
        />

        <select
          className="form-input"
          value={filters.status}
          onChange={(e) =>
            setFilters({
              ...filters,
              status: e.target.value
            })
          }
        >
          <option value="todos">
            Todos
          </option>
          <option value="activos">
            Activos
          </option>
          <option value="inactivos">
            Inactivos
          </option>
        </select>

      </div>

      <div className="table-container">

        <table className="data-table">

          <thead>
            <tr>
              <th>Paciente</th>
              <th>DNI</th>
              <th>Telefono</th>
              <th>Punto habitual</th>
              <th>Plan</th>
              <th>Pendientes</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {patients.map((patient) => (
              <tr key={patient.id}>
                <td>{patient.full_name}</td>
                <td>{patient.document_number || '-'}</td>
                <td>{patient.phone || '-'}</td>
                <td>{patient.default_facility_name || '-'}</td>
                <td>{Number(patient.active_plan_items || 0)}</td>
                <td>{Number(patient.pending_packages || 0)}</td>
                <td>
                  <span
                    className={
                      patient.is_active
                        ? 'badge badge-success'
                        : 'badge badge-danger'
                    }
                  >
                    {
                      patient.is_active
                        ? 'Activo'
                        : 'Inactivo'
                    }
                  </span>
                </td>
                <td>
                  <button
                    className="btn-secondary"
                    onClick={() =>
                      loadPatientDetail(patient.id)
                    }
                  >
                    Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>

        </table>

      </div>

      {selectedPatient && (

        <div className="modal-overlay">

          <div className="modal-content modal-content-wide">

            <button
              type="button"
              className="modal-close-button"
              onClick={() =>
                setSelectedPatient(null)
              }
              aria-label="Cerrar"
            >
              X
            </button>

            <h2 className="modal-title">
              {selectedPatient.full_name}
            </h2>

            <p className="page-subtitle">
              {selectedPatient.document_number || 'Sin DNI'} - {selectedPatient.default_facility_name || 'Sin punto habitual'}
            </p>

            {canEdit && (

              <form
                className="auth-form"
                onSubmit={handleAddPlanItem}
              >
                <h3>Plan mensual</h3>

                <div className="filter-bar">

                  <select
                    className="form-input"
                    value={planForm.medication_id}
                    onChange={(e) =>
                      setPlanForm({
                        ...planForm,
                        medication_id: e.target.value
                      })
                    }
                  >
                    <option value="">
                      Medicamento
                    </option>

                    {medications.map((medication) => (
                      <option
                        key={medication.id}
                        value={medication.id}
                      >
                        {medicationLabel(medication)}
                      </option>
                    ))}
                  </select>

                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={planForm.monthly_quantity}
                    onChange={(e) =>
                      setPlanForm({
                        ...planForm,
                        monthly_quantity: Number(e.target.value)
                      })
                    }
                  />

                  <input
                    className="form-input"
                    placeholder="Indicaciones"
                    value={planForm.instructions}
                    onChange={(e) =>
                      setPlanForm({
                        ...planForm,
                        instructions: e.target.value
                      })
                    }
                  />

                  <button
                    className="btn-success"
                    type="submit"
                  >
                    Agregar
                  </button>

                </div>
              </form>
            )}

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medicamento</th>
                    <th>Cantidad mensual</th>
                    <th>Indicaciones</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPatient.plan_items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {[
                          item.medication_name,
                          item.concentration,
                          item.presentation
                        ]
                          .filter(Boolean)
                          .join(' - ')}
                      </td>
                      <td>{Number(item.monthly_quantity)}</td>
                      <td>{item.instructions || '-'}</td>
                      <td>
                        <span
                          className={
                            item.is_active
                              ? 'badge badge-success'
                              : 'badge badge-danger'
                          }
                        >
                          {
                            item.is_active
                              ? 'Activo'
                              : 'Inactivo'
                          }
                        </span>
                      </td>
                      <td>
                        {canEdit && (
                          <button
                            className={
                              item.is_active
                                ? 'btn-danger'
                                : 'btn-success'
                            }
                            onClick={() =>
                              togglePlanItem(item.id)
                            }
                          >
                            {
                              item.is_active
                                ? 'Quitar'
                                : 'Reactivar'
                            }
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {canPreparePackages && (
              <div className="dashboard-panel auth-form">
                <h3>Crear paquete mensual</h3>
                <div className="filter-bar">
                  <select
                    className="form-input"
                    value={packageForm.facility_id}
                    onChange={(e) =>
                      setPackageForm({
                        ...packageForm,
                        facility_id: e.target.value
                      })
                    }
                  >
                    <option value="">
                      Punto de retiro
                    </option>
                    {facilities.map((facility) => (
                      <option
                        key={facility.id}
                        value={facility.id}
                      >
                        {facility.name}
                      </option>
                    ))}
                  </select>

                  <input
                    className="form-input"
                    type="number"
                    min="2020"
                    value={packageForm.package_year}
                    onChange={(e) =>
                      setPackageForm({
                        ...packageForm,
                        package_year: Number(e.target.value)
                      })
                    }
                  />

                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    max="12"
                    value={packageForm.package_month}
                    onChange={(e) =>
                      setPackageForm({
                        ...packageForm,
                        package_month: Number(e.target.value)
                      })
                    }
                  />

                  <button
                    className="btn-success"
                    type="button"
                    disabled={loading}
                    onClick={createPackage}
                  >
                    Crear paquete
                  </button>
                </div>
              </div>
            )}

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Punto</th>
                    <th>Estado</th>
                    <th>Traslado</th>
                    <th>Entrega</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPatient.packages.map((item) => (
                    <tr key={item.id}>
                      <td>{item.package_month}/{item.package_year}</td>
                      <td>{item.facility_name}</td>
                      <td>
                        <span
                          className={
                            item.status === 'retirado'
                              ? 'badge badge-success'
                              : item.status === 'recibido'
                                ? 'badge badge-info'
                              : item.status === 'preparado' ||
                                item.status === 'enviado' ||
                                item.status === 'parcial'
                                ? 'badge badge-warning'
                                : item.status === 'devuelto'
                                  ? 'badge'
                                  : 'badge badge-danger'
                          }
                        >
                          {packageStatusLabels[item.status]}
                        </span>
                      </td>
                      <td>
                        {
                          item.medication_transfer_id
                            ? `#${item.medication_transfer_id} (${item.medication_transfer_status || '-'})`
                            : '-'
                        }
                      </td>
                      <td>
                        {
                          item.medication_delivery_id
                            ? `#${item.medication_delivery_id}`
                            : '-'
                        }
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="btn-secondary"
                            onClick={() =>
                              loadPackageDetail(item.id)
                            }
                          >
                            Ver
                          </button>
                          {canEdit && item.status === 'preparado' && (
                            <button
                              className="btn-danger"
                              onClick={() =>
                                markNotPickedUp(item.id)
                              }
                            >
                              No retiro
                            </button>
                          )}
                          {canEdit && item.status === 'no_retirado' && (
                            <button
                              className="btn-success"
                              onClick={() =>
                                reopenPackage(item.id)
                              }
                            >
                              Reabrir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

      {selectedPackage && (
        <div className="modal-overlay">
          <div className="modal-content modal-content-wide">

            <button
              type="button"
              className="modal-close-button"
              onClick={() =>
                setSelectedPackage(null)
              }
              aria-label="Cerrar"
            >
              X
            </button>

            <h2 className="modal-title">
              Paquete {selectedPackage.package_month}/{selectedPackage.package_year}
            </h2>
            <p className="page-subtitle">
              {selectedPackage.patient_name} - {selectedPackage.facility_name}
              {selectedPackage.medication_transfer_id
                ? ` - Traslado #${selectedPackage.medication_transfer_id} (${selectedPackage.medication_transfer_status || '-'})`
                : ''}
            </p>

            {selectedPackage.status === 'enviado' &&
              selectedPackage.medication_transfer_status === 'enviado' && (
              <p className="auth-error">
                El paquete esta en camino. Primero hay que recibir el traslado para que el stock entre al punto de retiro.
              </p>
            )}

            {selectedPackage.items.some((item) =>
              item.item_status === 'pendiente'
            ) && (
              <div className="package-missing-alert">
                <strong>Medicacion pendiente:</strong>{' '}
                {
                  selectedPackage.items
                    .filter((item) =>
                      item.item_status === 'pendiente'
                    )
                    .map((item) =>
                      item.medication_name
                    )
                    .join(', ')
                }
              </div>
            )}

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medicamento</th>
                    <th>Planificado</th>
                    <th>
                      {
                        canPreparePackages &&
                        (
                          selectedPackage.status === 'preparado' ||
                          selectedPackage.status === 'parcial'
                        )
                          ? 'Lote desde Secretaria'
                          : 'Lote enviado'
                      }
                    </th>
                    <th>
                      {
                        canPreparePackages &&
                        (
                          selectedPackage.status === 'preparado' ||
                          selectedPackage.status === 'parcial'
                        )
                          ? 'Cantidad a enviar'
                          : 'Cantidad'
                      }
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPackage.items.map((item) => {
                    const availableStocks =
                      stocksByMedication.get(
                        Number(item.medication_id)
                      ) || [];

                    return (
                      <tr
                        key={item.id}
                        className={
                          item.item_status === 'pendiente'
                            ? 'package-item-missing-row'
                            : ''
                        }
                      >
                        <td>
                          <div className="package-medication-cell">
                            <span>
                              {[
                                item.medication_name,
                                item.concentration,
                                item.presentation
                              ]
                                .filter(Boolean)
                                .join(' - ')}
                            </span>

                            {item.item_status === 'pendiente' && (
                              <span className="badge badge-warning">
                                Falta enviar
                              </span>
                            )}

                            {item.item_status === 'retirado' && (
                              <span className="badge badge-success">
                                Retirado
                              </span>
                            )}
                          </div>
                        </td>
                        <td>{Number(item.planned_quantity)}</td>
                        <td>
                          <select
                            className="form-input"
                            value={deliveryItems[item.id]?.medication_batch_id || ''}
                            onChange={(e) =>
                              setDeliveryItems({
                                ...deliveryItems,
                                [item.id]: {
                                  ...deliveryItems[item.id],
                                  medication_batch_id: e.target.value
                                }
                              })
                            }
                            disabled={
                              !canPreparePackages ||
                              selectedPackage.status !== 'preparado' &&
                              selectedPackage.status !== 'parcial' ||
                              item.item_status !== 'pendiente'
                            }
                          >
                            <option value="">
                              Seleccionar lote
                            </option>
                            {item.medication_batch_id && (
                              <option value={item.medication_batch_id}>
                                Lote {item.batch_number || item.medication_batch_id}
                              </option>
                            )}
                            {availableStocks.map((stock) => (
                              <option
                                key={stock.medication_batch_id}
                                value={stock.medication_batch_id}
                              >
                                {stockLabel(stock)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            className="form-input"
                            type="number"
                            min="0"
                            max={
                              canPreparePackages &&
                              item.item_status === 'pendiente'
                                ? (
                                  availableStocks.find((stock) =>
                                    Number(stock.medication_batch_id) ===
                                    Number(deliveryItems[item.id]?.medication_batch_id)
                                  )?.current_stock || undefined
                                )
                                : undefined
                            }
                            step="0.01"
                            value={deliveryItems[item.id]?.delivered_quantity || 0}
                            onChange={(e) =>
                              setDeliveryItems({
                                ...deliveryItems,
                                [item.id]: {
                                  ...deliveryItems[item.id],
                                  delivered_quantity: Number(e.target.value)
                                }
                              })
                            }
                            disabled={
                              !canPreparePackages ||
                              selectedPackage.status !== 'preparado' &&
                              selectedPackage.status !== 'parcial' ||
                              item.item_status !== 'pendiente'
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="modal-actions">
              {canEdit && selectedPackage.status === 'no_retirado' && (
                <button
                  className="btn-success"
                  disabled={loading}
                  onClick={() =>
                    reopenPackage(selectedPackage.id)
                  }
                >
                  Reabrir
                </button>
              )}

              {canEdit && selectedPackage.status === 'no_retirado' && (
                <button
                  className="btn-secondary"
                  disabled={loading}
                  onClick={() =>
                    returnPackage(selectedPackage.id)
                  }
                >
                  Devolver a Secretaria
                </button>
              )}

              {canPreparePackages &&
                (
                  selectedPackage.status === 'preparado' ||
                  selectedPackage.status === 'parcial'
                ) &&
                facilities.find((facility) =>
                  facility.id === selectedPackage.facility_id
                )?.facility_type !== 'secretaria' && (
                <button
                  className="btn-success"
                  disabled={loading}
                  onClick={sendPackage}
                >
                  Enviar a unidad
                </button>
              )}

              {canEdit &&
                selectedPackage.status === 'enviado' &&
                selectedPackage.medication_transfer_status === 'enviado' && (
                user?.role === 'admin' ||
                user?.facility_type !== 'secretaria'
              ) && (
                <button
                  className="btn-success"
                  disabled={loading}
                  onClick={receivePackageTransfer}
                >
                  Recibir traslado
                </button>
              )}

              {canEdit &&
                (
                  (
                    selectedPackage.status === 'enviado' &&
                    selectedPackage.medication_transfer_status === 'recibido'
                  ) ||
                  selectedPackage.status === 'recibido' ||
                  (
                    selectedPackage.status === 'parcial' &&
                    selectedPackage.medication_transfer_status === 'recibido'
                  ) ||
                  (
                    selectedPackage.status === 'preparado' &&
                    facilities.find((facility) =>
                      facility.id === selectedPackage.facility_id
                    )?.facility_type === 'secretaria'
                  ) ||
                  (
                    selectedPackage.status === 'parcial' &&
                    facilities.find((facility) =>
                      facility.id === selectedPackage.facility_id
                    )?.facility_type === 'secretaria'
                  )
                ) && (
                <button
                  className="btn-success"
                  disabled={loading}
                  onClick={deliverPackage}
                >
                  Marcar retirado
                </button>
              )}
            </div>

            {canEdit && selectedPackage.status === 'no_retirado' && (
              <div className="filter-bar">
                <select
                  className="form-input"
                  value={relocateFacilityId}
                  onChange={(e) =>
                    setRelocateFacilityId(e.target.value)
                  }
                >
                  <option value="">
                    Trasladar a otro punto
                  </option>
                  {facilities
                    .filter((facility) =>
                      facility.id !== selectedPackage.facility_id
                    )
                    .map((facility) => (
                      <option
                        key={facility.id}
                        value={facility.id}
                      >
                        {facility.name}
                      </option>
                    ))}
                </select>

                <button
                  className="btn-success"
                  disabled={
                    loading ||
                    !relocateFacilityId
                  }
                  onClick={() =>
                    relocatePackage(selectedPackage.id)
                  }
                >
                  Trasladar paquete
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
