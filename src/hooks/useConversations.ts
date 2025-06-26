import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Conversation } from "@/types/chat";
import { createTimeoutPromise, isRLSError } from "@/utils/chatHelpers";

export const useConversations = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!user?.id) {
      setConversations([]);
      setLoading(false);
      return;
    }

    try {
      console.log("Fetching conversations for user:", user.id);
      setLoading(true);
      setError(null);

      // Enhanced error handling for conversation participants with retry logic
      let participantData;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          const { data, error: participantError } = await supabase
            .from("conversation_participants")
            .select("conversation_id")
            .eq("user_id", user.id);

          if (participantError) {
            throw participantError;
          }

          participantData = data;
          break;
        } catch (error) {
          retryCount++;
          console.warn(
            `Conversation fetch attempt ${retryCount} failed:`,
            error
          );

          if (retryCount >= maxRetries) {
            console.error(
              "Max retries reached for fetching participants:",
              error
            );

            if (isRLSError(error)) {
              setError("Authentication required to access conversations");
              toast({
                title: "Authentication Error",
                description:
                  "Please log out and log back in to access your conversations",
                variant: "destructive",
              });
            } else {
              setError("Failed to load conversations");
              toast({
                title: "Error",
                description:
                  "Failed to load conversations. Please check your connection and try again.",
                variant: "destructive",
              });
            }
            return;
          }

          // Wait before retry with exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * retryCount)
          );
        }
      }

      if (!participantData || participantData.length === 0) {
        console.log("No conversations found for user");
        setConversations([]);
        return;
      }

      const conversationIds = participantData.map((p) => p.conversation_id);
      console.log("Found conversation IDs:", conversationIds);

      // Enhanced conversation details fetching with timeout protection
      const conversationPromise = supabase
        .from("conversations")
        .select("id, name, is_group, created_at")
        .in("id", conversationIds)
        .order("created_at", { ascending: false });

      const { data: conversationData, error: conversationError } =
        (await Promise.race([
          conversationPromise,
          createTimeoutPromise(10000, "Conversation fetch timeout"),
        ])) as any;

      if (conversationError) {
        console.error("Error fetching conversations:", conversationError);
        setError("Failed to load conversation details");
        toast({
          title: "Error",
          description:
            "Failed to load conversation details. Please try refreshing the page.",
          variant: "destructive",
        });
        return;
      }

      // Enhanced participant enrichment with better error handling
      const enrichedConversations = await Promise.allSettled(
        (conversationData || []).map(async (conversation) => {
          try {
            if (conversation.is_group) {
              return {
                id: conversation.id,
                name: conversation.name,
                is_group: conversation.is_group,
                created_at: conversation.created_at,
              };
            }

            // For direct messages, get the other participant with enhanced timeout protection
            const participantPromise = supabase
              .from("conversation_participants")
              .select("user_id")
              .eq("conversation_id", conversation.id)
              .neq("user_id", user.id)
              .limit(1);

            const { data: otherParticipants, error: participantsError } =
              (await Promise.race([
                participantPromise,
                createTimeoutPromise(5000, "Participant fetch timeout"),
              ])) as any;

            if (
              participantsError ||
              !otherParticipants ||
              otherParticipants.length === 0
            ) {
              console.warn(
                "Could not fetch other participants for conversation:",
                conversation.id
              );
              return {
                id: conversation.id,
                name: conversation.name || "Unknown Chat",
                is_group: conversation.is_group,
                created_at: conversation.created_at,
              };
            }

            // Enhanced profile fetching with fallback
            const profilePromise = supabase
              .from("profiles")
              .select("id, full_name, avatar_url")
              .eq("id", otherParticipants[0].user_id)
              .limit(1);

            const { data: profileArray, error: profileError } =
              (await Promise.race([
                profilePromise,
                createTimeoutPromise(3000, "Profile fetch timeout"),
              ])) as any;
            const profile = profileArray?.[0];
            let otherUser = null;
            if (!profileError && profile) {
              otherUser = {
                id: profile.id,
                name: profile.full_name || "Unknown User",
                avatar_url: profile.avatar_url,
              };
            }

            return {
              id: conversation.id,
              name:
                conversation.name ||
                (otherUser?.name
                  ? `Chat with ${otherUser.name}`
                  : "Unknown Chat"),
              is_group: conversation.is_group,
              created_at: conversation.created_at,
              other_user: otherUser,
            };
          } catch (error) {
            console.error("Error enriching conversation:", error);
            return {
              id: conversation.id,
              name: conversation.name || "Unknown Chat",
              is_group: conversation.is_group,
              created_at: conversation.created_at,
            };
          }
        })
      );

      // Filter successful results and log failures
      const validConversations = enrichedConversations
        .filter((result) => result.status === "fulfilled")
        .map((result) => (result as PromiseFulfilledResult<any>).value);

      const failedCount = enrichedConversations.filter(
        (result) => result.status === "rejected"
      ).length;

      console.log(
        `Successfully loaded ${validConversations.length} conversations`
      );
      if (failedCount > 0) {
        console.warn(`Failed to enrich ${failedCount} conversations`);
        toast({
          title: "Partial Load",
          description: `${validConversations.length} conversations loaded successfully, ${failedCount} had issues`,
          variant: "default",
        });
      }

      setConversations(validConversations);
    } catch (error) {
      console.error("Unexpected error in fetchConversations:", error);
      setError("Failed to load conversations");
      toast({
        title: "Error",
        description:
          "An unexpected error occurred while loading conversations. Please refresh the page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  return {
    conversations,
    loading,
    error,
    fetchConversations,
  };
};
