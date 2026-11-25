import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { convexClient } from './convex-auth';
import {
  DEFAULT_INTRO_ANSWERS,
  normalizeIntroAnswers,
  readIntroAnswers,
  saveIntroAnswers,
  type IntroAnswers,
} from './intro-answers';
import { readLocalPrefs, saveLocalPrefs, type LocalPrefs } from './local-prefs';
import { markLocalOnboarded } from './onboarding';
import { goalTagFromOnboarding, setNutritionProfile } from './nutrition-profile';

function onboardingFromUser(user: any): IntroAnswers | null {
  const raw = user?.onboarding;
  if (!raw || typeof raw !== 'object') return null;
  const answers = normalizeIntroAnswers({
    ...DEFAULT_INTRO_ANSWERS,
    ...raw,
    completedAt:
      Number(raw.completedAt) || Number(raw.onboardedAt) || Number(user?.onboardedAt) || 0,
  });
  if (!answers || !answers.completedAt) return null;
  return answers;
}

function applyAnswersLocally(answers: IntroAnswers): void {
  setNutritionProfile({
    sex: answers.sex,
    age: answers.age,
    height: answers.height,
    weight: answers.weight,
    activity: answers.activity,
    goal: goalTagFromOnboarding(answers.goal),
    targetWeight: answers.targetWeight || undefined,
    syncedAt: answers.completedAt,
  });
  void saveLocalPrefs({
    name: answers.name,
    goal: answers.goal,
    diet: answers.diet,
    allergies: answers.allergies,
    experience: answers.experience,
    householdSize: answers.householdSize,
    cookTime: answers.cookTime,
    cuisines: answers.cuisines,
  }).catch(() => {});
  void AsyncStorage.setItem('spoonful:want-reminders', answers.notifications ? '1' : '0').catch(() => {});
  markLocalOnboarded();
}

/**
 * Restores onboarding answers and preferences that live on the account.
 * Called after sign-in, so a reinstall or a new phone picks them up again.
 */
export async function hydrateAccountFromServer(user: any): Promise<boolean> {
  if (!user) return false;

  const localPrefs = await readLocalPrefs();
  const remotePrefs = user.prefs && typeof user.prefs === 'object' ? user.prefs : null;
  const restored: LocalPrefs = {};
  if (!localPrefs.startedAt && remotePrefs?.startedAt) restored.startedAt = Number(remotePrefs.startedAt);
  // Accounts from before 3.7.3 only have these columns on the server.
  if (!localPrefs.name && user.name) restored.name = String(user.name);
  if (!localPrefs.goal && user.goal) restored.goal = String(user.goal);
  if (!localPrefs.diet && user.diet) restored.diet = String(user.diet);
  if (!localPrefs.experience && user.cookingExperience) restored.experience = String(user.cookingExperience);
  if (!localPrefs.allergies?.length && Array.isArray(user.allergies) && user.allergies.length) {
    restored.allergies = user.allergies.filter((item: unknown): item is string => typeof item === 'string');
  }
  if (Object.keys(restored).length) await saveLocalPrefs(restored).catch(() => {});

  const remote = onboardingFromUser(user);
  if (!remote) {
    // Existing account created before 3.7.3: send what is still on this phone up once.
    const local = await readIntroAnswers();
    if (local?.completedAt) {
      await saveOnboardingToAccount(local).catch(() => {});
    }
    return false;
  }

  const local = await readIntroAnswers();
  if (!local?.completedAt) {
    await saveIntroAnswers(remote).catch(() => {});
    applyAnswersLocally(remote);
    return true;
  }

  // Fill in details that only exist on the account (e.g. after a partial restore).
  await saveIntroAnswers({ ...remote, ...local }).catch(() => {});
  return false;
}

export async function saveOnboardingToAccount(
  answers: Partial<IntroAnswers>,
  prefs?: Record<string, any>,
): Promise<void> {
  const completedAt = Number(answers.completedAt) || Date.now();
  const onboarding = {
    ...DEFAULT_INTRO_ANSWERS,
    ...answers,
    completedAt,
  };
  await convexClient.mutation(api.users.saveProfile as any, {
    name: onboarding.name || undefined,
    goal: onboarding.goal,
    diet: onboarding.diet,
    allergies: onboarding.allergies,
    cookingExperience: onboarding.experience || undefined,
    onboardedAt: completedAt,
    onboarding,
    prefs: prefs ?? { startedAt: completedAt },
  });
}

export async function importAccountData(data: any): Promise<Record<string, number>> {
  const result = await convexClient.mutation(api.account.importData as any, { data });
  return (result ?? {}) as Record<string, number>;
}
