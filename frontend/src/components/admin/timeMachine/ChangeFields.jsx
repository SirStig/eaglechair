import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { formatValue, humanizeField, isLongText } from './format';
import { wordDiff } from './wordDiff';

const VALUE_BOX = 'whitespace-pre-wrap break-words rounded-md bg-dark-900 px-2.5 py-1.5 font-mono text-[12px] leading-relaxed';
const SAVED_PREVIEW = 6;

/** Long text: one block with removed words struck red and added words green */
function TextDiff({ before, after }) {
  const parts = useMemo(() => wordDiff(formatValue(before), formatValue(after)), [before, after]);
  if (!parts) {
    return (
      <div className="grid gap-2 md:grid-cols-2">
        <p className={`${VALUE_BOX} text-red-200/90`}><span className="sr-only">Before: </span>{formatValue(before)}</p>
        <p className={`${VALUE_BOX} text-emerald-200/90`}><span className="sr-only">After: </span>{formatValue(after)}</p>
      </div>
    );
  }
  return (
    <p className={`${VALUE_BOX} max-h-72 overflow-auto text-dark-100`}>
      {parts.map((part, i) => {
        if (part.type === 'del') {
          return <del key={i} className="rounded-sm bg-red-500/20 text-red-200 decoration-red-300/70">{part.text}</del>;
        }
        if (part.type === 'ins') {
          return <ins key={i} className="rounded-sm bg-emerald-500/20 text-emerald-100 no-underline">{part.text}</ins>;
        }
        return <span key={i}>{part.text}</span>;
      })}
    </p>
  );
}

function FieldChange({ field }) {
  const long = isLongText(field.before) || isLongText(field.after)
    || typeof field.before === 'object' || typeof field.after === 'object';
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-dark-200">{humanizeField(field.name)}</p>
      {long ? (
        <TextDiff before={field.before} after={field.after} />
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded bg-red-500/10 px-2 py-0.5 text-red-200 line-through decoration-red-300/50">
            {formatValue(field.before)}
          </span>
          <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-dark-300" aria-label="changed to" />
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-emerald-200">{formatValue(field.after)}</span>
        </div>
      )}
    </div>
  );
}

/** The copy kept of a deleted row */
function SavedCopy({ fields }) {
  const [all, setAll] = useState(false);
  const shown = all ? fields : fields.slice(0, SAVED_PREVIEW);
  return (
    <div className="space-y-2">
      <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[11rem_1fr]">
        {shown.map((field) => {
          const block = isLongText(field.value) || typeof field.value === 'object';
          return (
            <div key={field.name} className="contents">
              <dt className="text-xs text-dark-200 sm:pt-0.5">{humanizeField(field.name)}</dt>
              <dd className={block ? `${VALUE_BOX} max-h-40 overflow-auto text-dark-100` : 'break-words text-dark-50'}>
                {formatValue(field.value)}
              </dd>
            </div>
          );
        })}
      </dl>
      {fields.length > SAVED_PREVIEW && (
        <button type="button" onClick={() => setAll((v) => !v)} className="text-xs text-primary-400 hover:text-primary-300">
          {all ? 'Show fewer fields' : `Show all ${fields.length} saved fields`}
        </button>
      )}
    </div>
  );
}

/**
 * What one history entry changed: field-by-field diffs for an edit, the
 * saved copy for a delete, a note for an addition.
 */
export default function ChangeFields({ entry }) {
  const fields = entry.fields || [];
  if (entry.op === 'updated') {
    return (
      <div className="space-y-3">
        {fields.map((field) => <FieldChange key={field.name} field={field} />)}
      </div>
    );
  }
  if (entry.op === 'deleted') {
    if (entry.is_link) return <p className="text-sm text-dark-200">Link removed. Undoing puts it back.</p>;
    return fields.length ? <SavedCopy fields={fields} /> : <p className="text-sm text-dark-200">Deleted.</p>;
  }
  return <p className="text-sm text-dark-200">Added. Undoing this removes it again.</p>;
}
