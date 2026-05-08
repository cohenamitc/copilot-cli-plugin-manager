import { Routes, Route } from "react-router-dom";
import { ToastProvider } from "./components/common/Toast";
import Layout from "./components/Layout/Layout";
import PluginList from "./components/PluginList/PluginList";
import PluginDetail from "./components/PluginDetail/PluginDetail";
import MarketplaceBrowser from "./components/MarketplaceBrowser/MarketplaceBrowser";
import MarketplaceList from "./components/MarketplaceList/MarketplaceList";
import AddSource from "./components/AddSource/AddSource";
import Updates from "./components/Updates/Updates";
import Settings from "./components/Settings/Settings";

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<PluginList />} />
          <Route path="/plugins/:name" element={<PluginDetail />} />
          <Route path="/browse" element={<MarketplaceBrowser />} />
          <Route path="/updates" element={<Updates />} />
          <Route path="/marketplaces" element={<MarketplaceList />} />
          <Route path="/add-source" element={<AddSource />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}
