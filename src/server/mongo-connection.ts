import { MongoClient } from 'mongodb';

const clients = new Map<string, MongoClient>();

export function mongoConnection(uri: string, name: string) {
  let client = clients.get(uri);
  if (!client) {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 5_000, maxPoolSize: 10 });
    clients.set(uri, client);
  }
  return { client, database: client.db(name) };
}
