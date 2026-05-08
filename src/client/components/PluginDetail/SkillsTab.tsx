import { Brain } from "lucide-react";
import type { PluginComponent } from "../../types";
import EmptyState from "../common/EmptyState";
import styles from "./PluginDetail.module.css";

export default function SkillsTab({ skills }: { skills: PluginComponent[] }) {
  if (!skills.length) return <EmptyState icon={<Brain size={48} />} title="No skills" message="This plugin doesn't include any skills." />;
  return (
    <div className={styles.componentGrid}>
      {skills.map((skill) => (
        <div key={skill.name} className={styles.componentCard}>
          <div className={styles.componentName}>{skill.name}</div>
          <div className={styles.componentDesc}>{skill.description ?? "No description"}</div>
        </div>
      ))}
    </div>
  );
}
