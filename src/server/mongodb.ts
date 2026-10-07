import { env } from './env';
import { mongoConnection } from './mongo-connection';

const connection = mongoConnection(env.MONGODB_URI, env.MONGODB_DB_NAME);
export const mongoClient = connection.client;
export const database = connection.database;

export async function connectMongo() {
  await mongoClient.connect();
  await database.command({ ping: 1 });
}
