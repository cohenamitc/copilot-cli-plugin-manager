import { Store, RefreshCw } from "lucide-react";
import { useMarketplaces, useRemoveMarketplace, useRefreshMarketplaces } from "../../hooks/useMarketplaces";
import { useToast } from "../common/Toast";
import Badge from "../common/Badge";
import EmptyState from "../common/EmptyState";
import styles from "./MarketplaceList.module.css";
import commonStyles from "../common/common.module.css";
import layoutStyles from "../Layout/Layout.module.css";

export default function MarketplaceList() {
  const { data: marketplaces, isLoading } = useMarketplaces();
  const remove = useRemoveMarketplace();
  const refresh = useRefreshMarketplaces();
  const { showToast } = useToast();

  const handleRemove = async (name: string) => {
    try { await remove.mutateAsync(name); showToast(`${name} removed`, "success"); }
    catch (e) { showToast(`Failed: ${(e as Error).message}`, "error"); }
  };

  const handleRefreshAll = async () => {
    try { await refresh.mutateAsync(undefined); showToast("Marketplaces refreshed", "success"); }
    catch (e) { showToast(`Failed: ${(e as Error).message}`, "error"); }
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className={layoutStyles.pageTitle}>Marketplaces</h1>
          <p className={layoutStyles.pageSubtitle}>{marketplaces?.length ?? 0} registered sources</p>
        </div>
        <button className={`${commonStyles.btn} ${commonStyles.btnOutline}`} onClick={handleRefreshAll} disabled={refresh.isPending} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><RefreshCw size={14} /> Refresh All</button>
      </div>
      {!marketplaces?.length ? (
        <EmptyState icon={<Store size={48} />} title="No marketplaces" message="Add a marketplace to start browsing plugins." />
      ) : (
        <div className={styles.list}>
          {marketplaces.map((m) => (
            <div key={m.name} className={styles.item}>
              <div className={styles.itemInfo}>
                <div className={styles.itemName}>{m.name} {m.isDefault && <Badge variant="primary">Default</Badge>}</div>
                <div className={styles.itemSource}>{m.source.repo ?? m.source.url ?? m.source.source}</div>
              </div>
              <div className={styles.itemActions}>
                {!m.isDefault && (
                  <button className={`${commonStyles.btn} ${commonStyles.btnDanger}`} onClick={() => handleRemove(m.name)} disabled={remove.isPending}>Remove</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
