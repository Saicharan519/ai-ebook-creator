import { healthResponseSchema } from "@ebook/shared";
import { useQuery } from "@tanstack/react-query";
import { API_URL } from "../../lib/api";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    // /health answers 503 with a valid body when the database is down,
    // so read the body whatever the status instead of using apiRequest
    queryFn: async () => {
      const res = await fetch(`${API_URL}/health`);
      return healthResponseSchema.parse(await res.json());
    },
  });
}
