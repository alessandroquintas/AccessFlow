"use client";

import { ErrorPage } from "@/presentation/pages/errors/error-page";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorPage error={error} retry={retry} />;
}
