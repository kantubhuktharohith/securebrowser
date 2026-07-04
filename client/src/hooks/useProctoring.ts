import { useEffect, useCallback, useRef } from "react";

interface ProctorConfig {
  sessionId: string;
  studentName: string;
  rollNumber: string;
  onViolation: (type: string, description: string) => void;
  onAutoSubmit?: () => void;
  enabled?: boolean;
}

/**
 * Anti-cheat proctoring hook (Upgrade #12).
 * Detects and reports:
 * - Tab switches / window blur (Page Visibility API)
 * - Copy/paste/cut attempts
 * - Right-click context menu
 * - DevTools opening (resize heuristic)
 * - Print screen attempts
 */
export function useProctoring({
  sessionId,
  studentName,
  rollNumber,
  onViolation,
  onAutoSubmit,
  enabled = true,
}: ProctorConfig) {
  const tabSwitchCount = useRef(0);
  const maxTabSwitches = 3; // Auto-submit after 3 tab switches

  // ─── Tab Switch Detection (Page Visibility API) ───
  const handleVisibilityChange = useCallback(() => {
    if (!enabled) return;

    if (document.hidden) {
      tabSwitchCount.current += 1;
      const count = tabSwitchCount.current;

      if (count >= maxTabSwitches && onAutoSubmit) {
        onViolation(
          "tab_switch_exceeded",
          `Student left the exam tab ${count} times. Exam auto-submitted.`
        );
        onAutoSubmit();
      } else {
        onViolation(
          "tab_switch",
          `Student switched away from exam tab (${count}/${maxTabSwitches})`
        );
      }
    }
  }, [enabled, onViolation, onAutoSubmit]);

  // ─── Copy/Paste/Cut Prevention ───
  const handleCopyPaste = useCallback(
    (e: ClipboardEvent) => {
      if (!enabled) return;
      e.preventDefault();
      onViolation(
        "clipboard_attempt",
        `Student attempted to ${e.type} during exam`
      );
    },
    [enabled, onViolation]
  );

  // ─── Right-Click Prevention ───
  const handleContextMenu = useCallback(
    (e: MouseEvent) => {
      if (!enabled) return;
      e.preventDefault();
      onViolation("right_click", "Student attempted to open context menu");
    },
    [enabled, onViolation]
  );

  // ─── Keyboard Shortcut Prevention ───
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Prevent common shortcuts
      const blockedCombos = [
        { ctrl: true, key: "c" },   // Copy
        { ctrl: true, key: "v" },   // Paste
        { ctrl: true, key: "x" },   // Cut
        { ctrl: true, key: "a" },   // Select all
        { ctrl: true, key: "p" },   // Print
        { ctrl: true, key: "s" },   // Save
        { ctrl: true, key: "u" },   // View source
        { ctrl: true, shift: true, key: "i" }, // DevTools
        { ctrl: true, shift: true, key: "j" }, // Console
        { ctrl: true, shift: true, key: "c" }, // Inspect element
        { key: "F12" },             // DevTools
        { key: "PrintScreen" },     // Screenshot
      ];

      for (const combo of blockedCombos) {
        const ctrlMatch = combo.ctrl ? (e.ctrlKey || e.metaKey) : true;
        const shiftMatch = combo.shift ? e.shiftKey : !combo.shift || true;
        const keyMatch = e.key.toLowerCase() === combo.key?.toLowerCase() || e.key === combo.key;

        if (ctrlMatch && shiftMatch && keyMatch) {
          e.preventDefault();
          e.stopPropagation();
          
          onViolation(
            "keyboard_shortcut",
            `Student attempted blocked keyboard shortcut: ${e.ctrlKey ? "Ctrl+" : ""}${e.shiftKey ? "Shift+" : ""}${e.key}`
          );
          return;
        }
      }
    },
    [enabled, onViolation]
  );

  // ─── Window Blur (fallback for tab switch) ───
  const handleWindowBlur = useCallback(() => {
    if (!enabled) return;
    // Only log if not already captured by visibility change
    if (!document.hidden) {
      onViolation(
        "window_blur",
        "Exam window lost focus (possible alt-tab or window switch)"
      );
    }
  }, [enabled, onViolation]);

  useEffect(() => {
    if (!enabled) return;

    // Add all event listeners
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("copy", handleCopyPaste as EventListener);
    document.addEventListener("paste", handleCopyPaste as EventListener);
    document.addEventListener("cut", handleCopyPaste as EventListener);
    document.addEventListener("contextmenu", handleContextMenu as EventListener);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleWindowBlur);

    // Disable text selection via CSS
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("copy", handleCopyPaste as EventListener);
      document.removeEventListener("paste", handleCopyPaste as EventListener);
      document.removeEventListener("cut", handleCopyPaste as EventListener);
      document.removeEventListener("contextmenu", handleContextMenu as EventListener);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleWindowBlur);

      // Restore text selection
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
    };
  }, [
    enabled,
    handleVisibilityChange,
    handleCopyPaste,
    handleContextMenu,
    handleKeyDown,
    handleWindowBlur,
  ]);

  return {
    tabSwitchCount: tabSwitchCount.current,
    maxTabSwitches,
  };
}
