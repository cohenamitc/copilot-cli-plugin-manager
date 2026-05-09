export interface PluginAuthor {
  name: string;
  email?: string;
}

export interface InstalledPlugin {
  name: string;
  marketplace: string;
  version?: string;
  installed_at: string;
  enabled: boolean;
  disabled: boolean;
  description?: string;
  author?: PluginAuthor;
  keywords?: string[];
  category?: string;
  skillCount: number;
  agentCount: number;
  hookCount: number;
  mcpCount: number;
}

export interface PluginComponent {
  name: string;
  description?: string;
  path: string;
  metadata?: Record<string, unknown>;
}

export interface PluginDetails {
  name: string;
  version?: string;
  description?: string;
  author?: PluginAuthor;
  keywords?: string[];
  category?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  marketplace: string;
  installed_at?: string;
  enabled: boolean;
  skills: PluginComponent[];
  agents: PluginComponent[];
  hooks: PluginComponent[];
  mcpServers: PluginComponent[];
}

export interface Marketplace {
  name: string;
  source: { source: string; repo?: string; url?: string };
  isDefault: boolean;
  pluginCount?: number;
}

export interface MarketplacePlugin {
  name: string;
  description?: string;
  version?: string;
  source: string;
  marketplace: string;
  author?: PluginAuthor;
  keywords?: string[];
  category?: string;
  installed: boolean;
  disabled?: boolean;
}

export type Theme = "light" | "dark" | "copilot";

export interface AppSettings {
  theme: Theme;
}
