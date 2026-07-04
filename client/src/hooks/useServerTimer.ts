import { useQuery } from "@tanstack/react-query";

interface ServerTimeResponse {
  timeRemaining: number;
  started: boolean;
  expired?: boolean;
}

/**
 * Hook to sync exam timer with the server (Upgrade #10 — anti-cheat).
 * Prevents students from refreshing to reset their timer.
 * Polls the server every 30 seconds for the authoritative time remaining.
 */
export function useServerTimer(sessionId: string | null, enabled = true) {
  const { data, isLoading, error, refetch } = useQuery<ServerTimeResponse>({
    queryKey: ["/api/exam-sessions", sessionId, "time"],
    queryFn: async () => {
      if (!sessionId) throw new Error("No session ID");
      const res = await fetch(`/api/exam-sessions/${sessionId}/time`);
      if (!res.ok) throw new Error("Failed to fetch server time");
      return res.json();
    },
    enabled: enabled && !!sessionId,
    refetchInterval: 30000,  // sync every 30 seconds
    staleTime: 10000,        // consider fresh for 10s
    retry: 2,
  });

  return {
    serverTimeRemaining: data?.timeRemaining ?? null,
    hasStarted: data?.started ?? false,
    hasExpired: data?.expired ?? false,
    isLoading,
    error,
    refetch,
  };
}
