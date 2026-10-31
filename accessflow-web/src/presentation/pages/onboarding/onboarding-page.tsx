import { RequireSession } from "@/modules/auth/containers/require-session";
import { SignOutButton } from "@/modules/auth/containers/sign-out-button";
import { Onboarding } from "@/modules/identity/containers/onboarding";
import { Logo } from "@/shared/components/brand/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";

export function OnboardingPage() {
  return (
    <RequireSession profile="missing">
      <div className="flex min-h-svh flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
        <Logo />
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>
              <h1 className="font-heading text-xl font-semibold">Como devemos chamar você?</h1>
            </CardTitle>
            <CardDescription>
              É seu primeiro acesso. Informe seu nome para criar o perfil; depois você cria uma
              organização ou aceita um convite.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Onboarding />
          </CardContent>
        </Card>
        <SignOutButton />
      </div>
    </RequireSession>
  );
}
