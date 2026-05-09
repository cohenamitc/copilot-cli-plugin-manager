import { Sun, Moon, Code } from "lucide-react";
import { useSettings } from "../../hooks/useSettings";
import type { Theme } from "../../types";
import styles from "./Settings.module.css";
import layoutStyles from "../Layout/Layout.module.css";

const themes: { id: Theme; label: string; icon: React.ReactNode; preview: string }[] = [
  { id: "light", label: "Light", icon: <Sun size={24} />, preview: "#ffffff" },
  { id: "dark", label: "Dark", icon: <Moon size={24} />, preview: "#0f1219" },
  { id: "copilot", label: "Copilot", icon: <Code size={24} />, preview: "#0d1117" },
];

export default function Settings() {
  const { settings, setTheme } = useSettings();

  return (
    <>
      <h1 className={layoutStyles.pageTitle}>Settings</h1>
      <p className={layoutStyles.pageSubtitle}>Configure the plugin manager</p>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Theme</div>
        <div className={styles.themeGroup}>
          {themes.map((theme) => (
            <button key={theme.id}
              className={`${styles.themeOption} ${settings.theme === theme.id ? styles.themeOptionActive : ""}`}
              onClick={() => setTheme(theme.id)}>
              <div className={styles.themePreview} style={{ background: theme.preview }} />
              <div className={styles.themeName}>{theme.icon} {theme.label}</div>
            </button>
          ))}
        </div>
      </div>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>About</div>
        <div className={styles.version}>Copilot CLI Plugin Manager v{__APP_VERSION__}</div>
        <div className={styles.version}>Requires: copilot CLI in PATH</div>
      </div>
    </>
  );
}
