import { render, type RenderOptions } from "@testing-library/react";
import { TooltipProvider } from "@/shared/components/ui/tooltip";

export function renderWithProviders(ui: React.ReactElement, options?: RenderOptions) {
  return render(<TooltipProvider>{ui}</TooltipProvider>, options);
}
