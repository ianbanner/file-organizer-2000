import { drizzle } from "drizzle-orm/vercel-postgres";
import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { eq, sql } from "drizzle-orm";
import { sql as psql } from "@vercel/postgres";

// Use this object to send drizzle queries to your DB
export const db = drizzle(psql);
// Create a pgTable that maps to a table in your DB to track user usage
export const UserUsageTable = pgTable(
  "user_usage",
  {
    id: serial("id").primaryKey(),
    userId: text("userId").notNull().unique(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    billingCycle: text("billingCycle").notNull(),
    tokenUsage: integer("tokenUsage").notNull().default(0),
    maxTokenUsage: integer("maxTokenUsage")
      .notNull()
      .default(5000 * 1000),
    subscriptionStatus: text("subscriptionStatus")
      .notNull()
      .default("inactive"),
    paymentStatus: text("paymentStatus").notNull().default("unpaid"),
    lastPayment: timestamp("lastPayment"),
    currentProduct: text("currentProduct"),
    currentPlan: text("currentPlan"),
  },
  (userUsage) => {
    return {
      uniqueUserIdx: uniqueIndex("unique_user_idx").on(userUsage.userId),
    };
  }
);

// createOrUpdateUserUsage will create a new record if one does not exist for the user
// or update the existing record if one does exist
export async function createOrUpdateUserUsage(
  userId: string,
  billingCycle: string
): Promise<void> {
  const result = await db
    .insert(UserUsageTable)
    .values({
      userId,
      billingCycle,
    })
    .onConflictDoUpdate({
      target: [UserUsageTable.userId],
      set: {
        billingCycle,
      },
    });
  console.log("User Usage Results for User ID:", userId);
  // Record created or updated, exit the retry loop
}

// delete me
export async function incrementApiUsage(userId: string): Promise<void> {
  console.log("Incrementing API Usage for User ID:", userId);

  try {
    console.log("Incremented API Usage for User ID:", userId);
  } catch (error) {
    console.error("Error incrementing API Usage for User ID:", userId);
    console.error(error);
  }

  // Increment successful, exit the retry loop
}

// delete me
export const checkApiUsage = async (userId: string) => {
  console.log("Checking API Usage for User ID:", userId);
  try {

    return {
      remaining: 1000 - 0,

      usageError: false,
    };
  } catch (error) {
    console.error("Error checking API Usage for User ID:", userId);
    console.error(error);
    return {
      remaining: 0,
      usageError: true,
    };
  }
};

export async function incrementTokenUsage(
  userId: string,
  tokens: number
): Promise<{ remaining: number; usageError: boolean }> {
  console.log("Incrementing API Usage for User ID:", userId);
  // get current apiUsage

  try {
    const userUsage = await db
      .update(UserUsageTable)
      .set({
        tokenUsage: sql`${UserUsageTable.tokenUsage} + ${tokens}`,
      })
      .where(eq(UserUsageTable.userId, userId))
      .returning({
        remaining: sql<number>`${UserUsageTable.maxTokenUsage} - ${UserUsageTable.tokenUsage}`,
      });

    console.log("Incremented tokens Usage for User ID:", userId, tokens);
    return {
      remaining: userUsage[0].remaining,
      usageError: false,
    };
  } catch (error) {
    console.error("Error incrementing tokens Usage for User ID:", userId);
    console.error(error);
  }
}
export const checkTokenUsage = async (userId: string) => {
  console.log("Checking token usage for User ID:", userId);
  try {
    const userUsage = await db
      .select()
      .from(UserUsageTable)
      .where(eq(UserUsageTable.userId, userId))
      .limit(1)
      .execute();

    console.log("User Usage Results for User ID:", userId, userUsage);

    if (userUsage[0].tokenUsage >= userUsage[0].maxTokenUsage) {
      console.log("User has exceeded their token usage limit");
      return {
        remaining: 0,
        usageError: false,
      };
    }
    console.log("User has not exceeded their token usage limit");
    return {
      remaining: userUsage[0].maxTokenUsage - userUsage[0].tokenUsage,
      usageError: false,
    };
  } catch (error) {
    console.error("Error checking token usage for User ID:", userId);
    console.error(error);
    return {
      remaining: 0,
      usageError: true,
    };
  }
};

// check if has active subscription
export const checkUserSubscriptionStatus = async (userId: string) => {
  console.log("Checking subscription status for User ID:", userId);
  try {
    const userUsage = await db
      .select()
      .from(UserUsageTable)
      .where(eq(UserUsageTable.userId, userId))
      .limit(1)
      .execute();
    console.log("User Usage Results for User ID:", userId, userUsage);
    if (!userUsage[0]) {
      return false;
    }
    if (userUsage[0].paymentStatus === "paid" || userUsage[0].paymentStatus === "succeeded") {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error checking subscription status for User ID:", userId);
    console.error(error);
  }
};

export async function createOrUpdateUserSubscriptionStatus(
  userId: string,
  subscriptionStatus: string,
  paymentStatus: string,
  billingCycle: string
): Promise<void> {
  try {
    await db
      .insert(UserUsageTable)
      .values({
        userId,
        subscriptionStatus,
        paymentStatus,
        billingCycle,
        tokenUsage: 0,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [UserUsageTable.userId],
        set: {
          subscriptionStatus,
          paymentStatus,
          billingCycle,
        },
      });

    console.log(
      `Updated or created subscription status for User ID: ${userId}`
    );
  } catch (error) {
    console.error(
      "Error updating or creating subscription status for User ID:",
      userId
    );
    console.error(error);
  }
}

export async function handleFailedPayment(
  userId: string,
  subscriptionStatus: string,
  paymentStatus: string
): Promise<void> {
  try {
    await db
      .insert(UserUsageTable)
      .values({
        userId,
        subscriptionStatus,
        paymentStatus,
        billingCycle: "",
        tokenUsage: 0,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [UserUsageTable.userId],
        set: {
          subscriptionStatus,
          paymentStatus,
        },
      });

    console.log(
      `Updated or created failed payment status for User ID: ${userId}`
    );
  } catch (error) {
    console.error(
      "Error updating or creating failed payment status for User ID:",
      userId
    );
    console.error(error);
  }
}