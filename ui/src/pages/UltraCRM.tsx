import { useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Agent, Issue } from "@paperclipai/shared";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { dashboardApi } from "../api/dashboard";
import { queryKeys } from "../lib/queryKeys";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { Users, Workflow, ShieldCheck, TrendingUp, Gauge, Building2 } from "lucide-react";

type SegmentKey = "inbound" | "opportunity" | "customer";

const SEGMENTS: SegmentKey[] = ["inbound", "opportunity", "customer"];

const SEGMENT_LABEL: Record<SegmentKey, string> = {
  inbound: "Inbound",
  opportunity: "Opportunity",
  customer: "Customer",
};

function detectSegment(issue: Issue): SegmentKey | null {
  const text = `${issue.title} ${issue.description ?? ""}`.toLowerCase();
  if (text.includes("inbound")) return "inbound";
  if (text.includes("opportunity")) return "opportunity";
  if (text.includes("customer") || text.includes("renewal")) return "customer";
  return null;
}

function countBySegment(issues: Issue[]) {
  const counts: Record<SegmentKey, number> = {
    inbound: 0,
    opportunity: 0,
    customer: 0,
  };
  for (const issue of issues) {
    const segment = detectSegment(issue);
    if (!segment) continue;
    counts[segment] += 1;
  }
  return counts;
}

function isCrmAgent(agent: Agent): boolean {
  const identity = `${agent.name} ${agent.title ?? ""} ${agent.role}`.toLowerCase();
  return (
    identity.includes("crm") ||
    identity.includes("coo") ||
    identity.includes("inbound") ||
    identity.includes("opportunity") ||
    identity.includes("customer") ||
    identity.includes("renewal") ||
    identity.includes("deal") ||
    identity.includes("health")
  );
}

export function UltraCRM() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Ultra CRM" }]);
  }, [setBreadcrumbs]);

  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId ?? ""),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });

  const issuesQuery = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId ?? ""),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });

  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId ?? ""),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });

  const crmAgents = useMemo(() => (agentsQuery.data ?? []).filter(isCrmAgent), [agentsQuery.data]);
  const segmentCounts = useMemo(() => countBySegment(issuesQuery.data ?? []), [issuesQuery.data]);
  const openIssues = useMemo(
    () => (issuesQuery.data ?? []).filter((issue) => issue.status !== "done" && issue.status !== "cancelled"),
    [issuesQuery.data],
  );
  const automationRate = useMemo(() => {
    if (openIssues.length === 0) return 0;
    const automated = openIssues.filter((issue) => issue.assigneeAgentId).length;
    return Math.round((automated / openIssues.length) * 100);
  }, [openIssues]);

  if (!selectedCompanyId) {
    return <EmptyState icon={Building2} message="Select a company to open Ultra CRM." />;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Ultra CRM Control Tower</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              High-autonomy, full-funnel operating surface for {selectedCompany?.name ?? "this company"}.
            </p>
          </div>
          <StatusBadge status={dashboardQuery.data?.budgets.activeIncidents ? "blocked" : "in_progress"} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          icon={Users}
          label="CRM Agents"
          value={crmAgents.length}
          helper={`${(agentsQuery.data ?? []).length} total agents`}
        />
        <MetricCard
          icon={Workflow}
          label="Open CRM Issues"
          value={openIssues.length}
          helper={`${dashboardQuery.data?.tasks.inProgress ?? 0} in progress`}
        />
        <MetricCard
          icon={Gauge}
          label="Automation Rate"
          value={`${automationRate}%`}
          helper="Open issues with agent assignee"
        />
        <MetricCard
          icon={ShieldCheck}
          label="Active Incidents"
          value={dashboardQuery.data?.budgets.activeIncidents ?? 0}
          helper={`${dashboardQuery.data?.pendingApprovals ?? 0} approvals pending`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {SEGMENTS.map((segment) => (
          <div key={segment} className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {SEGMENT_LABEL[segment]} Pod
            </h2>
            <p className="mt-2 text-3xl font-semibold">{segmentCounts[segment]}</p>
            <p className="mt-1 text-xs text-muted-foreground">Tagged issues in queue</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Operating Model</h2>
        <ul className="mt-3 space-y-2 text-sm text-foreground/90">
          <li>Control-Tower + Pods: COO governance with autonomous segment execution.</li>
          <li>Cross-pod handoffs are issue-driven: inbound → opportunity → customer.</li>
          <li>Compliance and data-quality checks run as shared-layer controls.</li>
          <li>Escalations open high-priority governance issues instead of blocking routine flow.</li>
        </ul>
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" />
          Pilot mode: full-funnel, high autonomy, guardrailed execution.
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  helper: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

