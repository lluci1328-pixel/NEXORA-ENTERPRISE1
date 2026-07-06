import {
  Building2,
  Hotel,
  UtensilsCrossed,
  Stethoscope,
  HeartPulse,
  GraduationCap,
  Wrench,
  Factory,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import type { BusinessIndustry } from "@/lib/constants";

export const INDUSTRY_ICON: Record<BusinessIndustry, LucideIcon> = {
  REAL_ESTATE: Building2,
  HOTEL: Hotel,
  RESTAURANT: UtensilsCrossed,
  HOSPITAL: HeartPulse,
  CLINIC: Stethoscope,
  EDUCATION: GraduationCap,
  SERVICE: Wrench,
  MANUFACTURING: Factory,
  OTHER: Briefcase,
};

export function IndustryIcon({
  industry,
  size = 18,
  className,
}: {
  industry: string;
  size?: number;
  className?: string;
}) {
  const Icon = INDUSTRY_ICON[industry as BusinessIndustry] ?? Briefcase;
  return <Icon size={size} className={className} />;
}
