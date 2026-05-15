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

            <th>Estado</th>

            <th>Acciones</th>

          </tr>

        </thead>



        <tbody>

          {medications.map((m) => (

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


