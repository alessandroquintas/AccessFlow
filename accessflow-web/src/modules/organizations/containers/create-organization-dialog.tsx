"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { OrganizationForm } from "../components/organization-form";

const FORM_ID = "create-organization";

export function CreateOrganizationDialog({ variant = "default" }: { variant?: "default" | "outline" }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={variant} />}>
        <PlusIcon data-icon="inline-start" />
        Criar organização
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar organização</DialogTitle>
          <DialogDescription>Você será o OWNER e poderá convidar as outras pessoas.</DialogDescription>
        </DialogHeader>
        {/* Montado só com o diálogo aberto: cada abertura começa limpa. */}
        {open && (
          <OrganizationForm
            id={FORM_ID}
            onSubmit={({ name }) => {
              // Fase 11b: chamar createOrganization, torná-la a ativa e abrir /overview.
              toast.success("Organização criada", { description: name });
              setOpen(false);
            }}
          />
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button type="submit" form={FORM_ID}>
            Criar organização
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
