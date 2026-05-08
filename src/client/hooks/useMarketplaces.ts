import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Marketplace, MarketplacePlugin } from "../types";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}

export function useMarketplaces() {
  return useQuery<Marketplace[]>({
    queryKey: ["marketplaces"],
    queryFn: () => fetchJson("/api/marketplaces"),
  });
}

export function useBrowsePlugins(search?: string, marketplace?: string) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (marketplace) params.set("marketplace", marketplace);
  const query = params.toString();

  return useQuery<MarketplacePlugin[]>({
    queryKey: ["marketplace-browse", search, marketplace],
    queryFn: () => fetchJson(`/api/marketplaces/browse${query ? `?${query}` : ""}`),
  });
}

export function useAddMarketplace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (source: string) => {
      return fetchJson("/api/marketplaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplaces"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-browse"] });
    },
  });
}

export function useRemoveMarketplace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      return fetchJson(`/api/marketplaces/${encodeURIComponent(name)}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplaces"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-browse"] });
    },
  });
}

export function useRefreshMarketplaces() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name?: string) => {
      return fetchJson("/api/marketplaces/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplaces"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-browse"] });
    },
  });
}
