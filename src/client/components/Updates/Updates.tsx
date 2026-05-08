import { ArrowUpCircle, CheckCircle } from "lucide-react";
import { useInstalledPlugins, useUpdatePlugin } from "../../hooks/usePlugins";
import { useToast } from "../common/Toast";
import PluginCard from "../common/PluginCard";
import EmptyState from "../common/EmptyState";
import styles from "./Updates.module.css";
import commonStyles from "../common/common.module.css";
import layoutStyles from "../Layout/Layout.module.css";

export default function Updates() {
  const { data: plugins, isLoading } = useInstalledPlugins();
  const update = useUpdatePlugin();
  const { showToast } = useToast();

  const handleUpdate = async (name: string) => {
    try { await update.mutateAsync(name); showToast(`${name} updated`, "success"); }
    catch (e) { showToast(`Failed: ${(e as Error).message}`, "error"); }
  };

  const handleUpdateAll = async () => {
    if (!plugins) return;
    for (const plugin of plugins) {
      try { await update.mutateAsync(plugin.name); } catch { /* continue */ }
    }
    showToast("All plugins updated", "success");
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className={layoutStyles.pageTitle}>Updates</h1>
          <p className={layoutStyles.pageSubtitle}>Check for and apply plugin updates</p>
        </div>
        {plugins && plugins.length > 0 && (
          <button className={`${commonStyles.btn} ${commonStyles.btnPrimary}`} onClick={handleUpdateAll} disabled={update.isPending} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><ArrowUpCircle size={14} /> Update All</button>
        )}
      </div>
      {!plugins?.length ? (
        <EmptyState icon={<CheckCircle size={48} />} title="All up to date" message="No installed plugins to update." />
      ) : (
        <div className={styles.grid}>
          {plugins.map((plugin) => (
            <PluginCard key={plugin.name} name={plugin.name} version={plugin.version}
              description={plugin.description} marketplace={plugin.marketplace}
              onUpdate={() => handleUpdate(plugin.name)} isLoading={update.isPending} />
          ))}
        </div>
      )}
    </>
  );
}
