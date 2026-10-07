import 'server-only';

import { createHash } from 'node:crypto';
import { MongoServerError, type Collection } from 'mongodb';
import { mongoConnection } from '../server/mongo-connection.ts';
import { ConnectionError } from './connection-errors.ts';
import { CONNECTION_CACHE_TTL_MS } from './connection-policy.ts';

type Entry = { _id: string; value?: unknown; count?: number; nextAllowedAt?: Date; expiresAt: Date };
export interface ConnectionStore {
  get(keys: string[]): Promise<Map<string, unknown>>;
  put(entries: { key: string; value: unknown }[]): Promise<void>;
  reserve(kind: 'jev' | 'explanation', scope: string, cooldownMs: number): Promise<void>;
}
export const connectionHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
let collectionPromise: Promise<Collection<Entry>> | undefined;
async function collection() {
  if (!collectionPromise) collectionPromise = (async () => {
    if (!process.env.MONGODB_URI?.trim()) throw new ConnectionError('storage_missing', 'Set MONGODB_URI on the server to enable cached, budgeted suggestions.');
    const { client, database } = mongoConnection(process.env.MONGODB_URI, process.env.MONGODB_DB_NAME || 'ideaforge_dev');
    await client.connect();
    const result = database.collection<Entry>('connection_ai_cache');
    await result.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    return result;
  })().catch((error) => { collectionPromise = undefined; throw error; });
  try { return await collectionPromise; }
  catch (error) { throw error instanceof ConnectionError ? error : new ConnectionError('storage_unavailable', 'Suggestion storage is unavailable. No AI request was started. Try again later.'); }
}

function dailyLimit(kind: 'jev' | 'explanation') {
  const key = kind === 'jev' ? 'CONNECTION_JEV_DAILY_REQUEST_LIMIT' : 'CONNECTION_EXPLANATION_DAILY_REQUEST_LIMIT';
  const value = process.env[key];
  const limit = value === undefined || value === '' ? (kind === 'jev' ? 200 : 20) : Number(value);
  if (!Number.isSafeInteger(limit) || limit < 0) throw new ConnectionError('invalid_budget', `Set ${key} to a nonnegative integer.`);
  return limit;
}

export function createConnectionStore(loadCollection: () => Promise<Collection<Entry>>): ConnectionStore {
  return {
  async get(keys) {
    if (!keys.length) return new Map();
    const documents = await (await loadCollection()).find({ _id: { $in: keys.map((key) => `cache:${key}`) }, expiresAt: { $gt: new Date() } }).toArray();
    return new Map(documents.map((document) => [document._id.slice(6), document.value]));
  },
  async put(entries) {
    if (!entries.length) return;
    const expiresAt = new Date(Date.now() + CONNECTION_CACHE_TTL_MS);
    await (await loadCollection()).bulkWrite(entries.map(({ key, value }) => ({ updateOne: { filter: { _id: `cache:${key}` }, update: { $set: { value, expiresAt } }, upsert: true } })));
  },
  async reserve(kind, scope, cooldownMs) {
    const limit = dailyLimit(kind);
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const resetSeconds = Math.ceil((tomorrow.getTime() - now.getTime()) / 1000);
    const exhausted = () => new ConnectionError('budget_exhausted', `Today's ${kind === 'jev' ? 'automatic suggestion' : 'Gemini explanation'} allowance is used up. You can still write connections manually.`, 429, resetSeconds);
    if (!limit) throw exhausted();
    const table = await loadCollection();
    try {
      await table.findOneAndUpdate({ _id: `gate:${kind}:${scope}`, nextAllowedAt: { $lte: now } }, {
        $set: { nextAllowedAt: new Date(now.getTime() + cooldownMs), expiresAt: tomorrow },
      }, { upsert: true });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) throw new ConnectionError('cooldown', 'Another analysis was started recently. Cached results remain available; new analysis will be available shortly.', 429, Math.ceil(cooldownMs / 1000));
      throw error;
    }
    try {
      // The unique ID and conditional increment enforce the allowance across workers.
      await table.findOneAndUpdate({ _id: `budget:${kind}:${now.toISOString().slice(0, 10)}`, count: { $lt: limit } }, {
        $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(tomorrow.getTime() + CONNECTION_CACHE_TTL_MS) },
      }, { upsert: true });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) throw exhausted();
      throw error;
    }
  },
  };
}

export const connectionStore = createConnectionStore(collection);
