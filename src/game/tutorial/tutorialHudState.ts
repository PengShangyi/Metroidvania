import type { InputDevice } from '../input/device';
import { tutorialControlHint } from '../ui/helpContent';
import { TUTORIAL_STEPS } from './tutorialPlan';

export interface TutorialHudState {
  /** 从 1 开始，直接就是要显示的序号。 */
  step: number;
  stepCount: number;
  title: string;
  objective: string;
  effect: string;
  complete: boolean;
}

export function initialTutorialHudState(): TutorialHudState {
  return {
    step: 1,
    stepCount: TUTORIAL_STEPS.length,
    title: '',
    objective: '',
    effect: '',
    complete: false,
  };
}

export function tutorialHudState(stepIndex: number, device: InputDevice): TutorialHudState {
  const step = TUTORIAL_STEPS[stepIndex];
  if (!step) return initialTutorialHudState();
  return {
    step: stepIndex + 1,
    stepCount: TUTORIAL_STEPS.length,
    title: step.title,
    objective: `${tutorialControlHint(step.id, device)}：${step.objective}`,
    effect: step.effect,
    complete: false,
  };
}

export function withEffect(state: TutorialHudState, effect: string): TutorialHudState {
  return { ...state, effect };
}

export function withComplete(state: TutorialHudState): TutorialHudState {
  return { ...state, complete: true };
}
