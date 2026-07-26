import { getOwnerContext } from "@/lib/owner";
import { getFeedback } from "@/lib/engine";
import { FeedbackClient } from "./feedback-client";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const { supabase, restaurant } = await getOwnerContext("/dashboard/feedback");
  const feedback = await getFeedback(supabase, restaurant.id);
  return <FeedbackClient restaurant={restaurant} initialFeedback={feedback} />;
}
