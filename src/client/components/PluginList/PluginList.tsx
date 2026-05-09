import { Package } from "lucide-react";
import { useInstalledPlugins, useUninstallPlugin, useUpdatePlugin, useDisablePlugin, useEnablePlugin } from "../../hooks/usePlugins";
import { useToast } from "../common/Toast";
import PluginCard from "../common/PluginCard";
import EmptyState from "../common/EmptyState";
import styles from "./PluginList.module.css";
import layoutStyles from "../Layout/Layout.module.css";

export default function PluginList() {
  const { data: plugins, isLoading, error } = useInstalledPlugins();
  const uninstall = useUninstallPlugin();
  const update = useUpdatePlugin();
  const disable = useDisablePlugin();
  const enable = useEnablePlugin();
  const { showToast } = useToast();

  if (isLoading) return <div>Loading plugins...</div>;
  if (error) return <div>Error loading plugins: {(error as Error).message}</div>;
  if (!plugins?.length) {
    return (
      <>
        <h1 className={layoutStyles.pageTitle}>Installed Plugins</h1>
        <EmptyState icon={<Package size={48} />} title="No plugins installed" message="Browse the marketplace to find and install plugins." />
      </>
    );
  }

  const handleUninstall = async (name: string) => {
    try {
      await uninstall.mutateAsync(name);
      showToast(`${name} uninstalled`, "success");
    } catch (e) {
      showToast(`Failed to uninstall ${name}: ${(e as Error).message}`, "error");
    }
  };

  const handleUpdate = async (name: string) => {
    try {
      await update.mutateAsync(name);
      showToast(`${name} updated`, "success");
    } catch (e) {
      showToast(`Failed to update ${name}: ${(e as Error).message}`, "error");
    }
  };

  const handleDisable = async (name: string) => {
    try {
      await disable.mutateAsync(name);
      showToast(`${name} disabled`, "success");
    } catch (e) {
      showToast(`Failed to disable ${name}: ${(e as Error).message}`, "error");
    }
  };

  const handleEnable = async (name: string) => {
    try {
      await enable.mutateAsync(name);
      showToast(`${name} enabled`, "success");
    } catch (e) {
      showToast(`Failed to enable ${name}: ${(e as Error).message}`, "error");
    }
  };

  const activePlugins = plugins.filter((p) => !p.disabled);
  const disabledPlugins = plugins.filter((p) => p.disabled);
  const totalCount = plugins.length;
  const disabledCount = disabledPlugins.length;

  return (
    <>
      <h1 className={layoutStyles.pageTitle}>Installed Plugins</h1>
      <p className={layoutStyles.pageSubtitle}>
        {totalCount} plugin{totalCount !== 1 ? "s" : ""}
        {disabledCount > 0 && ` (${disabledCount} disabled)`}
      </p>
      <div className={styles.grid}>
        {activePlugins.map((plugin) => (
          <PluginCard
            key={plugin.name}
            name={plugin.name}
            version={plugin.version}
            description={plugin.description}
            marketplace={plugin.marketplace}
            skillCount={plugin.skillCount}
            agentCount={plugin.agentCount}
            hookCount={plugin.hookCount}
            mcpCount={plugin.mcpCount}
            onUninstall={() => handleUninstall(plugin.name)}
            onUpdate={() => handleUpdate(plugin.name)}
            onDisable={() => handleDisable(plugin.name)}
            isLoading={uninstall.isPending || update.isPending || disable.isPending || enable.isPending}
          />
        ))}
        {disabledPlugins.map((plugin) => (
          <PluginCard
            key={plugin.name}
            name={plugin.name}
            version={plugin.version}
            description={plugin.description}
            marketplace={plugin.marketplace}
            disabled
            skillCount={plugin.skillCount}
            agentCount={plugin.agentCount}
            hookCount={plugin.hookCount}
            mcpCount={plugin.mcpCount}
            onEnable={() => handleEnable(plugin.name)}
            isLoading={uninstall.isPending || update.isPending || disable.isPending || enable.isPending}
          />
        ))}
      </div>
    </>
  );
}
