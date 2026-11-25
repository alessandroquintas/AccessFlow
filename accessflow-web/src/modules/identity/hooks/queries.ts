import { createQuery } from "@/shared/lib/react-query/create-query";
import { meQuery } from "../services";

export const useMeQuery = createQuery({
  queryKey: ["me"],
  queryFn: meQuery,
});
