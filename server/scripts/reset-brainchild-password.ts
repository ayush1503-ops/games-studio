import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { db, closeDatabase } from '../src/db/index.js';
import { adminUsers } from '../src/db/schema.js';
import { hashPassword } from '../src/utils/crypto.js';
import { temporaryAdminPassword } from '../src/config/temporary-password.js';

/**
 * Resets password for brainchildgamesin@gmail.com to a known value.
 * Usage:
 *   npx tsx scripts/reset-brainchild-password.ts
 *   BRAINCHILD_ADMIN_PASSWORD=MyNewStrongPass123 npx tsx scripts/reset-brainchild-password.ts
 *   ADMIN_PASSWORD=MyNewStrongPass123 npx tsx scripts/reset-brainchild-password.ts
 *   TEMPORARY_ADMIN_PASSWORD=Another@Temp2026 npx tsx scripts/reset-brainchild-password.ts
 *
 * With no override this restores the shared TEMPORARY password
 * (default "Brainchild@2026" — see src/config/temporary-password.ts), which is
 * the same value seed.ts and migration 0003 install.
 */

const PRIMARY_EMAIL = 'brainchildgamesin@gmail.com';
const DEV_PASSWORD = temporaryAdminPassword();

async function main() {
  const newPassword = process.env.BRAINCHILD_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || DEV_PASSWORD;

  if (newPassword.length < 12) {
    console.error('Password must be at least 12 characters');
    process.exit(1);
  }

  console.log(`\n🔐 Resetting password for ${PRIMARY_EMAIL}...\n`);

  const [existing] = await db
    .select({ id: adminUsers.id, email: adminUsers.email })
    .from(adminUsers)
    .where(sql`lower(${adminUsers.email}) = ${PRIMARY_EMAIL}`)
    .limit(1);

  const hashed = await hashPassword(newPassword);

  if (existing) {
    await db
      .update(adminUsers)
      .set({
        passwordHash: hashed,
        passwordChangedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
        isActive: true,
        role: 'SUPER_ADMIN',
      })
      .where(eq(adminUsers.id, existing.id));
    console.log(`✓ Updated existing account ${existing.email}`);
  } else {
    await db.insert(adminUsers).values({
      email: PRIMARY_EMAIL,
      name: 'Brainchild Games',
      role: 'SUPER_ADMIN',
      isActive: true,
      passwordHash: hashed,
      passwordChangedAt: new Date(),
    });
    console.log(`✓ Created new SUPER_ADMIN account ${PRIMARY_EMAIL}`);
  }

  console.log(`\n🎉 Password for ${PRIMARY_EMAIL} is now: ${newPassword}`);
  console.log(`\n   Login at /admin/login with:`);
  console.log(`   Email: ${PRIMARY_EMAIL}`);
  console.log(`   Password: ${newPassword}`);
  console.log(`\n   You can change it after login in Settings → Change Your Password\n`);
}

main()
  .catch((err) => {
    console.error('Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
