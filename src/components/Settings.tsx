import { X, Terminal, Copy } from "lucide-react";
import { useSettings } from "../hooks/useSettings";

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const { settings, setInstallMethod } = useSettings();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[var(--bg-secondary)] rounded-2xl max-w-md w-full shadow-2xl border border-[var(--border)]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-3">
              Install Method
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 border border-[var(--border)] rounded-lg cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors">
                <input
                  type="radio"
                  name="installMethod"
                  value="npx"
                  checked={settings.installMethod === "npx"}
                  onChange={() => setInstallMethod("npx")}
                  className="mt-1 accent-[var(--accent)]"
                />
                <Terminal className="w-5 h-5 text-[var(--text-secondary)] mt-0.5" />
                <div>
                  <div className="font-medium text-[var(--text-primary)]">npx skills add</div>
                  <div className="text-sm text-[var(--text-muted)]">
                    Use the official skills CLI (recommended)
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 border border-[var(--border)] rounded-lg cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors">
                <input
                  type="radio"
                  name="installMethod"
                  value="copy"
                  checked={settings.installMethod === "copy"}
                  onChange={() => setInstallMethod("copy")}
                  className="mt-1 accent-[var(--accent)]"
                />
                <Copy className="w-5 h-5 text-[var(--text-secondary)] mt-0.5" />
                <div>
                  <div className="font-medium text-[var(--text-primary)]">Direct Copy</div>
                  <div className="text-sm text-[var(--text-muted)]">
                    Copy skill files directly to ~/.claude/skills
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
