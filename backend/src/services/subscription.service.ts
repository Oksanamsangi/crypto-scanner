import prisma from "../lib/prisma.js";

const TRIAL_PRICE = 1.99;
const TRIAL_DAYS = 3;

export async function activateTrial(userId: string) {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + TRIAL_DAYS);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
      },
    });

    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    if (
      user.subscriptionPlan === "PRO" &&
      user.subscriptionStatus === "ACTIVE" &&
      user.subscriptionExpiresAt &&
      user.subscriptionExpiresAt > now
    ) {
      throw new Error("ACTIVE_PRO");
    }

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        subscriptionPlan: "PRO",
        subscriptionStatus: "ACTIVE",
        subscriptionExpiresAt: expiresAt,
      },
      select: {
        id: true,
        email: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
      },
    });

    const subscription = await tx.subscription.create({
      data: {
        userId,
        provider: "internal_trial",
        plan: "PRO",
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: expiresAt,
      },
    });

    return {
      user: updatedUser,
      subscription,
      price: TRIAL_PRICE,
      currency: "USD",
      durationDays: TRIAL_DAYS,
    };
  });
}
