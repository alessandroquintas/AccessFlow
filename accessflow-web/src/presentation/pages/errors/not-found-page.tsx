import { CompassIcon } from "lucide-react";
import Link from "next/link";
import { PublicLayout } from "@/presentation/layouts/public-layout";
import { Button } from "@/shared/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/components/ui/empty";

export function NotFoundPage() {
  return (
    <PublicLayout>
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <Empty className="max-w-md">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CompassIcon />
            </EmptyMedia>
            <EmptyTitle>
              <h1>Página não encontrada</h1>
            </EmptyTitle>
            <EmptyDescription>O endereço não existe ou mudou. Confira o link ou volte para as suas organizações.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex-row justify-center">
            <Button render={<Link href="/organizations" />} nativeButton={false}>
              Minhas organizações
            </Button>
            <Button variant="outline" render={<Link href="/" />} nativeButton={false}>
              Início
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    </PublicLayout>
  );
}
