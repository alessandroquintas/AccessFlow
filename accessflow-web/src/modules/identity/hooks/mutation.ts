import { createMutation } from "@/shared/lib/react-query/create-mutation";
import { provisionMeMutation } from "../services";

export const useProvisionMeMutation = createMutation({
  key: ["provision-me"],
  mutationFn: provisionMeMutation,
  invalidate: [{ queryKey: ["me"] }],
  messages: {
    onMutate: "Provisioning user...",
    onSuccess: "User provisioned successfully!",
    onError: "Failed to provision user.",
  },
});
