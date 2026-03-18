import { useState, useMemo } from 'react';
import { SADC_SIGNS, SIGN_CATEGORIES, type SignCategory } from '../../data/sadcSigns';

type Filter = SignCategory | 'all';

export default function SignsPage() {
  const [category, setCategory] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return SADC_SIGNS.filter(s => {
      if (category !== 'all' && s.category !== category) return false;
      if (q && !s.code.toLowerCase().includes(q) && !s.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [category, search]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Filter bar */}
      <div style={{
        flexShrink: 0,
        padding: '10px 16px',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <div style={{
          display: 'flex',
          gap: '4px',
          overflowX: 'auto',
          flex: 1,
          paddingBottom: '2px',
        }}>
          <PillButton active={category === 'all'} onClick={() => setCategory('all')}>
            All
          </PillButton>
          {SIGN_CATEGORIES.map(c => (
            <PillButton key={c.key} active={category === c.key} onClick={() => setCategory(c.key)}>
              {c.label}
            </PillButton>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search signs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '180px',
            padding: '5px 10px',
            fontSize: '13px',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            background: 'var(--color-bg)',
            color: 'var(--color-text)',
            outline: 'none',
          }}
        />

        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
          {filtered.length} sign{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Grid */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '12px',
        }}>
          {filtered.map(sign => (
            <SignCard key={sign.code} code={sign.code} name={sign.name} image={sign.image} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '48px',
            color: 'var(--color-text-muted)',
            fontSize: '14px',
          }}>
            No signs match your search.
          </div>
        )}
      </div>
    </div>
  );
}

function PillButton({ active, onClick, children }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 12px',
        fontSize: '12px',
        fontWeight: 500,
        borderRadius: '99px',
        border: '1px solid',
        borderColor: active ? 'var(--color-accent)' : 'var(--color-border)',
        background: active ? 'var(--color-accent)' : 'transparent',
        color: active ? '#fff' : 'var(--color-text)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        lineHeight: '1.4',
        minHeight: 'auto',
      }}
    >
      {children}
    </button>
  );
}

function SignCard({ code, name, image }: { code: string; name: string; image: string }) {
  const [error, setError] = useState(false);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '12px 8px',
      borderRadius: '8px',
      border: '1px solid var(--color-border)',
      background: 'var(--color-bg)',
      gap: '6px',
    }}>
      {error ? (
        <div style={{
          width: '80px',
          height: '80px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0f0f0',
          borderRadius: '6px',
          color: '#999',
          fontSize: '12px',
          fontWeight: 600,
        }}>
          {code}
        </div>
      ) : (
        <img
          src={`/signs/${image}`}
          alt={`${code} - ${name}`}
          width={80}
          height={80}
          style={{ objectFit: 'contain' }}
          onError={() => setError(true)}
        />
      )}
      <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text)' }}>{code}</div>
      <div style={{
        fontSize: '11px',
        color: 'var(--color-text-muted)',
        textAlign: 'center',
        lineHeight: '1.3',
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
      }}>
        {name}
      </div>
    </div>
  );
}
