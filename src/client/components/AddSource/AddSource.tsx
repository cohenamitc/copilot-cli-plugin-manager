import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAddMarketplace } from "../../hooks/useMarketplaces";
import { useToast } from "../common/Toast";
import styles from "./AddSource.module.css";
import commonStyles from "../common/common.module.css";
import layoutStyles from "../Layout/Layout.module.css";

export default function AddSource() {
  const [source, setSource] = useState("");
  const add = useAddMarketplace();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source.trim()) return;
    try {
      await add.mutateAsync(source.trim());
      showToast("Marketplace added", "success");
      navigate("/marketplaces");
    } catch (err) {
      showToast(`Failed: ${(err as Error).message}`, "error");
    }
  };

  return (
    <>
      <h1 className={layoutStyles.pageTitle}>Add Source</h1>
      <p className={layoutStyles.pageSubtitle}>Register a new plugin marketplace</p>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label}>Marketplace Source</label>
          <input className={styles.input} value={source} onChange={(e) => setSource(e.target.value)}
            placeholder="owner/repo, git URL, or local path" />
          <div className={styles.hint}>Examples: github/copilot-plugins, https://github.com/org/marketplace.git</div>
        </div>
        <button type="submit" className={`${commonStyles.btn} ${commonStyles.btnPrimary}`}
          disabled={!source.trim() || add.isPending}>
          {add.isPending ? "Adding..." : "Add Marketplace"}
        </button>
      </form>
    </>
  );
}
