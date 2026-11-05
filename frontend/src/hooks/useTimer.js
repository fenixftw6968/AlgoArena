import { useState, useEffect, useRef, useCallback } from 'react';

export function useTimer(initialSeconds, options = {}) {
  const { autoStart = false, onComplete } =
    typeof options === 'function' ? { onComplete: options } : options;

  const [timeLeft, setTimeLeft]   = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const [isDone, setIsDone]       = useState(false);
  const intervalRef = useRef(null);
  const timeLeftRef = useRef(initialSeconds);
  const initialSecondsRef = useRef(initialSeconds);
  const onCompleteRef = useRef(onComplete);

  initialSecondsRef.current = initialSeconds;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!isRunning || timeLeftRef.current <= 0) return undefined;

    intervalRef.current = setInterval(() => {
      const next = Math.max(0, timeLeftRef.current - 1);
      timeLeftRef.current = next;
      setTimeLeft(next);

      if (next === 0) {
        clearInterval(intervalRef.current);
        setIsRunning(false);
        setIsDone(true);
        onCompleteRef.current?.();
      }
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const start = useCallback(() => {
    setIsRunning(true);
    setIsDone(false);
  }, []);

  const pause = useCallback(() => setIsRunning(false), []);

  const reset = useCallback((secs = initialSecondsRef.current) => {
    clearInterval(intervalRef.current);
    const next = Math.max(0, Number.isFinite(secs) ? secs : initialSecondsRef.current);
    timeLeftRef.current = next;
    setTimeLeft(next);
    setIsRunning(false);
    setIsDone(false);
  }, []);

  const urgency = timeLeft <= 10 ? 'critical' : timeLeft <= 30 ? 'warning' : 'normal';
  const formattedTime = `${Math.floor(timeLeft / 60).toString().padStart(2, '0')}:${(timeLeft % 60).toString().padStart(2, '0')}`;

  return { timeLeft, isRunning, isDone, urgency, formattedTime, start, pause, reset };
}
