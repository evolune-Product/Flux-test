import { useState, useCallback } from "react";

/**
 * Multi-step wizard navigation hook.
 *
 * @param {number} initialStep - Starting step (default 1).
 * @param {number} maxStep - Total number of steps.
 * @returns {{ step, maxStep, goToStep, advance, back }}
 */
export function useStepNav(initialStep = 1, maxStep = 1) {
  const [step, setStep] = useState(initialStep);

  const goToStep = useCallback(
    (n) => {
      if (n >= 1 && n <= maxStep) setStep(n);
    },
    [maxStep]
  );

  const advance = useCallback(() => {
    setStep((s) => Math.min(s + 1, maxStep));
  }, [maxStep]);

  const back = useCallback(() => {
    setStep((s) => Math.max(s - 1, 1));
  }, []);

  return { step, maxStep, goToStep, advance, back };
}
