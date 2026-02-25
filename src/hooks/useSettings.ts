import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Settings, InstallMethod } from "../types/skill";

const defaultSettings: Settings = {
  installMethod: "copy",
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<Settings>("get_settings")
      .then(setSettings)
      .catch(() => setSettings(defaultSettings))
      .finally(() => setLoading(false));
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<Settings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    await invoke("save_settings", { settings: updated });
  }, [settings]);

  const setInstallMethod = useCallback(
    (method: InstallMethod) => updateSettings({ installMethod: method }),
    [updateSettings]
  );

  return { settings, loading, setInstallMethod };
}
