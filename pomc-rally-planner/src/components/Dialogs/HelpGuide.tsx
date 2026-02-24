import { useState } from 'react';

type Page = 'overview' | 'typecodes' | 'speedtables' | 'timecalc' | 'nodelibrary' | 'recon' | 'export' | 'shortcuts';

const PAGES: { key: Page; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'typecodes', label: 'Type Codes' },
  { key: 'speedtables', label: 'Speed Tables' },
  { key: 'timecalc', label: 'Time Calculations' },
  { key: 'nodelibrary', label: 'Nodes & Routes' },
  { key: 'recon', label: 'Reconnaissance' },
  { key: 'export', label: 'Export' },
  { key: 'shortcuts', label: 'Shortcuts' },
];

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 700,
      fontFamily: 'monospace',
      background: color,
      color: '#fff',
      marginRight: '6px',
      minWidth: '18px',
      textAlign: 'center',
    }}>
      {children}
    </span>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--color-primary-light)',
      border: '1px solid var(--color-primary)',
      borderRadius: '8px',
      padding: '12px 16px',
      margin: '12px 0',
      fontSize: '13px',
      lineHeight: '1.6',
    }}>
      {children}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'monospace',
      fontSize: '12px',
      background: 'var(--color-bg-secondary)',
      padding: '12px 16px',
      borderRadius: '8px',
      lineHeight: '2',
      margin: '8px 0 12px 0',
      border: '1px solid var(--color-border)',
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 style={{
      fontSize: '14px',
      color: 'var(--color-text)',
      margin: '20px 0 6px 0',
      fontWeight: 700,
    }}>
      {children}
    </h4>
  );
}

// ─── Page Content ────────────────────────────────────────

function OverviewPage() {
  return (
    <>
      <h2 style={{ marginTop: 0, marginBottom: '4px' }}>Welcome to POMC Rally Planner</h2>
      <p style={{ color: 'var(--color-text-muted)', marginTop: 0 }}>
        A route planning and time calculation tool for POMC regularity rallies.
      </p>

      <SectionTitle>What is this app?</SectionTitle>
      <p>
        This app helps rally organisers plan regularity rally routes. You build routes from reusable
        sections (called <strong>nodes</strong>), assign speed instructions, calculate arrival times
        for different car groups, and export the final data for timing systems.
      </p>

      <SectionTitle>Data Structure</SectionTitle>
      <p>Everything lives in a single workspace file (<code>.rally.json</code>):</p>
      <Code>
        <strong>Workspace</strong><br />
        &nbsp;&nbsp;Rally <span style={{ color: 'var(--color-text-muted)' }}>(e.g. "DJ Rally")</span><br />
        &nbsp;&nbsp;&nbsp;&nbsp;Speed Tables + Time-Add Tables<br />
        &nbsp;&nbsp;&nbsp;&nbsp;Node Library <span style={{ color: 'var(--color-text-muted)' }}>(reusable section templates)</span><br />
        &nbsp;&nbsp;&nbsp;&nbsp;Edition <span style={{ color: 'var(--color-text-muted)' }}>(e.g. "2025")</span><br />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Day <span style={{ color: 'var(--color-text-muted)' }}>(e.g. "Friday")</span><br />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Route Nodes <span style={{ color: 'var(--color-text-muted)' }}>(placed sections, in order)</span><br />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Rows <span style={{ color: 'var(--color-text-muted)' }}>(instructions, distances, speeds)</span>
      </Code>

      <SectionTitle>Typical Workflow</SectionTitle>
      <ol style={{ paddingLeft: '20px', lineHeight: '2.0' }}>
        <li><strong>Set up Speed Tables</strong> for the rally</li>
        <li><strong>Build Node Templates</strong> in the Node Library</li>
        <li><strong>Assemble the route</strong> by dragging nodes into each day</li>
        <li><strong>Recalculate times</strong> to compute arrival times</li>
        <li><strong>Reconnaissance</strong> — go out and measure real distances</li>
        <li><strong>Push to Library</strong> to update templates with recon data</li>
        <li><strong>Pull from Template</strong> to sync library edits back into placed route nodes</li>
        <li><strong>Export CSV</strong> for the timing/scoring system</li>
      </ol>
      <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
        Use the pages in this guide to learn about each step in detail.
      </p>
    </>
  );
}

function TypeCodesPage() {
  const types = [
    {
      code: 'o', name: 'Open Section', color: '#2563EB',
      desc: 'A non-competitive transport section where all car groups travel at the same speed (B=C=D=A). The speed is capped by the effective speed limit (speed limit minus the configured margin). Open sections have their own lookup table in the Speed Tables page. Used for transport stages between regularity sections.',
      example: 'Cars are driving between two competitive stages at 40 km/h. All groups (A, B, C, D) travel at 40 km/h.',
    },
    {
      code: 'f', name: 'Flat Terrain', color: '#16A34A',
      desc: 'A competitive regularity section on flat roads. Each speed group travels at a different speed — Group A is slowest, Group D is fastest. The B/C/D speeds are looked up from the Flat speed table based on the A-speed you set.',
      example: 'A-speed = 34 km/h might give B=39, C=44, D=49 from the flat lookup table.',
    },
    {
      code: 'd', name: 'Downhill', color: '#EA580C',
      desc: 'A competitive section on downhill terrain. The speed spread between groups is narrower than flat sections because downhill is easier for slower cars. B/C/D speeds come from the Downhill speed table.',
      example: 'A=34 might give B=37, C=41, D=43 — a tighter spread than flat.',
    },
    {
      code: 'u', name: 'Uphill', color: '#9333EA',
      desc: 'A competitive section on uphill terrain. The speed spread is wider than flat because uphills are harder for slower cars. B/C/D speeds come from the Uphill speed table.',
      example: 'A=34 might give B=40, C=47, D=54 — a wider spread than flat.',
    },
    {
      code: 'l', name: 'Speed Limit', color: '#DC2626',
      desc: 'A zone where the legal speed limit applies. Used when the regularity section passes through a town or restricted area. B/C/D speeds come from the Speed Limit table, which typically has a wider spread.',
      example: 'Speed limit zone at 40 km/h: A=40, B=50, C=55, D=60.',
    },
    {
      code: 'm', name: 'Marked Control', color: '#0D9488',
      desc: 'A timing checkpoint within a regularity section. Does not change the speed — it inherits all speeds (A/B/C/D) from the previous regularity row. Used to mark where timing marshals will record car passage times.',
      example: 'Placed at a checkpoint between two flat-terrain rows. Inherits the same speeds.',
    },
    {
      code: 't', name: 'Time Add (Stop)', color: '#0891B2',
      desc: 'A mandatory stop or break. All speeds are set to 0. Instead of travelling, a fixed number of minutes is added to each group\'s time. The B/C/D add-time values are looked up from the Time-Add table based on the A-group\'s add-time.',
      example: 'A 10-minute break for Group A might be 15 minutes for B, 15 for C, and 20 for D.',
    },
  ];

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Type Codes</h2>
      <p>
        Every row in the route can have a <strong>type code</strong> that controls how speeds and
        times are calculated. Type codes determine which speed table to use and how the row behaves.
      </p>

      <Callout>
        Only rows with a type code are included in the CSV export. Rows without a type code are
        used for intermediate distance points, clues, and annotations — they inherit speeds from
        the last typed row above them.
      </Callout>

      {types.map(t => (
        <div key={t.code} style={{
          margin: '16px 0',
          padding: '14px 18px',
          borderRadius: '10px',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <Badge color={t.color}>{t.code}</Badge>
            <strong style={{ fontSize: '15px' }}>{t.name}</strong>
          </div>
          <p style={{ margin: '0 0 8px 0' }}>{t.desc}</p>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
            Example: {t.example}
          </p>
        </div>
      ))}

      <SectionTitle>Speed Inheritance</SectionTitle>
      <p>
        When a row has <strong>no type code</strong>, it automatically inherits the A/B/C/D speeds
        from the most recent row above it that does have a type code. This means you only need to
        set the type and speed when they change — all rows in between will use the same values.
      </p>
    </>
  );
}

function SpeedTablesPage() {
  return (
    <>
      <h2 style={{ marginTop: 0 }}>Speed Tables</h2>
      <p>
        In a regularity rally, competitors are divided into <strong>speed groups</strong> based on experience level.
        Each group travels at a different speed through competitive (regularity) sections:
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
        margin: '12px 0 16px 0',
      }}>
        {[
          { group: 'A', label: 'Slowest', desc: 'Experienced competitors, tightest timing', color: '#DC2626' },
          { group: 'B', label: 'Medium-Slow', desc: 'Intermediate level', color: '#EA580C' },
          { group: 'C', label: 'Medium-Fast', desc: 'Less experienced', color: '#2563EB' },
          { group: 'D', label: 'Fastest', desc: 'Beginners, most relaxed timing', color: '#16A34A' },
        ].map(g => (
          <div key={g.group} style={{
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-secondary)',
          }}>
            <div style={{ fontWeight: 700, fontSize: '15px', color: g.color }}>Group {g.group}</div>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>{g.label}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{g.desc}</div>
          </div>
        ))}
      </div>

      <SectionTitle>How Speed Lookup Works</SectionTitle>
      <p>
        You only need to set two things on each instruction row: the <strong>type code</strong> (terrain)
        and the <strong>A-speed</strong>. When you press <strong>Recalc Times</strong>, the app looks up the
        B, C, and D speeds from the speed table for that terrain type:
      </p>
      <Code>
        Row: type = "f" (flat), A-speed = 34<br />
        Lookup: Flat table, key = 34<br />
        Result: B = 39, C = 44, D = 49
      </Code>
      <p>
        Different terrain types produce different speed spreads. Downhill has a narrow spread (easier for
        everyone), while uphill has a wide spread (harder for slower cars).
      </p>

      <SectionTitle>Special Type Behaviour</SectionTitle>
      <ul style={{ paddingLeft: '20px' }}>
        <li><strong>Open (o)</strong> — All groups travel at the same speed (B=C=D=A). Has its own lookup table, but by default all entries map to equal speeds.</li>
        <li><strong>Marked Control (m)</strong> — Inherits all speeds from the previous regularity row.</li>
        <li><strong>Time Add (t)</strong> — Speeds are 0. The A-group "speed" value is actually the <strong>break time in minutes</strong>, and the B/C/D break times are looked up from the Time-Add table.</li>
      </ul>

      <SectionTitle>Managing Speed Tables</SectionTitle>
      <p>
        Navigate to the <strong>Speed Tables</strong> page from the sidebar. There you can:
      </p>
      <ul style={{ paddingLeft: '20px' }}>
        <li>View and edit all speed lookup entries (Open, Flat, Downhill, Uphill, Speed Limit)</li>
        <li>View and edit the Time-Add lookup table</li>
        <li>Set the <strong>Speed Limit Margin</strong> — the percentage below the posted speed limit that cars must stay</li>
        <li><strong>Import</strong> tables from a JSON file if your rally organiser provides different speed tables</li>
        <li>Reset to built-in defaults (based on DJ Rally data)</li>
      </ul>

      <SectionTitle>Speed Limit Margin</SectionTitle>
      <p>
        Rally rules typically require cars to travel below the posted speed limit. The <strong>Speed Limit
        Margin</strong> setting (default 10%) defines how far below. When Recalc Times runs, all speeds
        are capped at the effective limit:
      </p>
      <Code>
        Effective limit = speed limit x (1 - margin%)<br />
        Example: 60 km/h limit with 10% margin = 54 km/h max
      </Code>
      <p>
        This is configurable per rally on the Speed Tables page. Set it to 0% to use the full speed limit.
      </p>

      <Callout>
        Speed tables are <strong>per-rally</strong>. Different rallies in the same workspace can have completely
        different speed tables and margin settings.
      </Callout>
    </>
  );
}

function TimeCalcPage() {
  return (
    <>
      <h2 style={{ marginTop: 0 }}>Time Calculations</h2>
      <p>
        When you press <strong>Recalc Times</strong>, the app computes <strong>First Car</strong> and
        <strong> Last Car</strong> arrival times for every row in the route. This section explains exactly
        how these times are calculated.
      </p>

      <SectionTitle>Step 1: Group Departure Times</SectionTitle>
      <p>
        Cars depart sequentially from the start line. Group A goes first, then B, C, D. Within each
        group, cars leave at a fixed interval (e.g. 1 minute apart). Between groups there is a configurable gap.
      </p>
      <Code>
        First A = start time (e.g. 06:01)<br />
        Last A &nbsp;= First A + (A cars - 1) x interval<br />
        First B = Last A + gap between A and B<br />
        Last B &nbsp;= First B + (B cars - 1) x interval<br />
        First C = Last B + gap between B and C<br />
        Last C &nbsp;= First C + (C cars - 1) x interval<br />
        First D = Last C + gap between C and D<br />
        Last D &nbsp;= First D + (D cars - 1) x interval
      </Code>
      <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
        Example: Start at 06:01, 9 A-cars with 1-min intervals, 1-min gap.
        Last A departs at 06:09, First B at 06:10, etc.
      </p>

      <SectionTitle>Step 2: Anchor-Based Travel Time</SectionTitle>
      <p>
        Travel time is calculated using an <strong>anchor system</strong>, not a simple running total.
        An "anchor" is the point where speeds last changed — the app remembers the distance and
        travel time at that point.
      </p>
      <p>
        For each row, the travel time is computed from the anchor:
      </p>
      <Code>
        incremental distance = current distance - anchor distance<br />
        travel time = anchor travel time + incremental distance / speed
      </Code>
      <p>
        The anchor <strong>resets</strong> whenever any group speed (A, B, C, or D) changes between
        two consecutive rows. When it resets, the new anchor is set to the row where the speed changed
        and its calculated travel time.
      </p>

      <Callout>
        <strong>Why anchors instead of row-by-row?</strong> If one row has a bad rally distance
        (e.g. a typo of 800 instead of 108), only that row's time is wrong. The rows after it
        still calculate from the anchor (the last speed change) and are unaffected. A row-by-row
        running total would carry the error through the entire remaining route.
      </Callout>

      <SectionTitle>Step 3: Time-Add Rows</SectionTitle>
      <p>
        When a row has type "t" (time add), no distance-based travel time is calculated.
        Instead, the add-time value in minutes is added to the anchor travel time. The anchor
        also resets on time-add rows so subsequent distance calculations start fresh.
      </p>
      <Code>
        Group A: travel time = anchor time + addTimeA minutes<br />
        Group B: travel time = anchor time + addTimeB minutes<br />
        Group C: travel time = anchor time + addTimeC minutes<br />
        Group D: travel time = anchor time + addTimeD minutes
      </Code>
      <p>
        The B/C/D add-times are looked up from the Time-Add table. Slower groups typically
        get shorter breaks, faster groups get longer breaks.
      </p>

      <Callout>
        <strong>Speed after a time-add:</strong> Time-add rows have speed = 0, but the app
        remembers the speed from before the time-add. The next distance-based row uses that
        preserved speed, preventing a gap in the calculation.
      </Callout>

      <SectionTitle>Step 4: Arrival Times</SectionTitle>
      <p>
        Each group has two arrival times at every point:
      </p>
      <ul style={{ paddingLeft: '20px' }}>
        <li><strong>First car arrival</strong> = group's first car departure time + travel time</li>
        <li><strong>Last car arrival</strong> = group's last car departure time + travel time</li>
      </ul>
      <p>This produces <strong>8 independent time streams</strong>: First A, Last A, First B, Last B, First C, Last C, First D, Last D.</p>

      <SectionTitle>Step 5: First Car / Last Car</SectionTitle>
      <p>The displayed columns are:</p>
      <ul style={{ paddingLeft: '20px' }}>
        <li><strong>First Car</strong> = the <strong>earliest</strong> arrival across all active groups' first-car times (MIN)</li>
        <li><strong>Last Car</strong> = the <strong>latest</strong> arrival across all active groups' last-car times (MAX)</li>
      </ul>
      <p>
        Groups with 0 competitors are excluded from the calculation. This is why the Day Panel
        car group settings matter — they control which groups are active and the departure timing.
      </p>

      <SectionTitle>Configuring Car Groups</SectionTitle>
      <p>
        Open the <strong>Day Panel</strong> at the bottom of the sidebar. For each day you can set:
      </p>
      <ul style={{ paddingLeft: '20px' }}>
        <li>Start time (e.g. 06:01)</li>
        <li>Number of cars per group (A, B, C, D)</li>
        <li>Car interval within each group (e.g. 60 seconds)</li>
        <li>Gap between groups (e.g. 60 seconds)</li>
      </ul>
    </>
  );
}

function NodeLibraryPage() {
  return (
    <>
      <h2 style={{ marginTop: 0 }}>Nodes & Route Building</h2>

      <SectionTitle>What is a Node?</SectionTitle>
      <p>
        A <strong>node</strong> is a section of a rally route — it could be a regularity section,
        a transport stage, a fuel stop, or anything else. Each node contains a set of rows with
        instructions, distances, type codes, and speeds.
      </p>
      <p>
        The <strong>Node Library</strong> stores reusable templates. When you drag a template
        into a day's route, a <strong>deep copy</strong> is created. This means:
      </p>
      <ul style={{ paddingLeft: '20px' }}>
        <li>Edits to the placed node do <strong>not</strong> affect the template</li>
        <li>Edits to the template do <strong>not</strong> affect already-placed nodes</li>
        <li>You can reuse the same template across multiple editions</li>
      </ul>

      <SectionTitle>Building Templates</SectionTitle>
      <ol style={{ paddingLeft: '20px' }}>
        <li>Navigate to the <strong>Node Library</strong> from the sidebar</li>
        <li>Click <strong>New Template</strong> to create a section</li>
        <li>Click a template to open the <strong>Template Editor</strong> (a spreadsheet grid)</li>
        <li>Add rows with the blackbook page number, instruction/clue, rally distance, type code, A-speed, etc.</li>
        <li>Press <strong>Escape</strong> or "Back to Library" to return</li>
      </ol>

      <SectionTitle>Connection Rules</SectionTitle>
      <p>
        Templates can define which other templates are allowed to <strong>precede</strong> them.
        This helps enforce correct ordering — for example, "Reg 2" should only follow "Transport to Reg 2".
        You can also mark a template as a valid <strong>start node</strong> for a day.
      </p>

      <SectionTitle>Route Builder</SectionTitle>
      <p>
        The <strong>Route Builder</strong> has two tabs:
      </p>
      <ul style={{ paddingLeft: '20px' }}>
        <li><strong>Map tab</strong> — Drag nodes from the palette on the right into the route on the left. Reorder by dragging. The palette highlights which nodes are valid next based on connection rules.</li>
        <li><strong>Table tab</strong> — A full spreadsheet view of all rows across all nodes in the day. Rows are separated by node boundaries (purple lines). Edit individual cell values here.</li>
      </ul>

      <Callout>
        Distances are <strong>chained</strong> in the table view. Each node's first row continues from
        the previous node's last distance, so the rally distance column shows cumulative distance for the whole day.
      </Callout>

      <SectionTitle>Template Sync: Push & Pull</SectionTitle>
      <p>
        Data flows both directions between placed route nodes and their source templates:
      </p>
      <ul style={{ paddingLeft: '20px' }}>
        <li><strong>Push to Library</strong> — Updates the source template with the route node's data (e.g. after recon). Available from both the node editor toolbar and the Route Builder table view.</li>
        <li><strong>Pull from Template</strong> — Replaces the route node's rows with the latest template data. Use this when the template has been edited in the Node Library (e.g. fixing terrain types, adjusting speeds, adding rows) and you want placed nodes to pick up those changes.</li>
      </ul>

      <SectionTitle>Out-of-Sync Indicator</SectionTitle>
      <p>
        In the Route Builder <strong>Nodes</strong> tab, each node card shows an amber
        "<strong>out of sync</strong>" badge when its rows differ from the source template. This
        tells you the placed node has drifted — either you edited the node locally, or the template
        was updated in the library.
      </p>

      <SectionTitle>Pull Safety</SectionTitle>
      <p>
        Pulling replaces <strong>all rows</strong> in the node. To prevent accidental data loss:
      </p>
      <ul style={{ paddingLeft: '20px' }}>
        <li>If the node has <strong>un-pushed local edits</strong> (modified rows, added rows), the Pull button shows a red warning and <strong>blocks the pull</strong>. You must push your changes to the library first.</li>
        <li>If the node has <strong>un-pushed recon measurements</strong> (check distances, GPS coordinates), pulling is also blocked until you push first.</li>
        <li>If only the template has new changes and the node has no local edits, pulling is allowed directly.</li>
      </ul>

      <SectionTitle>Manual Distance & Coordinate Overrides</SectionTitle>
      <p>
        The <strong>Rally Distance</strong>, <strong>Latitude</strong>, and <strong>Longitude</strong> columns
        are normally computed from recon history averages and cannot be edited directly in the grid. To override a value:
      </p>
      <ol style={{ paddingLeft: '20px' }}>
        <li>Click the cell — an <strong>override dialog</strong> appears showing the current value and its source</li>
        <li>Enter your override value and confirm</li>
        <li>Overridden cells are marked so you can tell them apart from computed values</li>
        <li>When you <strong>Push to Library</strong>, an overridden value replaces the recon history (starts fresh) rather than being averaged in</li>
      </ol>
    </>
  );
}

function ReconPage() {
  return (
    <>
      <h2 style={{ marginTop: 0 }}>Reconnaissance & Push to Library</h2>

      <SectionTitle>What is Recon Mode?</SectionTitle>
      <p>
        Reconnaissance ("recon") is the process of driving the rally route before the event to
        measure actual distances. The planned distances in the blackbook may differ from reality
        due to road changes, detours, or measurement errors.
      </p>

      <SectionTitle>Using Recon Mode</SectionTitle>
      <ol style={{ paddingLeft: '20px' }}>
        <li>Open a day's route in the <strong>Table</strong> view</li>
        <li>Click the <strong>Recon</strong> button in the toolbar to enable Recon Mode</li>
        <li>The <strong>Check Dist</strong> column becomes editable (highlighted)</li>
        <li>As you drive the route, enter the actual odometer distance at each checkpoint</li>
        <li>You can also record <strong>GPS coordinates</strong> (Check Lat / Check Long)</li>
      </ol>

      <SectionTitle>Suggestions</SectionTitle>
      <p>
        As you enter check distances, the app calculates the <strong>drift</strong> (difference
        between your measured distance and the planned distance). Grey suggestion values appear
        for upcoming rows, estimated from this drift pattern. This helps you anticipate where
        the next checkpoint should be.
      </p>

      <SectionTitle>Push to Library</SectionTitle>
      <p>
        After completing a recon run, press <strong>Push to Library</strong> in the toolbar. This:
      </p>
      <ol style={{ paddingLeft: '20px' }}>
        <li>Compares each placed node against its template (shows a diff summary)</li>
        <li>Adds your check distances to the template's <strong>distance history</strong> (timestamped)</li>
        <li>Recalculates the template's <strong>rally distance</strong> as the average of the last 3 recordings</li>
        <li>Pushes any other changes back (clues, speeds, GPS coordinates, etc.)</li>
      </ol>

      <Callout>
        <strong>Why average the last 3?</strong> Each recon run may have slight measurement
        differences. Averaging the most recent 3 recordings helps the distances converge on the
        true value over multiple runs. Older recordings are dropped so the data stays current.
      </Callout>

      <SectionTitle>Pull from Template (After Recon)</SectionTitle>
      <p>
        If a template is later edited in the Node Library (e.g. fixing terrain, adjusting speeds),
        you can <strong>Pull from Template</strong> to update placed route nodes with the latest
        template data. However, the pull is <strong>blocked</strong> if the node still has un-pushed
        recon measurements — you must push first to avoid losing your recordings.
      </p>

      <SectionTitle>Clear Recon</SectionTitle>
      <p>
        Press <strong>Clear Recon</strong> to reset all check distances on the current route
        without pushing anything to the library. Useful if you need to start a recon run over.
      </p>
    </>
  );
}

function ExportPage() {
  return (
    <>
      <h2 style={{ marginTop: 0 }}>CSV Export</h2>
      <p>
        The app can export the current day's route as a CSV file in three formats. Only rows
        with a <strong>type code</strong> are included in the export.
      </p>

      <SectionTitle>Clean (Scoring Program Input)</SectionTitle>
      <p>
        Sequential numbering (1, 2, 3...), organiser annotations stripped. This format is
        ready for direct import into the scoring/timing program.
      </p>
      <ul style={{ paddingLeft: '20px' }}>
        <li>Columns: No, Instruction, Type, Distance, A/B/C/D Speeds, Limit, A/B/C/D AddTimes, Lat, Long</li>
        <li>Curly-brace annotations like <code>{'{for organisers only}'}</code> are removed from instructions</li>
      </ul>

      <SectionTitle>Organiser</SectionTitle>
      <p>
        Type code in the No. field, curly-brace annotations preserved. For organisers to
        reference on the day of the rally.
      </p>

      <SectionTitle>SpeedABCD (Time Verification)</SectionTitle>
      <p>
        Distance, all 4 group speeds, and cumulative travel times for each group. Useful for
        manually verifying that the time calculations are correct.
      </p>

      <SectionTitle>Annotations</SectionTitle>
      <p>
        Text inside curly braces in the clue/instruction field is treated as organiser-only annotations:
      </p>
      <Code>
        Turn left at T-junction {'{marshal point, need 2 marshals}'}<br />
        <br />
        Clean export: "Turn left at T-junction"<br />
        Organiser export: "Turn left at T-junction {'{marshal point, need 2 marshals}'}"
      </Code>
    </>
  );
}

function ShortcutsPage() {
  const shortcuts = [
    { keys: 'Ctrl/Cmd + S', action: 'Save workspace' },
    { keys: 'Ctrl/Cmd + Shift + S', action: 'Save As (new file)' },
    { keys: 'Ctrl/Cmd + Z', action: 'Undo' },
    { keys: 'Ctrl/Cmd + Y', action: 'Redo' },
    { keys: 'Insert', action: 'Add new row (in grid view)' },
    { keys: 'Escape', action: 'Navigate back (editor to library, grid to route builder)' },
    { keys: 'Delete', action: 'Clear selected cell (in grid)' },
    { keys: 'Enter', action: 'Start editing / confirm edit (in grid)' },
    { keys: 'Tab', action: 'Move to next cell (in grid)' },
  ];

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Keyboard Shortcuts</h2>

      <table style={{ width: '100%', borderCollapse: 'collapse', margin: '12px 0', fontSize: '14px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
            <th style={{ padding: '8px 12px', textAlign: 'left', width: '220px' }}>Shortcut</th>
            <th style={{ padding: '8px 12px', textAlign: 'left' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {shortcuts.map((s, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '8px 12px' }}>
                <code style={{
                  background: 'var(--color-bg-secondary)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '13px',
                  border: '1px solid var(--color-border)',
                }}>
                  {s.keys}
                </code>
              </td>
              <td style={{ padding: '8px 12px' }}>{s.action}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionTitle>General Tips</SectionTitle>
      <ul style={{ paddingLeft: '20px', lineHeight: '2.0' }}>
        <li><strong>Right-click</strong> rallies, editions, and days in the sidebar for rename, lock, and delete options.</li>
        <li><strong>Edition Locking</strong> — right-click an edition and select "Lock" to prevent accidental edits to finalised routes. A yellow badge appears and the grid is overlaid.</li>
        <li><strong>Auto-save</strong> — the app automatically saves every 5 seconds when changes are detected.</li>
        <li>Configure <strong>car group settings</strong> in the Day Panel at the bottom of the sidebar.</li>
        <li><strong>Recalc Times</strong> must be pressed manually after editing speeds, distances, or group settings — it does not auto-run.</li>
        <li>The <strong>Speed Limit</strong> column caps all speeds. If a speed from the lookup table exceeds the limit, it is clamped.</li>
      </ul>
    </>
  );
}

// ─── Main Component ──────────────────────────────────────

interface HelpGuideProps {
  open: boolean;
  onClose: () => void;
}

export default function HelpGuide({ open, onClose }: HelpGuideProps) {
  const [page, setPage] = useState<Page>('overview');

  if (!open) return null;

  const renderPage = () => {
    switch (page) {
      case 'overview': return <OverviewPage />;
      case 'typecodes': return <TypeCodesPage />;
      case 'speedtables': return <SpeedTablesPage />;
      case 'timecalc': return <TimeCalcPage />;
      case 'nodelibrary': return <NodeLibraryPage />;
      case 'recon': return <ReconPage />;
      case 'export': return <ExportPage />;
      case 'shortcuts': return <ShortcutsPage />;
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-bg)',
          borderRadius: '14px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          width: '820px',
          maxWidth: '92vw',
          height: '600px',
          maxHeight: '85vh',
          overflow: 'hidden',
        }}
      >
        {/* Sidebar Navigation */}
        <div style={{
          width: '190px',
          minWidth: '190px',
          background: 'var(--color-bg-sidebar)',
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 0',
        }}>
          <div style={{
            padding: '0 16px 14px 16px',
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--color-text)',
            borderBottom: '1px solid var(--color-border)',
            marginBottom: '8px',
          }}>
            Help Guide
            <div style={{ fontWeight: 400, fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>v2.1.0</div>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {PAGES.map(p => (
              <button
                key={p.key}
                onClick={() => setPage(p.key)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 16px',
                  border: 'none',
                  background: page === p.key ? 'var(--color-primary-light)' : 'transparent',
                  color: page === p.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  fontWeight: page === p.key ? 700 : 500,
                  fontSize: '13px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: '0',
                  minHeight: 'auto',
                  borderLeft: page === p.key ? '3px solid var(--color-primary)' : '3px solid transparent',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border)' }}>
            <button
              onClick={onClose}
              style={{
                width: '100%',
                padding: '6px 0',
                fontSize: '13px',
                minHeight: 'auto',
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div style={{
          flex: 1,
          padding: '28px 32px',
          overflow: 'auto',
          fontSize: '14px',
          lineHeight: '1.7',
          color: 'var(--color-text-secondary)',
        }}>
          {renderPage()}
        </div>
      </div>
    </div>
  );
}
