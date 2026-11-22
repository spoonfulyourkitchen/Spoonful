

import { supabase, ts } from './supabase';
import { ops, rowError } from './api-core';

function mapComment(row: any, uid: string | null) {
  return {
    _id: row.id,
    sharedRecipeId: row.shared_recipe_id,
    userId: row.user_id,
    userName: row.user_name ?? 'Spoonful cook',
    text: row.text,
    createdAt: row.created_at,
    mine: !!uid && row.user_id === uid,
  };
}

ops['sharing.comments'] = {
  async query({ uid }, args: any) {
    const id = String(args?.sharedRecipeId ?? '');
    if (!id) return [];
    const { data, error } = await supabase
      .from('share_comments')
      .select('*')
      .eq('shared_recipe_id', id)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) throw rowError(error);
    return (data ?? []).map((row: any) => mapComment(row, uid));
  },
};

ops['sharing.commentCounts'] = {
  async query() {
    const counts: Record<string, number> = {};
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from('share_comments')
        .select('shared_recipe_id')
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw rowError(error);
      const rows = data ?? [];
      rows.forEach((row: any) => {
        const key = String(row.shared_recipe_id);
        counts[key] = (counts[key] ?? 0) + 1;
      });
      if (rows.length < pageSize) break;
    }
    return counts;
  },
};

ops['sharing.addComment'] = {
  async mutation({ uid }, args: any) {
    const id = String(args?.sharedRecipeId ?? '');
    const text = String(args?.text ?? '').trim();
    if (!id) throw new Error('Missing recipe.');
    if (!text) throw new Error('Please write something first.');
    if (text.length > 600) throw new Error('That comment is a bit too long (max 600 characters).');
    const { data, error } = await supabase
      .from('share_comments')
      .insert({ shared_recipe_id: id, user_id: uid, user_name: args?.userName ?? null, text, created_at: ts() })
      .select('*')
      .single();
    if (error) throw rowError(error);
    return mapComment(data, uid);
  },
};

ops['sharing.deleteComment'] = {
  async mutation({ uid }, args: any) {
    const id = String(args?.id ?? '');
    if (!id) throw new Error('Missing comment.');
    const { error } = await supabase.from('share_comments').delete().eq('id', id).eq('user_id', uid);
    if (error) throw rowError(error);
    return true;
  },
};

ops['sharing.resultPhotos'] = {
  async query(_ctx, args: any) {
    const id = String(args?.sharedRecipeId ?? '');
    if (!id) return [];
    const { data, error } = await supabase
      .from('share_photos')
      .select('*')
      .eq('shared_recipe_id', id)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw rowError(error);
    return (data ?? []).map((row: any) => ({
      _id: row.id,
      sharedRecipeId: row.shared_recipe_id,
      userName: row.user_name ?? 'Spoonful cook',
      imageUrl: row.image_url,
      createdAt: row.created_at,
    }));
  },
};

ops['sharing.addResultPhoto'] = {
  async mutation({ uid }, args: any) {
    const id = String(args?.sharedRecipeId ?? '');
    const url = String(args?.imageUrl ?? '');
    if (!id || !/^https?:\/\//.test(url)) throw new Error('invalid image url');
    const { error } = await supabase
      .from('share_photos')
      .insert({ shared_recipe_id: id, user_id: uid, user_name: args?.userName ?? null, image_url: url, created_at: ts() });
    if (error) throw rowError(error);
    return true;
  },
};

const REPORT_REASONS = ['spam', 'offensive', 'wrong', 'other'];

ops['sharing.report'] = {
  async mutation({ uid }, args: any) {
    const targetType = String(args?.targetType ?? 'recipe');
    const targetId = String(args?.targetId ?? '');
    const reason = String(args?.reason ?? 'other');
    if (!targetId) throw new Error('Missing target.');
    if (!REPORT_REASONS.includes(reason)) throw new Error('Please pick a reason.');
    const { error } = await supabase
      .from('content_reports')
      .insert({
        target_type: targetType,
        target_id: targetId,
        reporter_id: uid,
        reason,
        note: args?.note ? String(args.note).slice(0, 500) : null,
        status: 'open',
        created_at: ts(),
      });
    if (error && (error as any).code !== '23505') throw rowError(error);
    return true;
  },
};

ops['sharing.followedCooks'] = {
  async query({ uid }) {
    const { data, error } = await supabase.from('cook_follows').select('following_id').eq('follower_id', uid).limit(500);
    if (error) throw rowError(error);
    return (data ?? []).map((row: any) => String(row.following_id));
  },
};

ops['sharing.follow'] = {
  async mutation({ uid }, args: any) {
    const id = String(args?.userId ?? '');
    if (!id || id === uid) throw new Error('You cannot follow yourself.');
    const { error } = await supabase
      .from('cook_follows')
      .upsert({ follower_id: uid, following_id: id, created_at: ts() }, { onConflict: 'follower_id,following_id' });
    if (error) throw rowError(error);
    return true;
  },
};

ops['sharing.unfollow'] = {
  async mutation({ uid }, args: any) {
    const id = String(args?.userId ?? '');
    if (!id) throw new Error('Missing user.');
    const { error } = await supabase.from('cook_follows').delete().eq('follower_id', uid).eq('following_id', id);
    if (error) throw rowError(error);
    return true;
  },
};
