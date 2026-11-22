

import { supabase } from './supabase';
import { ops, rowError } from './api-core';

ops['announcement.latest'] = {
  async query() {
    const { data, error } = await supabase.rpc('latest_announcement');
    if (error) throw rowError(error);
    const v: any = data;
    return v && typeof v === 'object' && 'latest_announcement' in v ? v.latest_announcement : v;
  },
};
ops['announcement.list'] = {
  async query() {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw rowError(error);
    return (data ?? []).map((r: any) => ({
      _id: r.id,
      title: r.title,
      body: r.body,
      active: !!r.active,
      createdAt: r.created_at,
    }));
  },
};
ops['announcement.send'] = {
  async mutation(_ctx, args: any) {
    const { data, error } = await supabase.rpc('send_announcement', {
      p_title: String(args?.title ?? '').trim(),
      p_body: String(args?.body ?? '').trim(),
    });
    if (error) throw rowError(error);
    return data;
  },
};
ops['announcement.deactivate'] = {
  async mutation(_ctx, args: any) {
    const { error } = await supabase.from('announcements').update({ active: false }).eq('id', args?.id);
    if (error) throw rowError(error);
    return null;
  },
};

function isMissingRpc(error: any): boolean {
  const code = String((error as any)?.code ?? '');
  const text = `${(error as any)?.message ?? ''} ${(error as any)?.details ?? ''} ${(error as any)?.hint ?? ''}`;
  return (
    code === 'PGRST202' ||
    code === '42P01' ||
    code === '42883' ||
    /could not find the function|schema cache|does not exist/i.test(text)
  );
}

ops['updates.latest'] = {
  async query(_ctx, args: any) {
    const clientVersion = String(args?.version ?? '0');
    const { data, error } = await supabase.rpc('latest_update_notice', { p_client_version: clientVersion });
    if (error) {
      if (isMissingRpc(error)) return null;
      throw rowError(error);
    }
    const rows = Array.isArray(data) ? data : data ? [data] : [];
    const row: any = rows[0];
    if (!row) return null;
    return {
      _id: row.id,
      version: row.version,
      title: row.title,
      body: row.body,
      url: row.release_url,
      createdAt: row.created_at,
    };
  },
};

ops['updates.status'] = {
  async query() {
    const { error } = await supabase.rpc('list_update_notices');
    if (error) {
      if (isMissingRpc(error)) return { ready: false, reason: String((error as any)?.message ?? '') };
      return { ready: true, reason: '' };
    }
    return { ready: true, reason: '' };
  },
};

ops['updates.list'] = {
  async query() {
    const { data, error } = await supabase.rpc('list_update_notices');
    if (error) {
      if (isMissingRpc(error)) return [];
      throw rowError(error);
    }
    return (Array.isArray(data) ? data : []).map((r: any) => ({
      _id: r.id,
      version: r.version,
      title: r.title,
      body: r.body,
      url: r.release_url,
      active: !!r.active,
      createdAt: r.created_at,
    }));
  },
};

ops['updates.post'] = {
  async mutation(_ctx, args: any) {
    const { data, error } = await supabase.rpc('post_update_notice', {
      p_version: String(args?.version ?? '').trim(),
      p_url: String(args?.url ?? '').trim(),
      p_title: String(args?.title ?? '').trim() || 'New update',
      p_body: String(args?.body ?? '').trim(),
    });
    if (error) {
      if (isMissingRpc(error)) {
        throw new Error(
          'The update functions are not installed yet. Run db/2.1.4-update-notices.sql in the Supabase SQL editor, then reload the schema cache (Project Settings → API).',
        );
      }
      throw rowError(error);
    }
    return data;
  },
};

ops['updates.deactivate'] = {
  async mutation(_ctx, args: any) {
    const { error } = await supabase.rpc('deactivate_update_notice', { p_id: Number(args?.id) });
    if (error) {
      if (isMissingRpc(error)) return null;
      throw rowError(error);
    }
    return null;
  },
};

ops['account.exportData'] = {
  async action() {
    const { data, error } = await supabase.rpc('export_my_data');
    if (error) throw rowError(error);
    return data ?? {};
  },
};

ops['account.deleteAccount'] = {
  async mutation() {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw rowError(error);
    return true;
  },
};

