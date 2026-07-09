export interface RegisterDTO {
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  password: string;
}

export interface LoginDTO {
  username: string;
  password: string;
  session_type?: 'web' | 'mobile';
}

export interface ForgotPasswordDTO {
  email: string;
}

export interface ResetPasswordDTO {
  token: string;
  password: string;
}
