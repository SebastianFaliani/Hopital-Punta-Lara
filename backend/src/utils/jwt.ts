import jwt from 'jsonwebtoken';

export function generateAccessToken(payload: object) {

  return jwt.sign(
    payload,
    process.env.JWT_SECRET as string,
    {
      expiresIn: process.env.JWT_EXPIRES_IN
    }
  );
}