// Creates or resets the demo account. Run with: npm run seed:demo
import "./env.js";
import { connectDb, disconnectDb, usingMongo } from "./store.js";
import { seedDemo } from "./demo.js";

await connectDb();
if (!usingMongo()) {
  console.log("MONGODB_URI isn't set, so there's nothing to save to.");
  console.log("Without MongoDB, the server creates the demo account in memory by itself each time it starts.");
  process.exit(0);
}

const { email, password } = await seedDemo();
console.log("\nDemo account ready (Miami Apartment, 3 rooms).");
console.log(`  Email:    ${email}`);
console.log(`  Password: ${password}\n`);
await disconnectDb();
