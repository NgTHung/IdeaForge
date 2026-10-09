import 'server-only';
import { MongoClient } from 'mongodb';

// Keep one pool per URI across route bundles and development reloads.
const mongoGlobal = globalThis as typeof globalThis & { ideaForgeMongoClients?: Map<string, MongoClient> };
const clients = mongoGlobal.ideaForgeMongoClients ??= new Map<string, MongoClient>();

export function mongoConnection(uri: string, name: string) {
  let client = clients.get(uri);
  if (!client) {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 5_000, maxPoolSize: 10 });
    clients.set(uri, client);
  }
  return { client, database: client.db(name) };
}
