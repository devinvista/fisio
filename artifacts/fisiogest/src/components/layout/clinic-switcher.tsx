import { Building2, ChevronDown, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ClinicSwitcher() {
  const { clinicId, clinics, switchClinic, isSuperAdmin } = useAuth();

  if (isSuperAdmin && clinics.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-sidebar-foreground/60 px-3 py-2 bg-black/20 rounded-lg">
        <Building2 className="h-4 w-4" />
        <span>Super Admin</span>
      </div>
    );
  }

  if (clinics.length <= 1 && !isSuperAdmin) return null;

  const activeClinic = clinics.find((c) => c.id === clinicId) ?? clinics[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between text-left text-sidebar-foreground/80 hover:bg-white/10 hover:text-white h-auto py-2 px-3 rounded-lg"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-md bg-primary/30 flex items-center justify-center shrink-0 border border-primary/50">
              <Building2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {activeClinic?.name ?? "Selecionar clínica"}
              </p>
              {isSuperAdmin && (
                <p className="text-[10px] text-sidebar-foreground/50">Super Admin</p>
              )}
            </div>
          </div>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="start" side="right">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Suas Clínicas</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {clinics.map((clinic) => (
          <DropdownMenuItem
            key={clinic.id}
            onClick={() => clinic.id !== clinicId && switchClinic(clinic.id)}
            className="gap-2 cursor-pointer"
          >
            <div className="h-6 w-6 rounded bg-primary/15 flex items-center justify-center">
              <Building2 className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{clinic.name}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {clinic.roles.join(", ")}
              </p>
            </div>
            {clinic.id === clinicId && <Check className="h-4 w-4 text-primary shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
