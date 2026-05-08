import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowUpCircle, Trash2, Globe, FolderGit2, ArrowLeft } from "lucide-react";
import { usePluginDetails, useUninstallPlugin, useUpdatePlugin } from "../../hooks/usePlugins";
import { useToast } from "../common/Toast";
import Badge from "../common/Badge";
import SkillsTab from "./SkillsTab";
import HooksTab from "./HooksTab";
import AgentsTab from "./AgentsTab";
import McpTab from "./McpTab";
import styles from "./PluginDetail.module.css";
import commonStyles from "../common/common.module.css";

type TabId = "overview" | "skills" | "hooks" | "agents" | "mcp";

export default function PluginDetail() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const { data: plugin, isLoading, error } = usePluginDetails(name ?? "");
  const uninstall = useUninstallPlugin();
  const update = useUpdatePlugin();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  if (isLoading) return <div>Loading plugin details...</div>;
  if (error || !plugin) return <div>Plugin not found</div>;

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "overview", label: "Overview", count: 0 },
    { id: "skills", label: "Skills", count: plugin.skills.length },
    { id: "hooks", label: "Hooks", count: plugin.hooks.length },
    { id: "agents", label: "Agents", count: plugin.agents.length },
    { id: "mcp", label: "MCP", count: plugin.mcpServers.length },
  ];

  const handleUninstall = async () => {
    try {
      await uninstall.mutateAsync(plugin.name);
      showToast(`${plugin.name} uninstalled`, "success");
      navigate("/");
    } catch (e) {
      showToast(`Failed: ${(e as Error).message}`, "error");
    }
  };

  const handleUpdate = async () => {
    try {
      await update.mutateAsync(plugin.name);
      showToast(`${plugin.name} updated`, "success");
    } catch (e) {
      showToast(`Failed: ${(e as Error).message}`, "error");
    }
  };

  return (
    <>
      <button className={styles.backLink} onClick={() => navigate(-1)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><ArrowLeft size={14} /> Back</button>
      <div className={styles.header}>
        <img src="/logo-192.png" alt="" className={styles.icon} />
        <div className={styles.headerInfo}>
          <h1>{plugin.name}</h1>
          <div className={styles.headerMeta}>
            {plugin.author?.name && <>by {plugin.author.name} • </>}
            {plugin.marketplace} • v{plugin.version ?? "unknown"}
            {plugin.license && <> • {plugin.license}</>}
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={`${commonStyles.btn} ${commonStyles.btnOutline}`} onClick={handleUpdate} disabled={update.isPending} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><ArrowUpCircle size={14} /> Update</button>
          <button className={`${commonStyles.btn} ${commonStyles.btnDanger}`} onClick={handleUninstall} disabled={uninstall.isPending} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Trash2 size={14} /> Remove</button>
        </div>
      </div>
      <div className={styles.description}>{plugin.description ?? "No description available."}</div>
      {plugin.keywords && plugin.keywords.length > 0 && (
        <div className={styles.keywords}>
          {plugin.keywords.map((kw) => (<Badge key={kw} variant="primary">{kw}</Badge>))}
        </div>
      )}
      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button key={tab.id} className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab.id)}>
            {tab.label}{tab.id !== "overview" && ` (${tab.count})`}
          </button>
        ))}
      </div>
      {activeTab === "overview" && (
        <div>
          <p>{plugin.description}</p>
          {(plugin.homepage || plugin.repository) && (
            <div className={styles.links}>
              {plugin.homepage && <a href={plugin.homepage} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Globe size={14} /> Homepage</a>}
              {plugin.repository && <a href={plugin.repository} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><FolderGit2 size={14} /> Repository</a>}
            </div>
          )}
          {plugin.installed_at && (
            <p style={{ marginTop: 12, fontSize: 13, color: "var(--color-text-tertiary)" }}>
              Installed: {new Date(plugin.installed_at).toLocaleDateString()}
            </p>
          )}
        </div>
      )}
      {activeTab === "skills" && <SkillsTab skills={plugin.skills} />}
      {activeTab === "hooks" && <HooksTab hooks={plugin.hooks} />}
      {activeTab === "agents" && <AgentsTab agents={plugin.agents} />}
      {activeTab === "mcp" && <McpTab mcpServers={plugin.mcpServers} />}
    </>
  );
}
