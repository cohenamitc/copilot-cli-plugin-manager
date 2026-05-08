import { Anchor } from "lucide-react";
import type { PluginComponent } from "../../types";
import EmptyState from "../common/EmptyState";
import styles from "./PluginDetail.module.css";

export default function HooksTab({ hooks }: { hooks: PluginComponent[] }) {
  if (!hooks.length) return <EmptyState icon={<Anchor size={48} />} title="No hooks" message="This plugin doesn't include any hooks." />;
  return (
    <div className={styles.componentGrid}>
      {hooks.map((hook) => (
        <div key={hook.name} className={styles.componentCard}>
          <div className={styles.componentName}>{hook.name}</div>
          <div className={styles.componentDesc}>{hook.description ?? "No description"}</div>
        </div>
      ))}
    </div>
  );
}
