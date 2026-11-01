import '../src/config/env';
import { prisma } from '../src/config/prisma';

async function main() {
  const phone = '9003233881';
  const exact = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, isActive: true, deletedAt: true, phoneVerified: true, emailVerified: true },
  });
  const like = await prisma.user.findMany({
    where: { phone: { contains: '9003233881' } },
    select: { phone: true, isActive: true },
  });
  const recent = await prisma.otpCode.findMany({
    where: { channel: 'SMS' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { purpose: true, destination: true, createdAt: true, consumedAt: true },
  });
  console.log(
    JSON.stringify(
      {
        account: exact
          ? {
              found: true,
              isActive: exact.isActive,
              deleted: Boolean(exact.deletedAt),
              phoneVerified: exact.phoneVerified,
              emailVerified: exact.emailVerified,
            }
          : { found: false },
        otherMatches: like.map((row) => row.phone),
        recentSmsOtps: recent,
      },
      null,
      2
    )
  );
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
