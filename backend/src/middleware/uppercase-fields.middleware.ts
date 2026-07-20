import {
  NextFunction,
  Request,
  Response
} from 'express';

const alwaysUppercaseFields =
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

const nameFieldRoutes = [
  '/medications',
  '/vaccines',
  '/health-facilities',
  '/housekeeping'
];

const excludedFields =
  new Set([
    'email',
    'username',
    'password',
    'current_password',
    'new_password',
    'confirm_password',
    'phone',
    'patient_phone',
    'requester_phone',
    'document_number',
    'patient_document',
    'address',
    'origin_address',
    'destination_address',
    'notes',
    'description',
    'justification',
    'message'
  ]);

function upperText(
  value: string
) {
  return value.trim().toLocaleUpperCase('es-AR');
}

function shouldUppercaseField(
  key: string,
  req: Request
) {
  const normalizedKey =
    key.toLowerCase();

  if (excludedFields.has(normalizedKey)) {
    return false;
  }

  if (alwaysUppercaseFields.has(normalizedKey)) {
    return true;
  }

  return normalizedKey === 'name' &&
    nameFieldRoutes.some((route) =>
      req.path.startsWith(route)
    );
}

function normalizeBodyValue(
  value: unknown,
  key: string,
  req: Request
): unknown {
  if (typeof value === 'string') {
    return shouldUppercaseField(
      key,
      req
    )
      ? upperText(value)
      : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      normalizeBodyValue(
        item,
        key,
        req
      )
    );
  }

  if (
    value &&
    typeof value === 'object'
  ) {
    normalizeUppercaseFields(
      value as Record<string, unknown>,
      req
    );
  }

  return value;
}

function normalizeUppercaseFields(
  body: Record<string, unknown>,
  req: Request
) {
  Object.keys(body).forEach((key) => {
    body[key] =
      normalizeBodyValue(
        body[key],
        key,
        req
      );
  });
}

export function uppercaseFieldsMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  if (
    req.body &&
    typeof req.body === 'object' &&
    !Array.isArray(req.body)
  ) {
    normalizeUppercaseFields(
      req.body,
      req
    );
  }

  next();
}
