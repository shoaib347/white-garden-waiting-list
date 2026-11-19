import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.notificationHistory.deleteMany();
  await prisma.reservation.deleteMany();

  const now = Date.now();
  await prisma.reservation.createMany({
    data: [
      {
        reservation_id: 'WG-ROSHN-101',
        customer_name: 'Faisal Al-Harbi',
        mobile: '+966 50 412 8890',
        party_size: 4,
        area_name: 'Botanical Terrace',
        queue_number: 1,
        status: 'ready',
        created_at: new Date(now - 22 * 60 * 1000),
        notified_at: new Date(now - 90 * 1000),
        notes: 'Signature patio seating requested.',
        branch_id: 'roshn',
        estimated_wait_mins: 0,
      },
      {
        reservation_id: 'WG-ROSHN-102',
        customer_name: 'Aljawhara Al-Saud',
        mobile: '+966 55 839 2011',
        party_size: 2,
        area_name: 'Fountain Pergola',
        queue_number: 2,
        status: 'waiting',
        created_at: new Date(now - 16 * 60 * 1000),
        notes: 'Quiet corner for afternoon tea.',
        branch_id: 'roshn',
        estimated_wait_mins: 8,
      },
      {
        reservation_id: 'WG-ROSHN-103',
        customer_name: 'Tariq Al-Otaibi',
        mobile: '+966 54 991 3042',
        party_size: 6,
        area_name: 'Indoor Floral Lounge',
        queue_number: 3,
        status: 'waiting',
        created_at: new Date(now - 11 * 60 * 1000),
        notes: 'Family gathering with high chair.',
        branch_id: 'roshn',
        estimated_wait_mins: 18,
      },
      {
        reservation_id: 'WG-OLA-101',
        customer_name: 'Nouf Al-Hassan',
        mobile: '+966 56 220 1988',
        party_size: 3,
        area_name: 'Botanical Terrace',
        queue_number: 1,
        status: 'waiting',
        created_at: new Date(now - 15 * 60 * 1000),
        notes: 'Anniversary dessert surprise.',
        branch_id: 'olaya',
        estimated_wait_mins: 10,
      },
      {
        reservation_id: 'WG-AMMR-101',
        customer_name: 'Bandar Al-Khatib',
        mobile: '+966 50 112 4477',
        party_size: 5,
        area_name: 'Outdoor Sanctuary',
        queue_number: 1,
        status: 'waiting',
        created_at: new Date(now - 18 * 60 * 1000),
        notes: 'Scenic valley view.',
        branch_id: 'ammariayh',
        estimated_wait_mins: 15,
      },
    ],
  });

  const count = await prisma.reservation.count();
  console.log(`SUCCESS: Seeded ${count} White Garden parties in Neon PostgreSQL!`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
