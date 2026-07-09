import jwt from 'jsonwebtoken';

export function generateAccessToken(
  payload: object
) {

  return jwt.sign(
    payload,
    process.env.JWT_SECRET as string,
    {
      expiresIn:
        process.env.JWT_EXPIRES_IN as any
    }
  );
}

export function generateRefreshToken(
  payload: object,
  expiresIn =
    process.env.JWT_REFRESH_EXPIRES_IN as any
) {

  return jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET as string,
    {
      expiresIn
    }
  );
}
