import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { AppSettings, Theme } from "../types";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export function useSettings() {
  const queryClient = useQueryClient();

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["settings"],
    queryFn: () => fetchJson("/api/settings"),
    staleTime: Infinity,
    placeholderData: { theme: (localStorage.getItem("theme") as Theme) ?? "light" },
  });

  const mutation = useMutation({
    mutationFn: async (newSettings: Partial<AppSettings>) => {
      return fetchJson<AppSettings>("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
      localStorage.setItem("theme", data.theme);
      document.documentElement.setAttribute("data-theme", data.theme);
    },
  });

  useEffect(() => {
    if (settings?.theme) {
      document.documentElement.setAttribute("data-theme", settings.theme);
      localStorage.setItem("theme", settings.theme);
    }
  }, [settings?.theme]);

  return {
    settings: settings ?? { theme: "light" as Theme },
    setTheme: (theme: Theme) => mutation.mutate({ theme }),
    isUpdating: mutation.isPending,
  };
}
