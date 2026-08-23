import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { StreakHeatmap, StreakStats } from "@/components/dashboard";
import {
  EmptyState,
  Notice,
  Page,
  PageHeader,
  Panel,
  Section,
} from "@/components/ui/page";
import { buildHeatmap } from "@/lib/activity/heatmap";
import { sessionsQuery } from "@/lib/queries";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

/**
 * The dashboard is the session list read a second way.
 *
 * It runs off `sessionsQuery` rather than an analytics endpoint of its own, so
 * arriving here from Sessions costs no request and the two screens can never
 * disagree about what happened. The grid is derived in the browser, which is
 * also the only place that knows the user's timezone — and therefore which day
 * a nine-o'clock session belongs to.
 */
function Dashboard() {
  const sessions = useQuery(sessionsQuery());

  const heatmap = useMemo(
    // `new Date()` is read once per landing rather than per render: a dashboard
    // left open overnight is a stale dashboard, and reloading is the fix. It
    // is not worth a ticking clock to move one square along at midnight.
    () =>
      sessions.data ? buildHeatmap(sessions.data, { today: new Date() }) : null,
    [sessions.data],
  );

  // Rendered in every branch, so a screen that is loading, broken or empty is
  // still recognisably this screen.
  const header = (
    <PageHeader
      // The other two screens count their rows here. This one does not: the
      // days practised are already stated underneath, at the size the number
      // deserves, and saying it twice above the title only made the header
      // argue with the panel below it.
      eyebrow="Practice log"
      title="Dashboard"
      description="How often you sit in the hot seat."
    />
  );

  if (sessions.isPending) {
    return (
      <Page>
        {header}
        <Notice>Loading practice history…</Notice>
      </Page>
    );
  }
  if (sessions.isError || !heatmap) {
    return (
      <Page>
        {header}
        <Notice tone="destructive" role="alert">
          Could not load practice history: {sessions.error?.message}
        </Notice>
      </Page>
    );
  }

  // A year of empty squares is not an invitation, it is a reproach. Until
  // something has been practised the screen says so in a sentence and points
  // at the one move that changes it.
  if (heatmap.daysPractised === 0 && heatmap.longestStreak === 0) {
    return (
      <Page>
        {header}
        <EmptyState>
          No practice to chart yet. Start a session from the{" "}
          <Link
            to="/"
            className="font-medium text-ink underline underline-offset-4"
          >
            question bank
          </Link>{" "}
          and this fills in a square a day.
        </EmptyState>
      </Page>
    );
  }

  return (
    <Page>
      {header}
      <StreakStats heatmap={heatmap} />
      <Section
        title="The last year"
        description="A square for every day, Monday at the top, filled for the days you practised. A day you answered nothing is a day you did not practise."
      >
        <Panel className="px-5 py-5">
          <StreakHeatmap heatmap={heatmap} />
        </Panel>
      </Section>
    </Page>
  );
}
