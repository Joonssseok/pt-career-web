import { HOSPITAL_WORK_NOTICE } from "@/lib/specialties/catalog";

export function HospitalWorkNotice({
  className = "mt-3 text-xs leading-relaxed text-slate-500",
}: {
  className?: string;
}) {
  return <p className={className}>{HOSPITAL_WORK_NOTICE}</p>;
}
