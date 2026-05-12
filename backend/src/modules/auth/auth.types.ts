export interface RegisterDTO {
  first_name: string;
  last_name: string;
  email: string;
  username?: string;
  password: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}