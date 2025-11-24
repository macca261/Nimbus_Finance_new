/**
 * Simple script to verify Prisma client can connect to the database
 * Run with: ts-node scripts/checkPrismaConnection.ts
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Checking Prisma connection...');
    
    // Try a simple query
    const budgets = await prisma.budget.findMany({ take: 1 });
    console.log('✓ Prisma connection successful');
    console.log(`✓ Found ${budgets.length} budget(s) in database`);
    
    const goals = await prisma.goal.findMany({ take: 1 });
    console.log(`✓ Found ${goals.length} goal(s) in database`);
    
    console.log('\nPrisma models are accessible and database is connected.');
  } catch (error: any) {
    console.error('✗ Prisma connection failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

