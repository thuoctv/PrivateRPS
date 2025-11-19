export type ChoiceVariant = 'rock' | 'paper' | 'scissors' | 'unknown';

export interface ChoiceDefinition {
  value: number;
  name: string;
  description?: string;
  variant: ChoiceVariant;
  icon?: string;
  label: string;
}

const ICON_BASE = '/rock-paper-scissors';

export const CHOICES: ChoiceDefinition[] = [
  {
    value: 1,
    name: 'Rock',
    description: 'Crushes Scissors',
    variant: 'rock',
    icon: `${ICON_BASE}/rock.svg`,
    label: 'ROCK',
  },
  {
    value: 2,
    name: 'Paper',
    description: 'Covers Rock',
    variant: 'paper',
    icon: `${ICON_BASE}/paper.svg`,
    label: 'PAPER',
  },
  {
    value: 3,
    name: 'Scissors',
    description: 'Cuts Paper',
    variant: 'scissors',
    icon: `${ICON_BASE}/scissors.svg`,
    label: 'SNIP',
  },
];

const DEFAULT_CHOICE: ChoiceDefinition = {
  value: 0,
  name: 'Unknown',
  description: 'Waiting...',
  variant: 'unknown',
  label: '???',
};

const CHOICE_LOOKUP: Record<number, ChoiceDefinition> = CHOICES.reduce(
  (acc, choice) => {
    acc[choice.value] = choice;
    return acc;
  },
  {} as Record<number, ChoiceDefinition>
);

export function getChoiceDefinition(choice?: number | null): ChoiceDefinition {
  if (!choice) {
    return DEFAULT_CHOICE;
  }

  return CHOICE_LOOKUP[choice] ?? DEFAULT_CHOICE;
}

