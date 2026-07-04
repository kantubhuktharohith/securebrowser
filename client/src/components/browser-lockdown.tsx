import { useEffect, useRef, useCallback, useState } from "react";

interface BrowserLockdownProps {
  enabled: boolean;
  onViolation: (type: string, description: string) => void;
  maxWarnings?: number;
  onMaxWarningsReached?: () => void;
}

export function useBrowserLockdown({
  enabled,
  onViolation,
  maxWarnings = 5,
  onMaxWarningsReached,
}: BrowserLockdownProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [warnings, setWarnings] = useState(0);
  const [tabSwitches, setTabSwitches] = useState(0);
  const warningsRef = useRef(0);
  const cooldownRef = useRef<Record<string, boolean>>({});

  const triggerViolation = useCallback(
    (type: string, description: string) => {
      if (cooldownRef.current[type]) return;

      cooldownRef.current[type] = true;
      setTimeout(() => {
        cooldownRef.current[type] = false;
      }, 5000); // 5-second cooldown per violation type

      warningsRef.current += 1;
      setWarnings(warningsRef.current);
      onViolation(type, description);

      if (warningsRef.current >= maxWarnings) {
        onMaxWarningsReached?.();
      }
    },
    [onViolation, maxWarnings, onMaxWarningsReached]
  );

  // Enter fullscreen
  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } catch (error) {
      console.error("Fullscreen request failed:", error);
    }
  }, []);

  // Exit fullscreen detection
  useEffect(() => {
    if (!enabled) return;

    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);

      if (!isFull) {
        triggerViolation(
          "fullscreen_exit",
          "Student exited fullscreen mode during exam"
        );
        // Try to re-enter fullscreen
        setTimeout(() => {
          enterFullscreen().catch(() => {});
        }, 1000);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    
    // Auto-enter fullscreen on mount
    enterFullscreen();

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [enabled, triggerViolation, enterFullscreen]);

  // Tab switch / visibility detection
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitches((prev) => prev + 1);
        triggerViolation(
          "tab_switch",
          "Student switched to another tab or minimized the browser"
        );
      }
    };

    const handleBlur = () => {
      triggerViolation(
        "window_blur",
        "Browser window lost focus (possible Alt+Tab or window switch)"
      );
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [enabled, triggerViolation]);

  // Block right-click and keyboard shortcuts
  useEffect(() => {
    if (!enabled) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      triggerViolation(
        "right_click",
        "Student attempted to right-click during exam"
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block F12 (DevTools)
      if (e.key === "F12") {
        e.preventDefault();
        triggerViolation("devtools_attempt", "Student pressed F12 (DevTools)");
        return;
      }

      // Block Ctrl+Shift+I (DevTools)
      if (e.ctrlKey && e.shiftKey && e.key === "I") {
        e.preventDefault();
        triggerViolation(
          "devtools_attempt",
          "Student pressed Ctrl+Shift+I (DevTools)"
        );
        return;
      }

      // Block Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && e.key === "J") {
        e.preventDefault();
        triggerViolation(
          "devtools_attempt",
          "Student pressed Ctrl+Shift+J (Console)"
        );
        return;
      }

      // Block Ctrl+U (View Source)
      if (e.ctrlKey && e.key === "u") {
        e.preventDefault();
        triggerViolation(
          "view_source",
          "Student pressed Ctrl+U (View Source)"
        );
        return;
      }

      // Block Ctrl+S (Save)
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        return;
      }

      // Block Ctrl+P (Print)
      if (e.ctrlKey && e.key === "p") {
        e.preventDefault();
        triggerViolation("print_attempt", "Student pressed Ctrl+P (Print)");
        return;
      }

      // Block Ctrl+C (Copy) - except in code editor textareas
      if (e.ctrlKey && e.key === "c") {
        const target = e.target as HTMLElement;
        const isCodeEditor = target.closest('[data-code-editor="true"]');
        if (!isCodeEditor) {
          e.preventDefault();
          triggerViolation(
            "copy_attempt",
            "Student attempted to copy content"
          );
        }
        return;
      }
    };

    // Block text selection outside code editors
    const handleSelectStart = (e: Event) => {
      const target = e.target as HTMLElement;
      const isCodeEditor = target.closest('[data-code-editor="true"]');
      if (!isCodeEditor) {
        e.preventDefault();
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("selectstart", handleSelectStart);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("selectstart", handleSelectStart);
    };
  }, [enabled, triggerViolation]);

  return {
    isFullscreen,
    warnings,
    tabSwitches,
    enterFullscreen,
  };
}

// Lockdown status badge
export default function BrowserLockdownBadge({
  isFullscreen,
  warnings,
  tabSwitches,
}: {
  isFullscreen: boolean;
  warnings: number;
  tabSwitches: number;
}) {
  return (
    <div className="flex items-center space-x-3">
      <div
        className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
          isFullscreen
            ? "bg-green-100 text-green-700"
            : "bg-red-100 text-red-700"
        }`}
      >
        <i className={`fas ${isFullscreen ? "fa-lock" : "fa-lock-open"}`} />
        <span>{isFullscreen ? "Locked" : "Unlocked"}</span>
      </div>

      {tabSwitches > 0 && (
        <div className="flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
          <i className="fas fa-exchange-alt" />
          <span>{tabSwitches} switch{tabSwitches !== 1 ? "es" : ""}</span>
        </div>
      )}

      {warnings > 0 && (
        <div className="flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <i className="fas fa-exclamation-triangle" />
          <span>{warnings} warning{warnings !== 1 ? "s" : ""}</span>
        </div>
      )}
    </div>
  );
}
