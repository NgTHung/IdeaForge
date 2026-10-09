import 'server-only';
import { getServerEnv } from './env';
import { mongoConnection } from './mongo-connection';

export function getMongo() {
  const env = getServerEnv();
  return mongoConnection(env.MONGODB_URI, env.MONGODB_DB_NAME);
}
