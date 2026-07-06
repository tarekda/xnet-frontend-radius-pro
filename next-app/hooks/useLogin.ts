import { useState } from 'react';
import axios from 'axios';
import { resolveBrowserApiUrl } from "@/lib/publicEnv";

interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user: {
      id: number;
      username: string;
      email: string;
      role: string;
      permissions?: string[];
      resellerId?: number | null;
      mustChangePassword?: boolean;
      isActive: number;
      createdAt: string;
      updatedAt: string;
      lastLogin: string | null;
    };
    accessToken: string;
    refreshToken: string;
  };
}

interface LoginError {
  message: string;
}

const useLogin = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post<LoginResponse>(`${resolveBrowserApiUrl()}/auth/login`, {
        username: email,
        password,
      });

      setIsLoading(false);

      if (response.data.success) {
        // Token persistence is handled by AuthContext.login(), which respects
        // the user's "remember me" choice (localStorage vs sessionStorage).
        return response.data;
      } else {
        throw new Error(response.data.message);
      }
    } catch (err) {
      setIsLoading(false);
      if (axios.isAxiosError(err) && err.response) {
        setError((err.response.data as LoginError).message || 'An error occurred during login');
      } else {
        setError('An unexpected error occurred');
      }
      return null;
    }
  };

  return { login, isLoading, error };
};

export default useLogin;