import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InstalledPlugin, PluginDetails } from "../types";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}

export function useInstalledPlugins() {
  return useQuery<InstalledPlugin[]>({
    queryKey: ["plugins"],
    queryFn: () => fetchJson("/api/plugins"),
  });
}

export function usePluginDetails(name: string) {
  return useQuery<PluginDetails>({
    queryKey: ["plugin-details", name],
    queryFn: () => fetchJson(`/api/plugins/${encodeURIComponent(name)}/details`),
    enabled: !!name,
  });
}

export function useInstallPlugin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (source: string) => {
      return fetchJson("/api/plugins/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plugins"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-browse"] });
    },
  });
}

export function useUninstallPlugin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      return fetchJson(`/api/plugins/${encodeURIComponent(name)}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plugins"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-browse"] });
    },
  });
}

export function useUpdatePlugin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      return fetchJson(`/api/plugins/${encodeURIComponent(name)}/update`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plugins"] });
      queryClient.invalidateQueries({ queryKey: ["plugin-details"] });
    },
  });
}

export function useDisablePlugin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      return fetchJson(`/api/plugins/${encodeURIComponent(name)}/disable`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plugins"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-browse"] });
      queryClient.invalidateQueries({ queryKey: ["plugin-details"] });
    },
  });
}

export function useEnablePlugin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      return fetchJson(`/api/plugins/${encodeURIComponent(name)}/enable`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plugins"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-browse"] });
      queryClient.invalidateQueries({ queryKey: ["plugin-details"] });
    },
  });
}
