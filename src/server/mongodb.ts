import { MongoClient } from "mongodb";
import { env } from "./env";

export const mongoClient = new MongoClient(env.MONGODB_URI);
export const database = mongoClient.db(env.MONGODB_DB_NAME);

export async function connectMongo() {
  await mongoClient.connect();
  await database.command({ ping: 1 });
}
