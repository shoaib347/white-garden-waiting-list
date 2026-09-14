const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count1 = await prisma.notificationHistory.deleteMany({
    where: { mobile: '0592117495' }
  });
  const count2 = await prisma.reservation.deleteMany({
    where: { mobile: '0592117495' }
  });
  console.log('Deleted notifications:', count1.count);
  console.log('Deleted reservations:', count2.count);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
