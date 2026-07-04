import { useEffect, useRef, useState, useCallback } from "react";

interface AudioMonitorProps {
  enabled: boolean;
  onNoiseDetected?: (level: number) => void;
  onStatusChange?: (isMonitoring: boolean) => void;
  threshold?: number; // Volume threshold (0-255), default 30
  sustainedMs?: number; // How long noise must persist to trigger, default 3000ms
}

export function useAudioMonitor({
  enabled,
  onNoiseDetected,
  onStatusChange,
  threshold = 30,
  sustainedMs = 3000,
}: AudioMonitorProps) {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentVolume, setCurrentVolume] = useState(0);
  const [noiseAlerts, setNoiseAlerts] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const noiseStartRef = useRef<number | null>(null);
  const cooldownRef = useRef<boolean>(false);

  const stopMonitoring = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setIsMonitoring(false);
    onStatusChange?.(false);
  }, [onStatusChange]);

  const startMonitoring = useCallback(async () => {
    try {
      setMicError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: false },
      });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);
        const average =
          dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;

        setCurrentVolume(Math.round(average));

        if (average > threshold) {
          if (!noiseStartRef.current) {
            noiseStartRef.current = Date.now();
          } else if (
            Date.now() - noiseStartRef.current >= sustainedMs &&
            !cooldownRef.current
          ) {
            // Sustained noise detected
            cooldownRef.current = true;
            setNoiseAlerts((prev) => prev + 1);
            onNoiseDetected?.(average);

            // 10-second cooldown between alerts
            setTimeout(() => {
              cooldownRef.current = false;
            }, 10000);
          }
        } else {
          noiseStartRef.current = null;
        }

        animationRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
      setIsMonitoring(true);
      onStatusChange?.(true);
    } catch (error) {
      console.error("Audio monitoring error:", error);
      setMicError(
        error instanceof Error
          ? error.message
          : "Failed to access microphone"
      );
      setIsMonitoring(false);
    }
  }, [threshold, sustainedMs, onNoiseDetected, onStatusChange]);

  useEffect(() => {
    if (enabled && !isMonitoring) {
      startMonitoring();
    } else if (!enabled && isMonitoring) {
      stopMonitoring();
    }

    return () => {
      stopMonitoring();
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isMonitoring,
    currentVolume,
    noiseAlerts,
    micError,
    startMonitoring,
    stopMonitoring,
  };
}

// Visual component for audio monitoring status
export default function AudioMonitor({
  enabled,
  onNoiseDetected,
  compact = false,
}: {
  enabled: boolean;
  onNoiseDetected?: (level: number) => void;
  compact?: boolean;
}) {
  const { isMonitoring, currentVolume, noiseAlerts, micError } =
    useAudioMonitor({
      enabled,
      onNoiseDetected,
      threshold: 30,
      sustainedMs: 3000,
    });

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        <div
          className={`w-2 h-2 rounded-full ${
            isMonitoring
              ? currentVolume > 30
                ? "bg-red-500 animate-pulse"
                : "bg-green-500"
              : "bg-gray-400"
          }`}
        />
        <span className="text-xs text-muted-foreground">
          {isMonitoring ? "Mic Active" : micError ? "Mic Error" : "Mic Off"}
        </span>
        {noiseAlerts > 0 && (
          <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
            {noiseAlerts}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <i
            className={`fas fa-microphone ${
              isMonitoring ? "text-green-500" : "text-gray-400"
            }`}
          />
          <span className="text-sm font-medium">Audio Monitor</span>
        </div>
        {noiseAlerts > 0 && (
          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
            {noiseAlerts} alert{noiseAlerts !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Volume bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-100 rounded-full ${
            currentVolume > 30
              ? "bg-red-500"
              : currentVolume > 15
              ? "bg-yellow-500"
              : "bg-green-500"
          }`}
          style={{ width: `${Math.min(100, (currentVolume / 100) * 100)}%` }}
        />
      </div>

      {micError && (
        <p className="text-xs text-red-500 mt-1">
          <i className="fas fa-exclamation-triangle mr-1" />
          {micError}
        </p>
      )}
    </div>
  );
}
