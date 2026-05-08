import { Bot } from "lucide-react";
import type { PluginComponent } from "../../types";
import EmptyState from "../common/EmptyState";
import styles from "./PluginDetail.module.css";

export default function AgentsTab({ agents }: { agents: PluginComponent[] }) {
  if (!agents.length) return <EmptyState icon={<Bot size={48} />} title="No agents" message="This plugin doesn't include any agents." />;
  return (
    <div className={styles.componentGrid}>
      {agents.map((agent) => (
        <div key={agent.name} className={styles.componentCard}>
          <div className={styles.componentName}>{agent.name}</div>
          <div className={styles.componentDesc}>{agent.description ?? "No description"}</div>
        </div>
      ))}
    </div>
  );
}
