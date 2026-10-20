import { BarChart3, ClipboardList, Type, type LucideIcon } from "lucide-react";
// Every tool in this app: the home page lists them, the top bar links them.
export type Tool = { href: string; name: string; description: string; icon: LucideIcon };
export const TOOLS: Tool[] = [
  {
    href: "/surveys",
    name: "Surveys",
    description: "Build a survey, send each customer their own trial link, and see who answered and what they picked.",
    icon: ClipboardList,
  },
  {
    href: "/analytics",
    name: "Analytics",
    description: "Users per plan, failed processes, estimated profit and loss, and beta access per customer.",
    icon: BarChart3,
  },
  {
    href: "/templates",
    name: "Caption templates",
    description: "Every caption template in the database; choose which ones the editor's gallery shows.",
    icon: Type,
  },
];
