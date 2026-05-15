import {
  Link
} from 'react-router-dom';

import {
  useEffect,
  useState
} from 'react';

import { apiFetch } from '../api/api';
import { useAuth } from '../auth/useAuth';
import CreateMedicationModal from '../components/medications/CreateMedicationModal';
import EditMedicationModal from '../components/medications/EditMedicationModal';

type Medication = {
  id: number;
  name: string;
  generic_name: string;
  presentation: string;
  concentration: string;
  unit: string;
  description: string;
  minimum_stock: number;
  total_stock: number;
  is_active: boolean;
};

export default function MedicationsPage() {

  const { user } = useAuth();

  const [medications, setMedications] =
    useState<Medication[]>([]);

  const [openCreateModal, setOpenCreateModal] =
    useState(false);

  const [selectedMedication,
    setSelectedMedication] =
    useState<Medication | null>(null);

  const [filters, setFilters] =
    useState({
      search: '',
      presentation: 'todas',
      unit: 'todas',
      status: 'todos',
      stock: 'todos'
    });


  async function loadMedications() {

    try {

      const res =
        await apiFetch('/medications');

      setMedications(res.data);

    } catch (error) {

      console.error(error);
    }
  }

  useEffect(() => {

    loadMedications();

  }, []);

  async function handleToggle(
    id: number
  ) {

    try {

      await apiFetch(
        `/medications/${id}/toggle`,
        {
          method: 'PATCH'
        }
      );

      loadMedications();

    } catch (error) {

      console.error(error);
    }
  }

  if (!user) {

    return null;
  }

  const presentations =
    Array.from(
      new Set(
        medications
          .map((m) => m.presentation)
          .filter(Boolean)
      )
    );

  const units =
    Array.from(
      new Set(
        medications
          .map((m) => m.unit)
          .filter(Boolean)
      )
    );

  const filteredMedications =
    medications.filter((m) => {

      const search =
        filters.search.toLowerCase();

      const matchesSearch =
        m.name
          .toLowerCase()
          .includes(search) ||
        (m.generic_name || '')
          .toLowerCase()
          .includes(search) ||
        (m.concentration || '')
          .toLowerCase()
          .includes(search);

      const matchesPresentation =
        filters.presentation === 'todas' ||
        m.presentation === filters.presentation;

      const matchesUnit =
        filters.unit === 'todas' ||
        m.unit === filters.unit;

      const matchesStatus =
        filters.status === 'todos' ||
        (
          filters.status === 'activo' &&
          m.is_active
        ) ||
        (
          filters.status === 'inactivo' &&
          !m.is_active
        );

      const totalStock =
        Number(m.total_stock || 0);

      const minimumStock =
        Number(m.minimum_stock || 0);

      const matchesStock =
        filters.stock === 'todos' ||
        (
          filters.stock === 'bajo' &&
          totalStock <= minimumStock
        ) ||
        (
          filters.stock === 'sin_stock' &&
          totalStock <= 0
        ) ||
        (
          filters.stock === 'con_stock' &&
          totalStock > minimumStock
        );

      return (
        matchesSearch &&
        matchesPresentation &&
        matchesUnit &&
        matchesStatus &&
        matchesStock
      );
    });

  return (

    <div>

      <div className="page-header">

        <h1 className="page-title">
          Medicamentos
        </h1>

        <button
          className="btn-primary"
          onClick={() =>
            setOpenCreateModal(true)
          }
        >
          + Nuevo medicamento
        </button>

      </div>

      <div className="filter-bar">

        <input
          className="form-input"
          placeholder="Buscar por nombre, generico o concentracion"
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
          value={filters.presentation}
          onChange={(e) =>
            setFilters({
              ...filters,
              presentation: e.target.value
            })
          }
        >
          <option value="todas">
            Todas las presentaciones
          </option>
          {presentations.map((presentation) => (
            <option
              key={presentation}
              value={presentation}
            >
              {presentation}
            </option>
          ))}
        </select>

        <select
          className="form-input"
          value={filters.unit}
          onChange={(e) =>
            setFilters({
              ...filters,
              unit: e.target.value
            })
          }
        >
          <option value="todas">
            Todas las unidades
          </option>
          {units.map((unit) => (
            <option
              key={unit}
              value={unit}
            >
              {unit}
            </option>
          ))}
        </select>

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
            Todos los estados
          </option>
          <option value="activo">
            Activos
          </option>
          <option value="inactivo">
            Inactivos
          </option>
        </select>

        <select
          className="form-input"
          value={filters.stock}
          onChange={(e) =>
            setFilters({
              ...filters,
              stock: e.target.value
            })
          }
        >
          <option value="todos">
            Todo el stock
          </option>
          <option value="bajo">
            Stock bajo
          </option>
          <option value="sin_stock">
            Sin stock
          </option>
          <option value="con_stock">
            Stock suficiente
          </option>
        </select>

        <button
          className="btn-secondary"
          onClick={() =>
            setFilters({
              search: '',
              presentation: 'todas',
              unit: 'todas',
              status: 'todos',
              stock: 'todos'
            })
          }
        >
          Limpiar
        </button>

      </div>

      <p className="results-summary">
        Mostrando {filteredMedications.length} de {medications.length} medicamentos
      </p>

<div className="table-container">
      <table className="data-table">

        <thead>

          <tr style={{
            background: '#f3f4f6'
          }}>

            <th>ID</th>

            <th>Nombre</th>

            <th>Genérico</th>

            <th>Presentación</th>

            <th>Concentración</th>

            <th>Stock mínimo</th>

            <th>Stock total</th>

            <th>Estado</th>

            <th>Acciones</th>

          </tr>

        </thead>



        <tbody>

          {filteredMedications.map((m) => (

            <tr key={m.id}
              style={{
                borderBottom:
                  '1px solid #e5e7eb'
              }}>

              <td>{m.id}</td>

              <td>{m.name}</td>

              <td>{m.generic_name}</td>

              <td>{m.presentation}</td>

              <td>{m.concentration}</td>

              <td>
                {m.minimum_stock}
              </td>

              <td>
                <span
                  className={
                    Number(m.total_stock || 0) <=
                    Number(m.minimum_stock || 0)
                      ? 'badge badge-danger'
                      : 'badge badge-success'
                  }
                >
                  {Number(m.total_stock || 0)}
                </span>
              </td>

              <td>
                <span
                  className={
                    m.is_active
                      ? 'badge badge-success'
                      : 'badge badge-danger'
                  }
                >

                  {
                    m.is_active
                      ? 'Activo'
                      : 'Inactivo'
                  }
                </span>

              </td>

              <td >

                <div className="table-actions">

                  <button
                    className="btn-primary"
                    onClick={() =>
                      setSelectedMedication(m)
                    }
                  >
                    Editar
                  </button>

                  <Link
                    className="btn-secondary table-link-button"
                    to={`/medications/${m.id}/batches`}
                  >
                    Ver lotes
                  </Link>

                  <button
                    className={
                      m.is_active
                        ? 'btn-danger'
                        : 'btn-success'
                    }
                    onClick={() =>
                      handleToggle(m.id)
                    }
                  >
                    {
                      m.is_active
                        ? 'Desactivar'
                        : 'Activar'
                    }
                  </button>

                </div>

              </td>

            </tr>

          ))}

          {
            filteredMedications.length === 0 && (

              <tr>
                <td colSpan={9}>
                  No hay medicamentos para esos filtros.
                </td>
              </tr>
            )
          }

        </tbody>

      </table>

</div>




      {
        openCreateModal && (

          <CreateMedicationModal
            onClose={() =>
              setOpenCreateModal(false)
            }
            onCreated={() => {

              loadMedications();

              setOpenCreateModal(false);
            }}
          />

        )
      }



      {
        selectedMedication && (

          <EditMedicationModal
            medication={selectedMedication}
            onClose={() =>
              setSelectedMedication(null)
            }
            onUpdated={() => {

              loadMedications();

              setSelectedMedication(null);
            }}
          />

        )
      }

    </div>
  );
}


