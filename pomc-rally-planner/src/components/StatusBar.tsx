import { useProjectStore, selectCurrentRally, selectCurrentDay, selectCurrentNode } from '../state/projectStore';
import { flattenDayRows } from '../state/storeHelpers';
import { useGpsStore } from '../state/gpsStore';

export default function StatusBar() {
  const rally = useProjectStore(selectCurrentRally);
  const day = useProjectStore(selectCurrentDay);
  const node = useProjectStore(selectCurrentNode);
  const isDirty = useProjectStore(s => s.isDirty);
  const lastSaved = useProjectStore(s => s.lastSaved);
  const viewMode = useProjectStore(s => s.viewMode);
  const editingTemplateId = useProjectStore(s => s.editingTemplateId);

  const dayRows = day ? flattenDayRows(day) : [];
  const nodeRows = node?.rows ?? [];

  // Template editing rows
  let templateRows: { length: number } = { length: 0 };
  if (editingTemplateId && rally) {
    const template = rally.nodeLibrary.find(t => t.id === editingTemplateId);
    templateRows = template?.rows ?? { length: 0 };
  }

  const gpsConnected = useGpsStore(s => s.connected);
  const gpsData = useGpsStore(s => s.gpsData);
  const gpsFixColor = gpsConnected && gpsData && gpsData.fix_quality > 0 ? '#22C55E' : gpsConnected ? '#EAB308' : undefined;

  const renderContextInfo = () => {
    if (viewMode === 'gps') {
      return (
        <span>GPS Receiver — {gpsConnected
          ? `${gpsData?.satellites_used ?? 0} sats, ${gpsData?.fix_quality_label ?? 'No Fix'}`
          : 'Disconnected'
        }</span>
      );
    }

    if (viewMode === 'library') {
      if (editingTemplateId) {
        return (
          <span>Template rows: {templateRows.length}</span>
        );
      }
      return (
        <span>Library: {rally?.nodeLibrary.length ?? 0} templates</span>
      );
    }

    if (viewMode === 'routeBuilder') {
      return (
        <>
          <span>Nodes: {day?.nodes.length ?? 0}</span>
          <span>Total rows: {dayRows.length}</span>
        </>
      );
    }

    // Grid view
    const exportableRows = nodeRows.filter(r => r.type !== null);
    const maxDist = nodeRows.length > 0 ? nodeRows[nodeRows.length - 1]?.rallyDistance ?? 0 : 0;
    return (
      <>
        <span>
          Node rows: {nodeRows.length} ({exportableRows.length} exportable)
        </span>
        <span>
          Day total: {dayRows.length} rows
        </span>
        <span>
          Dist: {maxDist.toFixed(2)} km
        </span>
      </>
    );
  };

  return (
    <div style={{
      height: 'var(--statusbar-height)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: '24px',
      borderTop: '1px solid var(--color-border)',
      background: 'var(--color-bg-secondary)',
      fontSize: '14px',
      color: 'var(--color-text-secondary)',
    }}>
      {renderContextInfo()}
      {/* GPS indicator when connected but on another page */}
      {gpsConnected && viewMode !== 'gps' && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: gpsFixColor, display: 'inline-block',
            boxShadow: `0 0 4px ${gpsFixColor}`,
          }} />
          GPS
        </span>
      )}
      <div style={{ flex: 1 }} />
      <span>
        {isDirty ? (
          <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>Unsaved changes</span>
        ) : lastSaved ? (
          <span>Saved {lastSaved}</span>
        ) : (
          <span>Not saved</span>
        )}
      </span>
    </div>
  );
}
