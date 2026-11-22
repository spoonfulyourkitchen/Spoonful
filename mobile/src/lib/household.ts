

import { requireUserId, supabase } from './supabase';

export type HhMember = {
  userId: string;
  name: string;
  email: string;
  image?: string | null;
  householdRole: 'admin' | 'member';
  lastSeen?: number | null;
};

export type HhTask = {
  id: string;
  title: string;
  done: boolean;
  assignedTo?: string | null;
  assignedName?: string | null;
  userId: string;
  createdAt: number;
};

export type HhNote = { id: string; body: string; authorName: string; userId: string; createdAt: number };
export type HhPlanEntry = { id: string; day: number; slot: string; title: string; userId: string };
export type HhPantryItem = { id: string; name: string; qty?: string | null; expiresOn?: string | null };
export type HhExpense = { id: string; payerName: string; title: string; amount: number; userId: string; createdAt: number };
export type HhEvent = { id: string; actorName: string; kind: string; text: string; createdAt: number };
export type HhShared = { id: string; recipeKey: string; title: string; imageUrl?: string | null; userId: string };
export type HhStats = {
  members: number;
  cookingSessions: number;
  tasksOpen: number;
  tasksDone: number;
  expensesSum: number;
  pantryItems: number;
  planEntries: number;
};

function missing(error: any): boolean {
  const code = String(error?.code ?? '');
  const text = `${error?.message ?? ''} ${error?.details ?? ''}`;
  return code === '42P01' || code === '42883' || code === 'PGRST202' || /does not exist|could not find the (table|function)|schema cache/i.test(text);
}

async function safe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (e: any) {
    if (!missing(e)) console.warn('[spoonful] household query failed:', e?.message ?? e);
    return fallback;
  }
}

const num = (v: any) => Number(v ?? 0);
const time = (v: any) => (v ? new Date(v).getTime() : 0);

export async function currentHouseholdId(): Promise<string | null> {
  return safe(async () => {
    const uid = await requireUserId();
    const { data } = await supabase.from('users').select('household_id').eq('id', uid).maybeSingle();
    return (data as any)?.household_id ?? null;
  }, null);
}

export async function renameHousehold(name: string): Promise<void> {
  await safe(async () => {
    await supabase.rpc('rename_household', { p_name: name });
    return null;
  }, null);
}

export async function fetchMembers(): Promise<HhMember[]> {
  return safe(async () => {
    const { data, error } = await supabase.rpc('household_members');
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      userId: String(r.user_id),
      name: String(r.name ?? ''),
      email: String(r.email ?? ''),
      image: r.image ?? null,
      householdRole: r.household_role === 'admin' ? 'admin' : 'member',
      lastSeen: r.last_seen ? time(r.last_seen) : null,
    }));
  }, [] as HhMember[]);
}

export async function setHouseholdRole(userId: string, role: 'admin' | 'member'): Promise<void> {
  await safe(async () => {
    await supabase.rpc('set_household_role', { p_user_id: userId, p_role: role });
    return null;
  }, null);
}

export async function fetchStats(): Promise<HhStats | null> {
  return safe(async () => {
    const { data, error } = await supabase.rpc('household_stats');
    if (error) throw error;
    const r: any = Array.isArray(data) ? data[0] : data;
    if (!r) return null;
    return {
      members: num(r.members),
      cookingSessions: num(r.cooking_sessions),
      tasksOpen: num(r.tasks_open),
      tasksDone: num(r.tasks_done),
      expensesSum: num(r.expenses_sum),
      pantryItems: num(r.pantry_items),
      planEntries: num(r.plan_entries),
    };
  }, null);
}

export async function fetchEvents(): Promise<HhEvent[]> {
  return safe(async () => {
    const { data, error } = await supabase
      .from('household_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      id: String(r.id),
      actorName: String(r.actor_name ?? ''),
      kind: String(r.kind ?? 'info'),
      text: String(r.text ?? ''),
      createdAt: time(r.created_at),
    }));
  }, [] as HhEvent[]);
}

export async function logEvent(actorName: string, kind: string, text: string): Promise<void> {
  await safe(async () => {
    const uid = await requireUserId();
    const householdId = await currentHouseholdId();
    if (!householdId) return null;
    await supabase.from('household_events').insert({
      household_id: householdId,
      user_id: uid,
      actor_name: actorName,
      kind,
      text,
      created_at: new Date().toISOString(),
    });
    return null;
  }, null);
}

export async function fetchPlan(): Promise<HhPlanEntry[]> {
  return safe(async () => {
    const { data, error } = await supabase.from('household_plan').select('*').order('day', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      id: String(r.id),
      day: num(r.day) || 1,
      slot: String(r.slot ?? 'dinner'),
      title: String(r.title ?? ''),
      userId: String(r.user_id),
    }));
  }, [] as HhPlanEntry[]);
}

export async function addPlanEntry(day: number, slot: string, title: string): Promise<void> {
  await safe(async () => {
    const uid = await requireUserId();
    const householdId = await currentHouseholdId();
    if (!householdId || !title.trim()) return null;
    await supabase.from('household_plan').insert({
      household_id: householdId,
      user_id: uid,
      day: Math.max(1, Math.min(7, day)),
      slot,
      title: title.trim().slice(0, 120),
      created_at: new Date().toISOString(),
    });
    return null;
  }, null);
}

export async function removePlanEntry(id: string): Promise<void> {
  await safe(async () => {
    await supabase.from('household_plan').delete().eq('id', id);
    return null;
  }, null);
}

export async function fetchPantry(): Promise<HhPantryItem[]> {
  return safe(async () => {
    const { data, error } = await supabase.from('household_pantry').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r: any): HhPantryItem => ({
      id: String(r.id),
      name: String(r.name ?? ''),
      qty: r.qty ?? null,
      expiresOn: r.expires_on ?? null,
    }));
  }, [] as HhPantryItem[]);
}

export async function addPantryItem(name: string, qty?: string | null, expiresOn?: string | null): Promise<void> {
  await safe(async () => {
    const uid = await requireUserId();
    const householdId = await currentHouseholdId();
    if (!householdId || !name.trim()) return null;
    await supabase.from('household_pantry').insert({
      household_id: householdId,
      user_id: uid,
      name: name.trim().slice(0, 80),
      qty: qty?.trim() ? qty.trim().slice(0, 40) : null,
      expires_on: expiresOn ?? null,
      created_at: new Date().toISOString(),
    });
    return null;
  }, null);
}

export async function removePantryItem(id: string): Promise<void> {
  await safe(async () => {
    await supabase.from('household_pantry').delete().eq('id', id);
    return null;
  }, null);
}

export async function fetchExpenses(): Promise<HhExpense[]> {
  return safe(async () => {
    const { data, error } = await supabase.from('household_expenses').select('*').order('created_at', { ascending: false }).limit(80);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      id: String(r.id),
      payerName: String(r.payer_name ?? ''),
      title: String(r.title ?? ''),
      amount: num(r.amount),
      userId: String(r.user_id),
      createdAt: time(r.created_at),
    }));
  }, [] as HhExpense[]);
}

export async function addExpense(title: string, amount: number, payerName: string): Promise<void> {
  await safe(async () => {
    const uid = await requireUserId();
    const householdId = await currentHouseholdId();
    const value = Math.round(Number(amount) * 100) / 100;
    if (!householdId || !title.trim() || !Number.isFinite(value) || value <= 0) return null;
    await supabase.from('household_expenses').insert({
      household_id: householdId,
      user_id: uid,
      payer_name: payerName,
      title: title.trim().slice(0, 80),
      amount: value,
      created_at: new Date().toISOString(),
    });
    return null;
  }, null);
}

export async function removeExpense(id: string): Promise<void> {
  await safe(async () => {
    await supabase.from('household_expenses').delete().eq('id', id);
    return null;
  }, null);
}

export async function fetchSharedRecipes(): Promise<HhShared[]> {
  return safe(async () => {
    const { data, error } = await supabase.from('household_shared_recipes').select('*').order('created_at', { ascending: false }).limit(60);
    if (error) throw error;
    return (data ?? []).map((r: any): HhShared => ({
      id: String(r.id),
      recipeKey: String(r.recipe_key ?? ''),
      title: String(r.title ?? ''),
      imageUrl: r.image_url ?? null,
      userId: String(r.user_id),
    }));
  }, [] as HhShared[]);
}

export async function shareRecipe(recipeKey: string, title: string, imageUrl?: string | null): Promise<void> {
  await safe(async () => {
    const uid = await requireUserId();
    const householdId = await currentHouseholdId();
    if (!householdId || !recipeKey) return null;
    await supabase.from('household_shared_recipes').upsert(
      {
        household_id: householdId,
        user_id: uid,
        recipe_key: recipeKey.slice(0, 120),
        title: title.slice(0, 120),
        image_url: imageUrl ?? null,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'household_id,recipe_key' },
    );
    return null;
  }, null);
}

export async function unshareRecipe(id: string): Promise<void> {
  await safe(async () => {
    await supabase.from('household_shared_recipes').delete().eq('id', id);
    return null;
  }, null);
}

export type HhShoppingItem = { name: string; checked: boolean };
export type HhList = {
  id: string;
  userId: string;
  ownerName: string;
  title: string;
  items: HhShoppingItem[];
  createdAt: number;
};

const asItems = (raw: any): HhShoppingItem[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((i: any) => (typeof i === 'string' ? { name: i, checked: false } : { name: String(i?.name ?? ''), checked: !!i?.checked }))
    .filter((i) => !!i.name);
};

export async function fetchHouseholdLists(): Promise<HhList[]> {
  return safe(async () => {
    const { data, error } = await supabase.rpc('household_lists_state');
    if (error) throw error;
    return ((data ?? []) as any[]).map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      ownerName: String(r.owner_name ?? ''),
      title: String(r.title ?? ''),
      items: asItems(r.items),
      createdAt: time(r.created_at),
    }));
  }, [] as HhList[]);
}

let shareInFlight = false;

export async function shareHouseholdList(title: string, items: HhShoppingItem[]): Promise<{ ok: boolean; error?: string }> {
  if (shareInFlight) return { ok: false, error: 'busy' };
  shareInFlight = true;
  try {
    const { error } = await supabase.rpc('share_household_list', { p_title: title, p_items: items });
    if (error) return { ok: false, error: String(error.message ?? '') };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  } finally {
    shareInFlight = false;
  }
}

export async function updateHouseholdList(id: string, items: HhShoppingItem[]): Promise<void> {
  const { error } = await supabase.rpc('update_household_list', { p_id: id, p_items: items });
  if (error && !missing(error)) throw new Error(error.message);
}

export async function removeHouseholdList(id: string): Promise<void> {
  await safe(async () => {
    await supabase.rpc('remove_household_list', { p_id: id });
    return null;
  }, null);
}

export async function addNamesToShopping(names: string[], recipeTitle?: string): Promise<number> {
  return safe(async () => {
    const uid = await requireUserId();
    const items = names.map((n) => n.trim()).filter(Boolean);
    if (!items.length) return 0;
    const { error } = await supabase.from('shopping_list_items').insert(
      items.map((name) => ({
        user_id: uid,
        name: name.slice(0, 120),
        recipe_key: null,
        recipe_title: recipeTitle ?? null,
        checked: false,
        created_at: new Date().toISOString(),
      })),
    );
    if (error) throw error;
    return items.length;
  }, 0);
}

export async function fetchTasks(): Promise<HhTask[]> {
  return safe(async () => {
    const { data, error } = await supabase.from('household_tasks').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r: any): HhTask => ({
      id: String(r.id),
      title: String(r.title ?? ''),
      done: !!r.done,
      assignedTo: r.assigned_to ?? null,
      assignedName: r.assigned_name ?? null,
      userId: String(r.user_id),
      createdAt: time(r.created_at),
    }));
  }, [] as HhTask[]);
}

export async function addTask(title: string, assignedTo?: string | null, assignedName?: string | null): Promise<void> {
  await safe(async () => {
    const uid = await requireUserId();
    const householdId = await currentHouseholdId();
    if (!householdId || !title.trim()) return null;
    await supabase.from('household_tasks').insert({
      household_id: householdId,
      user_id: uid,
      title: title.trim().slice(0, 120),
      done: false,
      assigned_to: assignedTo ?? null,
      assigned_name: assignedName ?? null,
      created_at: new Date().toISOString(),
    });
    return null;
  }, null);
}

export async function setTaskDone(id: string, done: boolean): Promise<void> {
  const { error } = await supabase
    .from('household_tasks')
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq('id', id);
  if (error && !missing(error)) throw new Error(error.message);
}

export async function setTaskAssignee(id: string, userId: string | null, name: string | null): Promise<void> {
  const { error } = await supabase
    .from('household_tasks')
    .update({ assigned_to: userId, assigned_name: name })
    .eq('id', id);
  if (error && !missing(error)) throw new Error(error.message);
}

export async function removeTask(id: string): Promise<void> {
  await safe(async () => {
    await supabase.from('household_tasks').delete().eq('id', id);
    return null;
  }, null);
}

export async function fetchNotes(): Promise<HhNote[]> {
  return safe(async () => {
    const { data, error } = await supabase.from('household_notes').select('*').order('created_at', { ascending: false }).limit(40);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      id: String(r.id),
      body: String(r.body ?? ''),
      authorName: String(r.author_name ?? ''),
      userId: String(r.user_id),
      createdAt: time(r.created_at),
    }));
  }, [] as HhNote[]);
}

export async function addNote(body: string, authorName: string): Promise<void> {
  await safe(async () => {
    const uid = await requireUserId();
    const householdId = await currentHouseholdId();
    if (!householdId || !body.trim()) return null;
    await supabase.from('household_notes').insert({
      household_id: householdId,
      user_id: uid,
      author_name: authorName,
      body: body.trim().slice(0, 400),
      created_at: new Date().toISOString(),
    });
    return null;
  }, null);
}

export async function removeNote(id: string): Promise<void> {
  await safe(async () => {
    await supabase.from('household_notes').delete().eq('id', id);
    return null;
  }, null);
}
