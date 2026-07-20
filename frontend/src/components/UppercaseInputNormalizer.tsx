import {
  useEffect
} from 'react';

const blockedInputTypes =
  new Set([
    'email',
    'password',
    'number',
    'date',
    'datetime-local',
    'time',
    'tel',
    'url'
  ]);

const blockedPatterns = [
  'buscar',
  'email',
  'mail',
  'usuario',
  'username',
  'password',
  'contrasena',
  'contraseña',
  'telefono',
  'teléfono',
  'phone',
  'dni',
  'documento',
  'cuil',
  'cuit',
  'direccion',
  'dirección',
  'address',
  'observacion',
  'observación',
  'nota',
  'notes',
  'mensaje',
  'descripcion',
  'descripción',
  'interno'
];

const uppercasePatterns = [
  'nombre',
  'apellido',
  'paciente',
  'medicamento',
  'vacuna',
  'medico',
  'médico',
  'doctor',
  'especialidad',
  'enfermedad',
  'presentacion',
  'presentación',
  'concentracion',
  'concentración',
  'unidad',
  'dosis',
  'lote',
  'elemento',
  'dependencia',
  'firma',
  'retira',
  'dona',
  'entrega',
  'sector',
  'servicio',
  'solicitante'
];

const uppercaseFieldNames =
  new Set([
    'first_name',
    'last_name',
    'full_name',
    'patient_name',
    'patient_first_name',
    'patient_last_name',
    'requester_name',
    'doctor_name',
    'driver_name',
    'name',
    'generic_name',
    'presentation',
    'concentration',
    'unit',
    'target_disease',
    'batch_number',
    'specialty',
    'service_name',
    'delivery_signature_name',
    'return_signature_name',
    'donor_name'
  ]);

function shouldNormalize(
  element: HTMLInputElement | HTMLTextAreaElement
) {
  if (element.dataset.uppercase === 'false') {
    return false;
  }

  if (element.dataset.uppercase === 'true') {
    return true;
  }

  if (element instanceof HTMLTextAreaElement) {
    return false;
  }

  const type =
    (element.type || 'text').toLowerCase();

  if (blockedInputTypes.has(type)) {
    return false;
  }

  const name =
    (element.name || '').toLowerCase();

  const placeholder =
    (element.placeholder || '').toLowerCase();

  const id =
    (element.id || '').toLowerCase();

  const signal =
    `${name} ${placeholder} ${id}`;

  if (
    blockedPatterns.some((pattern) =>
      signal.includes(pattern)
    )
  ) {
    return false;
  }

  if (uppercaseFieldNames.has(name)) {
    return true;
  }

  return uppercasePatterns.some((pattern) =>
    signal.includes(pattern)
  );
}

export default function UppercaseInputNormalizer() {
  useEffect(() => {
    function updateClass(
      event: Event
    ) {
      const target =
        event.target;

      if (
        !(target instanceof HTMLInputElement) &&
        !(target instanceof HTMLTextAreaElement)
      ) {
        return;
      }

      if (!shouldNormalize(target)) {
        target.classList.remove(
          'uppercase-input-display'
        );
        return;
      }

      target.classList.add(
        'uppercase-input-display'
      );
    }

    document.addEventListener(
      'input',
      updateClass,
      true
    );

    document.addEventListener(
      'focusin',
      updateClass,
      true
    );

    return () => {
      document.removeEventListener(
        'input',
        updateClass,
        true
      );

      document.removeEventListener(
        'focusin',
        updateClass,
        true
      );
    };
  }, []);

  return null;
}
