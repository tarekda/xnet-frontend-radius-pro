import { apiClient } from "./client";

export type StompBrowserCredentials = {
  brokerUrl: string;
  login: string;
  passcode: string;
};

export async function fetchStompCredentials(): Promise<StompBrowserCredentials | null> {
  try {
    const { data } = await apiClient.get("/auth/stomp-credentials");
    const creds = data?.data as StompBrowserCredentials | undefined;
    if (!creds?.brokerUrl || !creds.login || !creds.passcode) return null;
    if (creds.login.toLowerCase() === "guest") return null;
    return creds;
  } catch {
    return null;
  }
}
