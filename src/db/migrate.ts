import { db } from "./index";

async function main() {
  if (process.env.DATABASE_URL) {
    const { migrate } = await import("drizzle-orm/neon-http/migrator");
    await migrate(db as unknown as Parameters<typeof migrate>[0], {
      migrationsFolder: "drizzle",
    });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as unknown as Parameters<typeof migrate>[0], {
      migrationsFolder: "drizzle",
    });
  }
  console.log("Migrations applied.");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
