import { useState } from "react";
import { Package, Search } from "lucide-react";
import { useBrowsePlugins, useMarketplaces, useRefreshMarketplaces } from "../../hooks/useMarketplaces";
import { useInstallPlugin } from "../../hooks/usePlugins";
import { useToast } from "../common/Toast";
import PluginCard from "../common/PluginCard";
import SearchBar from "../common/SearchBar";
import EmptyState from "../common/EmptyState";
import styles from "./MarketplaceBrowser.module.css";
import layoutStyles from "../Layout/Layout.module.css";
import commonStyles from "../common/common.module.css";

export default function MarketplaceBrowser() {
  const [search, setSearch] = useState("");
  const [marketplaceFilter, setMarketplaceFilter] = useState("");
  const { data: plugins, isLoading, refetch } = useBrowsePlugins(search || undefined, marketplaceFilter || undefined);
  const { data: marketplaces } = useMarketplaces();
  const install = useInstallPlugin();
  const refresh = useRefreshMarketplaces();
  const { showToast } = useToast();

  const filterOptions = (marketplaces ?? []).map((m) => ({
    value: m.name,
    label: m.name,
  }));

  const handleInstall = async (pluginName: string, marketplace: string) => {
    try {
      await install.mutateAsync(`${pluginName}@${marketplace}`);
      showToast(`${pluginName} installed`, "success");
    } catch (e) {
      showToast(`Failed to install ${pluginName}: ${(e as Error).message}`, "error");
    }
  };

  const handleFetchCatalog = async (mktName: string) => {
    try {
      await refresh.mutateAsync(mktName);
      showToast(`Fetched full catalog for ${mktName}`, "success");
      refetch();
    } catch (e) {
      showToast(`Failed to fetch catalog: ${(e as Error).message}`, "error");
    }
  };

  // Detect if showing only installed plugins (no full catalog)
  const allInstalled = plugins && plugins.length > 0 && plugins.every((p) => p.installed);
  const showingPartial = marketplaceFilter && allInstalled && plugins.length < 10;

  return (
    <>
      <h1 className={layoutStyles.pageTitle}>Browse Plugins</h1>
      <p className={layoutStyles.pageSubtitle}>Discover plugins from all registered marketplaces</p>
      <SearchBar
        value={search} onChange={setSearch}
        placeholder="Search plugins by name, description, or keywords..."
        filterOptions={filterOptions} filterValue={marketplaceFilter}
        onFilterChange={setMarketplaceFilter}
      />

      {showingPartial && (
        <div className={styles.partialBanner}>
          <span>📋 Showing only installed plugins — full catalog not cached locally.</span>
          <button
            className={`${commonStyles.btn} ${commonStyles.btnPrimary}`}
            onClick={() => handleFetchCatalog(marketplaceFilter)}
            disabled={refresh.isPending}
          >
            {refresh.isPending ? "Fetching..." : "Fetch Full Catalog"}
          </button>
        </div>
      )}

      {isLoading && <div>Loading plugins...</div>}
      {!isLoading && !plugins?.length && marketplaceFilter && (
        <div className={styles.emptyWithFetch}>
          <EmptyState icon={<Package size={48} />} title="No cached catalog" message="This marketplace's catalog hasn't been fetched yet." />
          <button
            className={`${commonStyles.btn} ${commonStyles.btnPrimary}`}
            onClick={() => handleFetchCatalog(marketplaceFilter)}
            disabled={refresh.isPending}
            style={{ marginTop: 12 }}
          >
            {refresh.isPending ? "Fetching..." : "Fetch Full Catalog"}
          </button>
        </div>
      )}
      {!isLoading && !plugins?.length && !marketplaceFilter && (
        <EmptyState icon={<Search size={48} />} title="No plugins found" message="Try a different search or check your marketplace registrations." />
      )}
      {plugins && plugins.length > 0 && (
        <div className={styles.grid}>
          {plugins.map((plugin) => (
            <PluginCard
              key={`${plugin.marketplace}-${plugin.name}`}
              name={plugin.name} version={plugin.version}
              description={plugin.description} marketplace={plugin.marketplace}
              installed={plugin.installed}
              onInstall={plugin.installed ? undefined : () => handleInstall(plugin.name, plugin.marketplace)}
              isLoading={install.isPending}
            />
          ))}
        </div>
      )}
    </>
  );
}
