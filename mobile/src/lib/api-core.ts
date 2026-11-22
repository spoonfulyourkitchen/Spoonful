import { toError } from './supabase';

export type Op = {
  query?: (ctx: { uid: string }, args: any) => Promise<any>;
  mutation?: (ctx: { uid: string }, args: any) => Promise<any>;
  action?: (ctx: { uid: string }, args: any) => Promise<any>;
};

export const ops: Record<string, Op> = {};

export function rowError(e: any): Error {
  return toError(e);
}
