import { useState } from "react";
import axios from "axios";
import { apiClient } from "@/api/client";

export interface LoginUser {
  id: number;
  username: string;
  email: string;
  role: string;
  permissions?: string[];
  resellerId?: number | null;
  mustChangePassword?: boolean;
  mfaEnabled?: boolean;
  mfaRequired?: boolean;
}

export type LoginResult =
  | {
      success: true;
      message: string;
      data: {
        mfaRequired: true;
        mfaToken: string;
      };
    }
  | {
      success: true;
      message: string;
      data: {
        user: LoginUser;
        accessToken: string;
        refreshToken: string;
      };
    };

const useLogin = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (email: string, password: string): Promise<LoginResult | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.post<LoginResult>("/auth/login", {
        username: email,
        password,
      });
      setIsLoading(false);
      if (response.data.success) return response.data;
      throw new Error((response.data as any).message || "Login failed");
    } catch (err) {
      setIsLoading(false);
      if (axios.isAxiosError(err) && err.response) {
        setError((err.response.data as any)?.message || "An error occurred during login");
      } else {
        setError("An unexpected error occurred");
      }
      return null;
    }
  };

  const verifyMfa = async (mfaToken: string, code: string): Promise<LoginResult | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.post<LoginResult>("/auth/mfa/verify-login", {
        mfaToken,
        code,
      });
      setIsLoading(false);
      if (response.data.success) return response.data;
      throw new Error((response.data as any).message || "MFA failed");
    } catch (err) {
      setIsLoading(false);
      if (axios.isAxiosError(err) && err.response) {
        setError((err.response.data as any)?.message || "Invalid MFA code");
      } else {
        setError("An unexpected error occurred");
      }
      return null;
    }
  };

  return { login, verifyMfa, isLoading, error };
};

export default useLogin;
